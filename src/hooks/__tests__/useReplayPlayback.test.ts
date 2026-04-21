import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useReplayPlayback } from "../useReplayPlayback";
import type { ReplayStep } from "../../types";

function makeSteps(count: number): ReplayStep[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `step-${i}`,
    type: "tool_call" as const,
    label: `Step ${i}`,
    timestamp: new Date(Date.now() + i * 1000).toISOString(),
    status: "completed" as const,
    detail: {},
  }));
}

describe("useReplayPlayback", () => {
  it("initializes with currentStepIndex at end (full trace visible)", () => {
    const steps = makeSteps(5);
    const { result } = renderHook(() => useReplayPlayback(steps));

    expect(result.current.currentStepIndex).toBe(4);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.speed).toBe(1);
  });

  it("returns -1 for empty steps", () => {
    const { result } = renderHook(() => useReplayPlayback([]));
    expect(result.current.currentStepIndex).toBe(-1);
  });

  it("play() resets to index 0 and starts playing", () => {
    const steps = makeSteps(5);
    const { result } = renderHook(() => useReplayPlayback(steps));

    act(() => result.current.play());

    expect(result.current.currentStepIndex).toBe(0);
    expect(result.current.isPlaying).toBe(true);
  });

  it("pause() stops playing", () => {
    const steps = makeSteps(5);
    const { result } = renderHook(() => useReplayPlayback(steps));

    act(() => result.current.play());
    act(() => result.current.pause());

    expect(result.current.isPlaying).toBe(false);
  });

  it("stepForward() increments and stops playing", () => {
    const steps = makeSteps(5);
    const { result } = renderHook(() => useReplayPlayback(steps));

    // Start at 0
    act(() => result.current.play());
    act(() => result.current.stepForward());

    expect(result.current.currentStepIndex).toBe(1);
    expect(result.current.isPlaying).toBe(false);
  });

  it("stepForward() clamps at max index", () => {
    const steps = makeSteps(3);
    const { result } = renderHook(() => useReplayPlayback(steps));

    // Already at end (index 2)
    act(() => result.current.stepForward());

    expect(result.current.currentStepIndex).toBe(2);
  });

  it("stepBack() decrements and stops playing", () => {
    const steps = makeSteps(5);
    const { result } = renderHook(() => useReplayPlayback(steps));

    // At index 4, step back to 3
    act(() => result.current.stepBack());

    expect(result.current.currentStepIndex).toBe(3);
    expect(result.current.isPlaying).toBe(false);
  });

  it("stepBack() clamps at 0", () => {
    const steps = makeSteps(3);
    const { result } = renderHook(() => useReplayPlayback(steps));

    act(() => result.current.play()); // go to 0
    act(() => result.current.stepBack());

    expect(result.current.currentStepIndex).toBe(0);
  });

  it("seekTo() jumps to a specific index", () => {
    const steps = makeSteps(10);
    const { result } = renderHook(() => useReplayPlayback(steps));

    act(() => result.current.seekTo(5));

    expect(result.current.currentStepIndex).toBe(5);
  });

  it("seekTo() clamps to valid range", () => {
    const steps = makeSteps(5);
    const { result } = renderHook(() => useReplayPlayback(steps));

    act(() => result.current.seekTo(100));
    expect(result.current.currentStepIndex).toBe(4);

    act(() => result.current.seekTo(-5));
    expect(result.current.currentStepIndex).toBe(0);
  });

  it("setSpeed() updates speed", () => {
    const steps = makeSteps(5);
    const { result } = renderHook(() => useReplayPlayback(steps));

    act(() => result.current.setSpeed(2));
    expect(result.current.speed).toBe(2);

    act(() => result.current.setSpeed(0.5));
    expect(result.current.speed).toBe(0.5);
  });

  it("resets to end when steps change", () => {
    const steps3 = makeSteps(3);
    const steps5 = makeSteps(5);

    const { result, rerender } = renderHook(({ s }) => useReplayPlayback(s), {
      initialProps: { s: steps3 },
    });

    expect(result.current.currentStepIndex).toBe(2);

    rerender({ s: steps5 });

    expect(result.current.currentStepIndex).toBe(4);
    expect(result.current.isPlaying).toBe(false);
  });
});
