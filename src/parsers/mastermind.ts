/**
 * Parser for Mastermind-style debug events (SSE stream format).
 *
 * This is the reference parser — it transforms the event format used by
 * the Mastermind agent orchestrator into ReplayStep[].
 */
import type { ReplayStep, ReplayStepType } from "../types";
import { detectParallelGroups } from "../utils/detectParallelGroups";

// ─── Event Types ─────────────────────────────────────────────────────────────

export type BrainStage = "intake" | "research" | "reasoning" | "executor";

interface BaseEvent {
  execution_id: string;
  turn_id?: string;
  timestamp: string;
}

export type MastermindEvent =
  | (BaseEvent & {
      type: "message_received";
      surface: string;
      content_type: string;
      content_preview?: string;
    })
  | (BaseEvent & {
      type: "intent_classified";
      classification: {
        intent_type: string;
        confidence: number;
        needs_research: boolean;
        is_fast_path: boolean;
      };
    })
  | (BaseEvent & {
      type: "brain_stage_started";
      stage: BrainStage;
      input_summary?: string;
    })
  | (BaseEvent & {
      type: "brain_stage_completed";
      stage: BrainStage;
      output_summary?: string;
      duration_ms: number;
    })
  | (BaseEvent & {
      type: "llm_request_started";
      stage: BrainStage;
      model: string;
      prompt_summary?: string;
      tool_count: number;
    })
  | (BaseEvent & {
      type: "llm_response_received";
      stage: BrainStage;
      model: string;
      response_summary?: string;
      tool_calls_count: number;
      duration_ms: number;
    })
  | (BaseEvent & {
      type: "tool_triggered";
      tool_name: string;
      run_id: string;
      inputs?: Record<string, unknown>;
    })
  | (BaseEvent & {
      type: "tool_completed";
      tool_name: string;
      run_id: string;
      success: boolean;
      result_summary?: string;
      error?: string;
      duration_ms: number;
    })
  | (BaseEvent & {
      type: "skill_triggered";
      skill_id: string;
      skill_name: string;
      run_id: string;
      inputs?: Record<string, unknown>;
      invocation_mode?: string;
    })
  | (BaseEvent & {
      type: "skill_completed";
      skill_id: string;
      skill_name: string;
      run_id: string;
      success: boolean;
      result_summary?: string;
      error?: string;
      duration_ms: number;
    })
  | (BaseEvent & {
      type: "knowledge_search_started";
      query: string;
      agent_id: string;
      top_k?: number;
    })
  | (BaseEvent & {
      type: "knowledge_search_completed";
      query: string;
      results_count: number;
      duration_ms: number;
      chunks: Array<{
        source: string;
        score: number;
        content_preview: string;
      }>;
      error?: string;
    })
  | (BaseEvent & {
      type: "response_generated";
      text_length: number;
      has_surface_actions: boolean;
      triggered_skills_count: number;
      auto_generated: boolean;
    })
  | (BaseEvent & {
      type: "error_occurred";
      stage?: string;
      error_code: string;
      error_message: string;
      recoverable: boolean;
      skill_name?: string;
    })
  | (BaseEvent & {
      type: "state_changed";
      from: string;
      to: string;
      reason?: string;
    })
  | (BaseEvent & { type: "agent_initialized"; [key: string]: unknown })
  | (BaseEvent & { type: "skill_polling"; [key: string]: unknown })
  | (BaseEvent & { type: "turn_batch_created"; [key: string]: unknown })
  | (BaseEvent & { type: "turn_batch_phase_changed"; [key: string]: unknown })
  | (BaseEvent & { type: "turn_batch_completed"; [key: string]: unknown })
  | (BaseEvent & { type: "checkpoint_saved"; [key: string]: unknown });

// ─── Parser ──────────────────────────────────────────────────────────────────

/**
 * Transform Mastermind debug events into ReplayStep[].
 */
export function parseMastermindEvents(events: MastermindEvent[]): ReplayStep[] {
  const sorted = [...events].sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const steps: ReplayStep[] = [];
  const pendingLlm = new Map<string, number>();
  const pendingTools = new Map<string, number>();
  const pendingSkills = new Map<string, number>();
  const pendingKnowledge = new Map<string, number>();

  // ── Agent context accumulator ──
  // Builds a rolling snapshot of the agent's state at each point in time.
  // Every step gets a full `agent_context` object attached to its detail.
  let currentTurnId: string | null = null;
  let executionId: string | null = null;
  let userMessage: string | null = null;
  let activeStage: { name: string; goal?: string } | null = null;
  let lastLlm: {
    model: string;
    prompt?: string;
    reasoning?: string;
    tool_calls_requested?: number;
  } | null = null;
  // Per-turn running tallies
  let turnLlmCalls = 0;
  let turnToolCalls = 0;
  let turnSkillCalls = 0;

  // Agent-level context (set once from agent_initialized, persists across turns)
  let systemPrompt: string | null = null;
  let availableTools: Array<Record<string, unknown>> | null = null;
  let agentConfig: Record<string, unknown> | null = null;
  // Conversation history accumulator
  const conversationHistory: Array<{ role: string; content: string; timestamp: string }> = [];

  /** Snapshot the current agent context as a detail object */
  function agentContext(): Record<string, unknown> {
    const ctx: Record<string, unknown> = {};
    if (executionId) ctx.execution_id = executionId;
    if (currentTurnId) ctx.turn_id = currentTurnId;
    if (systemPrompt) ctx.system_prompt = systemPrompt;
    if (availableTools) ctx.available_tools = availableTools;
    if (agentConfig) ctx.agent_config = agentConfig;
    if (userMessage) ctx.user_message = userMessage;
    if (conversationHistory.length > 0) {
      // Include last 10 messages to keep context manageable
      ctx.conversation_history = conversationHistory.slice(-10);
    }
    if (activeStage) {
      ctx.active_stage = activeStage.name;
      if (activeStage.goal) ctx.stage_goal = activeStage.goal;
    }
    if (lastLlm) {
      ctx.llm_model = lastLlm.model;
      if (lastLlm.prompt) ctx.llm_prompt = lastLlm.prompt;
      if (lastLlm.reasoning) ctx.llm_reasoning = lastLlm.reasoning;
      if (lastLlm.tool_calls_requested !== undefined)
        ctx.llm_tool_calls_requested = lastLlm.tool_calls_requested;
    }
    ctx.turn_llm_calls = turnLlmCalls;
    ctx.turn_tool_calls = turnToolCalls;
    ctx.turn_skill_calls = turnSkillCalls;
    return ctx;
  }

  for (const event of sorted) {
    // Track turn/execution boundaries
    if ("execution_id" in event && event.execution_id) {
      executionId = event.execution_id;
    }
    if ("turn_id" in event && event.turn_id && event.turn_id !== currentTurnId) {
      currentTurnId = event.turn_id;
      // Reset per-turn tallies on new turn
      turnLlmCalls = 0;
      turnToolCalls = 0;
      turnSkillCalls = 0;
      lastLlm = null;
    }

    switch (event.type) {
      case "agent_initialized": {
        // Extract agent-level config that persists across all turns
        if (event.system_prompt) systemPrompt = event.system_prompt as string;
        if (event.available_tools)
          availableTools = event.available_tools as Array<Record<string, unknown>>;
        if (event.config) agentConfig = event.config as Record<string, unknown>;
        steps.push({
          id: `init-${event.timestamp}`,
          type: "state_change",
          label: "Agent Initialized",
          timestamp: event.timestamp,
          status: "completed",
          detail: {
            system_prompt: systemPrompt,
            available_tools: availableTools,
            config: agentConfig,
            agent_context: agentContext(),
          },
        });
        break;
      }

      case "message_received": {
        userMessage = event.content_preview ?? null;
        // Track in conversation history
        if (event.content_preview) {
          conversationHistory.push({
            role: "user",
            content: event.content_preview,
            timestamp: event.timestamp,
          });
        }
        steps.push({
          id: `msg-${event.timestamp}`,
          type: "user_message",
          label: `Message: ${event.content_type}`,
          timestamp: event.timestamp,
          status: "completed",
          detail: {
            surface: event.surface,
            content_type: event.content_type,
            content_preview: event.content_preview,
            agent_context: agentContext(),
          },
        });
        break;
      }

      case "intent_classified": {
        steps.push({
          id: `intent-${event.timestamp}`,
          type: "intent_classification",
          label: `Intent: ${event.classification.intent_type}`,
          timestamp: event.timestamp,
          status: "completed",
          agent: "intake",
          detail: {
            intent_type: event.classification.intent_type,
            confidence: event.classification.confidence,
            needs_research: event.classification.needs_research,
            is_fast_path: event.classification.is_fast_path,
            agent_context: agentContext(),
          },
        });
        break;
      }

      case "brain_stage_started": {
        activeStage = { name: event.stage, goal: event.input_summary };
        lastLlm = null; // reset LLM context for new stage
        steps.push({
          id: `stage-${event.stage}-${event.timestamp}`,
          type: "stage_transition",
          label: `${event.stage.charAt(0).toUpperCase() + event.stage.slice(1)} Stage`,
          timestamp: event.timestamp,
          status: "running",
          agent: event.stage,
          detail: {
            stage: event.stage,
            input_summary: event.input_summary,
            agent_context: agentContext(),
          },
        });
        break;
      }

      case "brain_stage_completed": {
        const startIdx = steps.findLastIndex(
          (s) =>
            s.type === "stage_transition" &&
            s.detail.stage === event.stage &&
            s.status === "running",
        );
        if (startIdx !== -1) {
          steps[startIdx].status = "completed";
          steps[startIdx].durationMs = event.duration_ms;
          steps[startIdx].detail.output_summary = event.output_summary;
          // Update the context snapshot with final tallies
          steps[startIdx].detail.agent_context = agentContext();
        }
        if (activeStage?.name === event.stage) {
          activeStage = null;
        }
        break;
      }

      case "llm_request_started": {
        turnLlmCalls++;
        const key = `${event.stage}-${event.model}`;
        const idx = steps.length;
        steps.push({
          id: `llm-${event.timestamp}`,
          type: "llm_call",
          label: `LLM: ${event.model}`,
          timestamp: event.timestamp,
          status: "running",
          agent: event.stage,
          detail: {
            model: event.model,
            prompt_summary: event.prompt_summary,
            tool_count: event.tool_count,
            stage: event.stage,
            agent_context: agentContext(),
          },
        });
        pendingLlm.set(key, idx);
        break;
      }

      case "llm_response_received": {
        const key = `${event.stage}-${event.model}`;
        const idx = pendingLlm.get(key);
        if (idx !== undefined) {
          steps[idx].status = "completed";
          steps[idx].durationMs = event.duration_ms;
          steps[idx].detail.tool_calls_count = event.tool_calls_count;
          steps[idx].detail.response_summary = event.response_summary;
          pendingLlm.delete(key);
        }
        // Update rolling LLM context
        lastLlm = {
          model: event.model,
          prompt: idx !== undefined ? (steps[idx].detail.prompt_summary as string) : undefined,
          reasoning: event.response_summary,
          tool_calls_requested: event.tool_calls_count,
        };
        // Update step's context with reasoning
        if (idx !== undefined) {
          steps[idx].detail.agent_context = agentContext();
        }
        break;
      }

      case "tool_triggered": {
        turnToolCalls++;
        const idx = steps.length;
        steps.push({
          id: `tool-${event.run_id}`,
          type: "tool_call",
          label: `Tool: ${event.tool_name}`,
          timestamp: event.timestamp,
          status: "running",
          agent: "executor",
          detail: {
            name: event.tool_name,
            run_id: event.run_id,
            inputs: event.inputs,
            agent_context: agentContext(),
          },
        });
        pendingTools.set(event.run_id, idx);
        break;
      }

      case "tool_completed": {
        const idx = pendingTools.get(event.run_id);
        if (idx !== undefined) {
          steps[idx].status = event.success ? "completed" : "failed";
          steps[idx].durationMs = event.duration_ms;
          steps[idx].detail.success = event.success;
          steps[idx].detail.result_summary = event.result_summary;
          steps[idx].detail.error = event.error;
          pendingTools.delete(event.run_id);
        }
        break;
      }

      case "skill_triggered": {
        turnSkillCalls++;
        const idx = steps.length;
        steps.push({
          id: `skill-${event.run_id}`,
          type: "skill_call",
          label: `Skill: ${event.skill_name}`,
          timestamp: event.timestamp,
          status: "running",
          agent: "executor",
          detail: {
            skill_id: event.skill_id,
            name: event.skill_name,
            run_id: event.run_id,
            inputs: event.inputs,
            invocation_mode: event.invocation_mode,
            agent_context: agentContext(),
          },
        });
        pendingSkills.set(event.run_id, idx);
        break;
      }

      case "skill_completed": {
        const idx = pendingSkills.get(event.run_id);
        if (idx !== undefined) {
          steps[idx].status = event.success ? "completed" : "failed";
          steps[idx].durationMs = event.duration_ms;
          steps[idx].detail.success = event.success;
          steps[idx].detail.result_summary = event.result_summary;
          steps[idx].detail.error = event.error;
          pendingSkills.delete(event.run_id);
        }
        break;
      }

      case "knowledge_search_started": {
        const idx = steps.length;
        steps.push({
          id: `knowledge-${event.timestamp}`,
          type: "knowledge_search",
          label: `Search: "${event.query.slice(0, 40)}${event.query.length > 40 ? "..." : ""}"`,
          timestamp: event.timestamp,
          status: "running",
          agent: "research",
          detail: {
            query: event.query,
            agent_id: event.agent_id,
            top_k: event.top_k,
            agent_context: agentContext(),
          },
        });
        pendingKnowledge.set(event.query, idx);
        break;
      }

      case "knowledge_search_completed": {
        const idx = pendingKnowledge.get(event.query);
        if (idx !== undefined) {
          steps[idx].status = event.error ? "failed" : "completed";
          steps[idx].durationMs = event.duration_ms;
          steps[idx].detail.results_count = event.results_count;
          steps[idx].detail.chunks = event.chunks;
          steps[idx].detail.error = event.error;
          pendingKnowledge.delete(event.query);
        }
        break;
      }

      case "response_generated": {
        // Track in conversation history
        conversationHistory.push({
          role: "assistant",
          content: `[Response: ${event.text_length} chars]`,
          timestamp: event.timestamp,
        });
        steps.push({
          id: `response-${event.timestamp}`,
          type: "response",
          label: `Response (${event.text_length} chars)`,
          timestamp: event.timestamp,
          status: "completed",
          detail: {
            text_length: event.text_length,
            has_surface_actions: event.has_surface_actions,
            triggered_skills_count: event.triggered_skills_count,
            auto_generated: event.auto_generated,
            agent_context: agentContext(),
          },
        });
        break;
      }

      case "error_occurred": {
        steps.push({
          id: `error-${event.timestamp}`,
          type: "error",
          label: `Error: ${event.error_code}`,
          timestamp: event.timestamp,
          status: "failed",
          agent: event.stage,
          detail: {
            error_code: event.error_code,
            error_message: event.error_message,
            recoverable: event.recoverable,
            stage: event.stage,
            skill_name: event.skill_name,
            agent_context: agentContext(),
          },
        });
        break;
      }

      case "state_changed": {
        steps.push({
          id: `state-${event.timestamp}`,
          type: "state_change",
          label: `${event.from} → ${event.to}`,
          timestamp: event.timestamp,
          status: "completed",
          detail: {
            from: event.from,
            to: event.to,
            reason: event.reason,
            agent_context: agentContext(),
          },
        });
        break;
      }

      default:
        break;
    }
  }

  detectParallelGroups(steps);
  return steps;
}
