import { describe, it, expect } from "vitest";
import { parseMastermindEvents } from "../mastermind";
import type { MastermindEvent } from "../mastermind";

describe("parseMastermindEvents", () => {
  it("parses message_received into user_message step", () => {
    const events: MastermindEvent[] = [
      {
        type: "message_received",
        execution_id: "e1",
        turn_id: "t1",
        timestamp: "2026-01-01T00:00:00Z",
        surface: "chat",
        content_type: "text",
        content_preview: "Hello",
      },
    ];

    const steps = parseMastermindEvents(events);

    expect(steps).toHaveLength(1);
    expect(steps[0].type).toBe("user_message");
    expect(steps[0].detail.content_preview).toBe("Hello");
  });

  it("parses intent_classified", () => {
    const events: MastermindEvent[] = [
      {
        type: "intent_classified",
        execution_id: "e1",
        turn_id: "t1",
        timestamp: "2026-01-01T00:00:00Z",
        classification: {
          intent_type: "info_lookup",
          confidence: 0.95,
          needs_research: false,
          is_fast_path: true,
        },
      },
    ];

    const steps = parseMastermindEvents(events);

    expect(steps[0].type).toBe("intent_classification");
    expect(steps[0].detail.confidence).toBe(0.95);
  });

  it("pairs brain_stage_started/completed and updates status + duration", () => {
    const events: MastermindEvent[] = [
      {
        type: "brain_stage_started",
        execution_id: "e1",
        turn_id: "t1",
        timestamp: "2026-01-01T00:00:00Z",
        stage: "executor",
        input_summary: "Do something",
      },
      {
        type: "brain_stage_completed",
        execution_id: "e1",
        turn_id: "t1",
        timestamp: "2026-01-01T00:00:01Z",
        stage: "executor",
        output_summary: "Done",
        duration_ms: 1000,
      },
    ];

    const steps = parseMastermindEvents(events);

    expect(steps[0].status).toBe("completed");
    expect(steps[0].durationMs).toBe(1000);
    expect(steps[0].detail.output_summary).toBe("Done");
  });

  it("pairs llm_request_started/response_received", () => {
    const events: MastermindEvent[] = [
      {
        type: "llm_request_started",
        execution_id: "e1",
        turn_id: "t1",
        timestamp: "2026-01-01T00:00:00Z",
        stage: "executor",
        model: "gpt-4o",
        prompt_summary: "test prompt",
        tool_count: 3,
      },
      {
        type: "llm_response_received",
        execution_id: "e1",
        turn_id: "t1",
        timestamp: "2026-01-01T00:00:01Z",
        stage: "executor",
        model: "gpt-4o",
        response_summary: "done",
        tool_calls_count: 1,
        duration_ms: 1000,
      },
    ];

    const steps = parseMastermindEvents(events);

    expect(steps[0].type).toBe("llm_call");
    expect(steps[0].status).toBe("completed");
    expect(steps[0].durationMs).toBe(1000);
  });

  it("pairs tool_triggered/completed", () => {
    const events: MastermindEvent[] = [
      {
        type: "tool_triggered",
        execution_id: "e1",
        turn_id: "t1",
        timestamp: "2026-01-01T00:00:00Z",
        tool_name: "search",
        run_id: "r1",
        inputs: { q: "test" },
      },
      {
        type: "tool_completed",
        execution_id: "e1",
        turn_id: "t1",
        timestamp: "2026-01-01T00:00:01Z",
        tool_name: "search",
        run_id: "r1",
        success: true,
        result_summary: "Found 5 results",
        duration_ms: 500,
      },
    ];

    const steps = parseMastermindEvents(events);

    expect(steps[0].type).toBe("tool_call");
    expect(steps[0].status).toBe("completed");
    expect(steps[0].detail.result_summary).toBe("Found 5 results");
  });

  it("marks failed tools", () => {
    const events: MastermindEvent[] = [
      {
        type: "tool_triggered",
        execution_id: "e1",
        turn_id: "t1",
        timestamp: "2026-01-01T00:00:00Z",
        tool_name: "search",
        run_id: "r1",
      },
      {
        type: "tool_completed",
        execution_id: "e1",
        turn_id: "t1",
        timestamp: "2026-01-01T00:00:01Z",
        tool_name: "search",
        run_id: "r1",
        success: false,
        error: "timeout",
        duration_ms: 5000,
      },
    ];

    const steps = parseMastermindEvents(events);
    expect(steps[0].status).toBe("failed");
  });

  it("sorts events by timestamp regardless of input order", () => {
    const events: MastermindEvent[] = [
      {
        type: "response_generated",
        execution_id: "e1",
        turn_id: "t1",
        timestamp: "2026-01-01T00:00:02Z",
        text_length: 100,
        has_surface_actions: false,
        triggered_skills_count: 0,
        auto_generated: false,
      },
      {
        type: "message_received",
        execution_id: "e1",
        turn_id: "t1",
        timestamp: "2026-01-01T00:00:00Z",
        surface: "chat",
        content_type: "text",
        content_preview: "Hi",
      },
    ];

    const steps = parseMastermindEvents(events);

    expect(steps[0].type).toBe("user_message");
    expect(steps[1].type).toBe("response");
  });

  it("detects parallel tool calls", () => {
    const events: MastermindEvent[] = [
      {
        type: "tool_triggered",
        execution_id: "e1",
        turn_id: "t1",
        timestamp: "2026-01-01T00:00:00.000Z",
        tool_name: "a",
        run_id: "r1",
      },
      {
        type: "tool_triggered",
        execution_id: "e1",
        turn_id: "t1",
        timestamp: "2026-01-01T00:00:00.020Z",
        tool_name: "b",
        run_id: "r2",
      },
    ];

    const steps = parseMastermindEvents(events);

    expect(steps[0].isParallel).toBe(true);
    expect(steps[1].isParallel).toBe(true);
  });

  it("includes agent_context with system_prompt from agent_initialized", () => {
    const events: MastermindEvent[] = [
      {
        type: "agent_initialized",
        execution_id: "e1",
        timestamp: "2026-01-01T00:00:00Z",
        system_prompt: "You are helpful",
        available_tools: [{ name: "search", description: "Search the web" }],
      },
      {
        type: "message_received",
        execution_id: "e1",
        turn_id: "t1",
        timestamp: "2026-01-01T00:00:01Z",
        surface: "chat",
        content_type: "text",
        content_preview: "Hello",
      },
    ];

    const steps = parseMastermindEvents(events);

    // The message step should have agent_context with system_prompt
    const msgStep = steps.find((s) => s.type === "user_message")!;
    const ctx = msgStep.detail.agent_context as Record<string, unknown>;
    expect(ctx.system_prompt).toBe("You are helpful");
    expect(ctx.available_tools).toHaveLength(1);
  });

  it("tracks conversation history across turns", () => {
    const events: MastermindEvent[] = [
      {
        type: "message_received",
        execution_id: "e1",
        turn_id: "t1",
        timestamp: "2026-01-01T00:00:00Z",
        surface: "chat",
        content_type: "text",
        content_preview: "Hello",
      },
      {
        type: "response_generated",
        execution_id: "e1",
        turn_id: "t1",
        timestamp: "2026-01-01T00:00:01Z",
        text_length: 50,
        has_surface_actions: false,
        triggered_skills_count: 0,
        auto_generated: false,
      },
      {
        type: "message_received",
        execution_id: "e1",
        turn_id: "t2",
        timestamp: "2026-01-01T00:00:10Z",
        surface: "chat",
        content_type: "text",
        content_preview: "Follow up",
      },
    ];

    const steps = parseMastermindEvents(events);

    // The second message should have conversation history
    const secondMsg = steps.find(
      (s) => s.type === "user_message" && s.detail.content_preview === "Follow up",
    )!;
    const ctx = secondMsg.detail.agent_context as Record<string, unknown>;
    const history = ctx.conversation_history as Array<{ role: string; content: string }>;
    expect(history).toHaveLength(3);
    expect(history[0].role).toBe("user");
    expect(history[1].role).toBe("assistant");
    expect(history[2].role).toBe("user");
  });
});
