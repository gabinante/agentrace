import { describe, it, expect } from "vitest";
import { parseOTelSpans, extractSpansFromOTLP, parseOTLPExport } from "../otel";
import type { OTelSpan, OTLPExportPayload } from "../otel";

function makeSpan(overrides: Partial<OTelSpan> = {}): OTelSpan {
  return {
    traceId: "abc123",
    spanId: `span-${Math.random().toString(36).slice(2)}`,
    name: "test_span",
    startTimeUnixNano: String(1700000000000 * 1_000_000),
    endTimeUnixNano: String(1700000001000 * 1_000_000),
    status: { code: 1 },
    attributes: [],
    ...overrides,
  };
}

describe("parseOTelSpans", () => {
  it("detects llm_call from GenAI attributes", () => {
    const spans: OTelSpan[] = [
      makeSpan({
        name: "chat",
        attributes: [
          { key: "gen_ai.system", value: { stringValue: "openai" } },
          { key: "gen_ai.request.model", value: { stringValue: "gpt-4o" } },
          { key: "gen_ai.usage.input_tokens", value: { intValue: 100 } },
          { key: "gen_ai.usage.output_tokens", value: { intValue: 50 } },
        ],
      }),
    ];

    const steps = parseOTelSpans(spans);

    expect(steps).toHaveLength(1);
    expect(steps[0].type).toBe("llm_call");
    expect(steps[0].label).toBe("LLM: gpt-4o");
    expect(steps[0].detail.input_tokens).toBe(100);
  });

  it("detects tool_call from traceloop.span.kind", () => {
    const spans: OTelSpan[] = [
      makeSpan({
        name: "my_tool",
        attributes: [
          { key: "traceloop.span.kind", value: { stringValue: "tool" } },
          { key: "tool.name", value: { stringValue: "search" } },
        ],
      }),
    ];

    const steps = parseOTelSpans(spans);

    expect(steps[0].type).toBe("tool_call");
    expect(steps[0].label).toBe("Tool: search");
  });

  it("detects knowledge_search from name patterns", () => {
    const spans: OTelSpan[] = [
      makeSpan({
        name: "vector_store.search",
        attributes: [{ key: "retrieval.query", value: { stringValue: "test query" } }],
      }),
    ];

    const steps = parseOTelSpans(spans);

    expect(steps[0].type).toBe("knowledge_search");
  });

  it("respects typeOverrides", () => {
    const spans: OTelSpan[] = [makeSpan({ name: "my_custom_span" })];

    const steps = parseOTelSpans(spans, {
      typeOverrides: { my_custom_span: "skill_call" },
    });

    expect(steps[0].type).toBe("skill_call");
  });

  it("detects parallel siblings under same parent", () => {
    const base = 1700000000000;
    const spans: OTelSpan[] = [
      makeSpan({
        spanId: "parent",
        name: "workflow",
        startTimeUnixNano: String(base * 1_000_000),
        endTimeUnixNano: String((base + 5000) * 1_000_000),
      }),
      makeSpan({
        spanId: "child-a",
        parentSpanId: "parent",
        name: "tool_call: a",
        startTimeUnixNano: String((base + 100) * 1_000_000),
        endTimeUnixNano: String((base + 1000) * 1_000_000),
      }),
      makeSpan({
        spanId: "child-b",
        parentSpanId: "parent",
        name: "tool_call: b",
        startTimeUnixNano: String((base + 120) * 1_000_000),
        endTimeUnixNano: String((base + 1200) * 1_000_000),
      }),
    ];

    const steps = parseOTelSpans(spans);

    const childA = steps.find((s) => s.id === "otel-child-a")!;
    const childB = steps.find((s) => s.id === "otel-child-b")!;
    expect(childA.isParallel).toBe(true);
    expect(childB.isParallel).toBe(true);
    expect(childA.parallelGroupId).toBe(childB.parallelGroupId);
  });

  it("does not parallelize siblings outside threshold", () => {
    const base = 1700000000000;
    const spans: OTelSpan[] = [
      makeSpan({
        spanId: "parent",
        name: "workflow",
        startTimeUnixNano: String(base * 1_000_000),
        endTimeUnixNano: String((base + 5000) * 1_000_000),
      }),
      makeSpan({
        spanId: "child-a",
        parentSpanId: "parent",
        name: "tool_call: a",
        startTimeUnixNano: String((base + 100) * 1_000_000),
        endTimeUnixNano: String((base + 1000) * 1_000_000),
      }),
      makeSpan({
        spanId: "child-b",
        parentSpanId: "parent",
        name: "tool_call: b",
        startTimeUnixNano: String((base + 5000) * 1_000_000),
        endTimeUnixNano: String((base + 6000) * 1_000_000),
      }),
    ];

    const steps = parseOTelSpans(spans);

    const childA = steps.find((s) => s.id === "otel-child-a")!;
    const childB = steps.find((s) => s.id === "otel-child-b")!;
    expect(childA.isParallel).toBeUndefined();
    expect(childB.isParallel).toBeUndefined();
  });

  it("handles leafOnly option", () => {
    const base = 1700000000000;
    const spans: OTelSpan[] = [
      makeSpan({
        spanId: "parent",
        name: "workflow",
        startTimeUnixNano: String(base * 1_000_000),
      }),
      makeSpan({
        spanId: "child",
        parentSpanId: "parent",
        name: "openai.chat",
        startTimeUnixNano: String((base + 100) * 1_000_000),
        attributes: [{ key: "gen_ai.request.model", value: { stringValue: "gpt-4o" } }],
      }),
    ];

    const steps = parseOTelSpans(spans, { leafOnly: true });

    expect(steps).toHaveLength(1);
    expect(steps[0].id).toBe("otel-child");
  });

  it("flattens OTLP array attributes", () => {
    const spans: OTelSpan[] = [
      makeSpan({
        attributes: [
          { key: "str", value: { stringValue: "hello" } },
          { key: "num", value: { intValue: 42 } },
          { key: "dbl", value: { doubleValue: 3.14 } },
          { key: "bool", value: { boolValue: true } },
        ],
      }),
    ];

    const steps = parseOTelSpans(spans);

    expect(steps[0].detail.str).toBe("hello");
    expect(steps[0].detail.num).toBe(42);
    expect(steps[0].detail.dbl).toBe(3.14);
    expect(steps[0].detail.bool).toBe(true);
  });

  it("handles flat record attributes", () => {
    const spans: OTelSpan[] = [
      makeSpan({
        attributes: { "my.attr": "value" } as unknown as OTelSpan["attributes"],
      }),
    ];

    const steps = parseOTelSpans(spans);
    expect(steps[0].detail["my.attr"]).toBe("value");
  });

  it("maps error status correctly", () => {
    const spans: OTelSpan[] = [makeSpan({ status: { code: 2, message: "fail" } })];

    const steps = parseOTelSpans(spans);
    expect(steps[0].status).toBe("failed");
  });

  it("calculates duration from start/end timestamps", () => {
    const base = 1700000000000;
    const spans: OTelSpan[] = [
      makeSpan({
        startTimeUnixNano: String(base * 1_000_000),
        endTimeUnixNano: String((base + 1500) * 1_000_000),
      }),
    ];

    const steps = parseOTelSpans(spans);
    expect(steps[0].durationMs).toBe(1500);
  });

  it("extracts agent context with system_prompt from root span", () => {
    const spans: OTelSpan[] = [
      makeSpan({
        name: "workflow",
        attributes: [
          { key: "traceloop.span.kind", value: { stringValue: "workflow" } },
          { key: "agent.system_prompt", value: { stringValue: "You are helpful" } },
          {
            key: "agent.available_tools",
            value: { stringValue: JSON.stringify([{ name: "search" }]) },
          },
        ],
      }),
    ];

    const steps = parseOTelSpans(spans);
    const ctx = steps[0].detail.agent_context as Record<string, unknown>;
    expect(ctx.system_prompt).toBe("You are helpful");
    expect(ctx.available_tools).toEqual([{ name: "search" }]);
  });
});

describe("extractSpansFromOTLP", () => {
  it("extracts spans from nested OTLP structure", () => {
    const payload: OTLPExportPayload = {
      resourceSpans: [
        {
          resource: {
            attributes: [{ key: "service.name", value: { stringValue: "my-agent" } }],
          },
          scopeSpans: [
            {
              spans: [
                makeSpan({ spanId: "s1", name: "test" }),
                makeSpan({ spanId: "s2", name: "test2" }),
              ],
            },
          ],
        },
      ],
    };

    const spans = extractSpansFromOTLP(payload);

    expect(spans).toHaveLength(2);
    // Resource attributes should be merged into span attributes
    const attrs = spans[0].attributes as Record<string, unknown>;
    expect(attrs["service.name"]).toBe("my-agent");
  });
});

describe("parseOTLPExport", () => {
  it("end-to-end: parses OTLP payload into ReplaySteps", () => {
    const payload: OTLPExportPayload = {
      resourceSpans: [
        {
          scopeSpans: [
            {
              spans: [
                makeSpan({
                  name: "openai.chat",
                  attributes: [{ key: "gen_ai.request.model", value: { stringValue: "gpt-4o" } }],
                }),
              ],
            },
          ],
        },
      ],
    };

    const steps = parseOTLPExport(payload);

    expect(steps).toHaveLength(1);
    expect(steps[0].type).toBe("llm_call");
  });
});
