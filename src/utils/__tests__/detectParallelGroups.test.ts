import { describe, it, expect } from "vitest";
import { detectParallelGroups } from "../detectParallelGroups";
import type { ReplayStep } from "../../types";

function makeStep(overrides: Partial<ReplayStep> = {}): ReplayStep {
  return {
    id: `step-${Math.random()}`,
    type: "tool_call",
    label: "Tool: test",
    timestamp: "2026-01-01T00:00:00.000Z",
    status: "completed",
    detail: {},
    ...overrides,
  };
}

describe("detectParallelGroups", () => {
  it("groups two tool_call steps within threshold", () => {
    const steps = [
      makeStep({ id: "a", timestamp: "2026-01-01T00:00:00.000Z" }),
      makeStep({ id: "b", timestamp: "2026-01-01T00:00:00.050Z" }),
    ];

    detectParallelGroups(steps, 100);

    expect(steps[0].isParallel).toBe(true);
    expect(steps[1].isParallel).toBe(true);
    expect(steps[0].parallelGroupId).toBe(steps[1].parallelGroupId);
  });

  it("does not group steps outside threshold", () => {
    const steps = [
      makeStep({ id: "a", timestamp: "2026-01-01T00:00:00.000Z" }),
      makeStep({ id: "b", timestamp: "2026-01-01T00:00:01.000Z" }),
    ];

    detectParallelGroups(steps, 100);

    expect(steps[0].isParallel).toBeUndefined();
    expect(steps[1].isParallel).toBeUndefined();
  });

  it("only considers specified parallelTypes", () => {
    const steps = [
      makeStep({ id: "a", type: "llm_call", timestamp: "2026-01-01T00:00:00.000Z" }),
      makeStep({ id: "b", type: "llm_call", timestamp: "2026-01-01T00:00:00.050Z" }),
    ];

    detectParallelGroups(steps, 100, ["tool_call"]);

    expect(steps[0].isParallel).toBeUndefined();
    expect(steps[1].isParallel).toBeUndefined();
  });

  it("groups three or more steps", () => {
    const steps = [
      makeStep({ id: "a", timestamp: "2026-01-01T00:00:00.000Z" }),
      makeStep({ id: "b", timestamp: "2026-01-01T00:00:00.020Z" }),
      makeStep({ id: "c", timestamp: "2026-01-01T00:00:00.040Z" }),
    ];

    detectParallelGroups(steps, 100);

    expect(steps[0].isParallel).toBe(true);
    expect(steps[1].isParallel).toBe(true);
    expect(steps[2].isParallel).toBe(true);
    expect(steps[0].parallelGroupId).toBe(steps[2].parallelGroupId);
  });

  it("creates separate groups for distinct clusters", () => {
    const steps = [
      makeStep({ id: "a", timestamp: "2026-01-01T00:00:00.000Z" }),
      makeStep({ id: "b", timestamp: "2026-01-01T00:00:00.050Z" }),
      makeStep({ id: "c", type: "llm_call", timestamp: "2026-01-01T00:00:01.000Z" }),
      makeStep({ id: "d", timestamp: "2026-01-01T00:00:02.000Z" }),
      makeStep({ id: "e", timestamp: "2026-01-01T00:00:02.050Z" }),
    ];

    detectParallelGroups(steps, 100);

    expect(steps[0].parallelGroupId).toBeDefined();
    expect(steps[3].parallelGroupId).toBeDefined();
    expect(steps[0].parallelGroupId).not.toBe(steps[3].parallelGroupId);
  });

  it("does not mark a single step as parallel", () => {
    const steps = [makeStep({ id: "a" })];

    detectParallelGroups(steps, 100);

    expect(steps[0].isParallel).toBeUndefined();
  });

  it("skips already-parallel steps", () => {
    const steps = [
      makeStep({
        id: "a",
        timestamp: "2026-01-01T00:00:00.000Z",
        isParallel: true,
        parallelGroupId: "existing",
      }),
      makeStep({ id: "b", timestamp: "2026-01-01T00:00:00.050Z" }),
    ];

    detectParallelGroups(steps, 100);

    expect(steps[0].parallelGroupId).toBe("existing");
    expect(steps[1].isParallel).toBeUndefined();
  });
});
