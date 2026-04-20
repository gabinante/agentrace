/**
 * Parser for Mastermind-style debug events (SSE stream format).
 *
 * This is the reference parser — it transforms the event format used by
 * Woflow's Mastermind agent orchestrator into ReplayStep[].
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

  for (const event of sorted) {
    switch (event.type) {
      case "message_received": {
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
          },
        });
        break;
      }

      case "brain_stage_started": {
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
        }
        break;
      }

      case "llm_request_started": {
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
        break;
      }

      case "tool_triggered": {
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
