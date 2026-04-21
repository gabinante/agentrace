import { describe, it, expect } from "vitest";
import { parseGenericJsonLogs } from "../generic";

describe("parseGenericJsonLogs", () => {
  it("parses minimal entries with just a timestamp", () => {
    const steps = parseGenericJsonLogs([{ timestamp: "2026-01-01T00:00:00Z" }]);

    expect(steps).toHaveLength(1);
    expect(steps[0].type).toBe("custom");
    expect(steps[0].status).toBe("completed");
    expect(steps[0].timestamp).toBe("2026-01-01T00:00:00Z");
  });

  it("maps valid types correctly", () => {
    const steps = parseGenericJsonLogs([
      { timestamp: "2026-01-01T00:00:00Z", type: "llm_call", name: "LLM test" },
      { timestamp: "2026-01-01T00:00:01Z", type: "tool_call", name: "Tool test" },
    ]);

    expect(steps[0].type).toBe("llm_call");
    expect(steps[1].type).toBe("tool_call");
  });

  it("falls back to custom for invalid types", () => {
    const steps = parseGenericJsonLogs([
      { timestamp: "2026-01-01T00:00:00Z", type: "not_a_real_type" },
    ]);

    expect(steps[0].type).toBe("custom");
  });

  it("sorts by timestamp", () => {
    const steps = parseGenericJsonLogs([
      { timestamp: "2026-01-01T00:00:02Z", name: "second" },
      { timestamp: "2026-01-01T00:00:01Z", name: "first" },
    ]);

    expect(steps[0].label).toBe("first");
    expect(steps[1].label).toBe("second");
  });

  it("sets isParallel from explicit parallel_group", () => {
    const steps = parseGenericJsonLogs([
      { timestamp: "2026-01-01T00:00:00Z", parallel_group: "pg-1" },
      { timestamp: "2026-01-01T00:00:00Z", parallel_group: "pg-1" },
    ]);

    expect(steps[0].isParallel).toBe(true);
    expect(steps[0].parallelGroupId).toBe("pg-1");
  });

  it("puts extra metadata fields in detail", () => {
    const steps = parseGenericJsonLogs([
      {
        timestamp: "2026-01-01T00:00:00Z",
        name: "test",
        custom_field: "hello",
        another: 42,
      },
    ]);

    expect(steps[0].detail.custom_field).toBe("hello");
    expect(steps[0].detail.another).toBe(42);
  });

  it("uses name as label and falls back to type", () => {
    const withName = parseGenericJsonLogs([{ timestamp: "2026-01-01T00:00:00Z", name: "My Step" }]);
    const withType = parseGenericJsonLogs([
      { timestamp: "2026-01-01T00:00:00Z", type: "llm_call" },
    ]);

    expect(withName[0].label).toBe("My Step");
    expect(withType[0].label).toBe("llm_call");
  });

  it("auto-detects parallel groups when no explicit groups given", () => {
    const steps = parseGenericJsonLogs([
      { timestamp: "2026-01-01T00:00:00.000Z", type: "tool_call", name: "a" },
      { timestamp: "2026-01-01T00:00:00.050Z", type: "tool_call", name: "b" },
    ]);

    expect(steps[0].isParallel).toBe(true);
    expect(steps[1].isParallel).toBe(true);
  });
});
