import type { ReplayStep, ReplayStepType } from "../types";

/**
 * Detect groups of steps that were triggered concurrently (within threshold ms).
 * Mutates the steps array in-place, setting isParallel and parallelGroupId.
 */
export function detectParallelGroups(
  steps: ReplayStep[],
  thresholdMs = 100,
  parallelTypes: ReplayStepType[] = ["tool_call", "skill_call"],
): void {
  let groupCounter = 0;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!parallelTypes.includes(step.type) || step.isParallel) continue;

    const stepTime = new Date(step.timestamp).getTime();
    const group: number[] = [i];

    for (let j = i + 1; j < steps.length; j++) {
      const candidate = steps[j];
      if (!parallelTypes.includes(candidate.type) || candidate.isParallel)
        continue;

      const candidateTime = new Date(candidate.timestamp).getTime();
      if (candidateTime - stepTime > thresholdMs) break;

      group.push(j);
    }

    if (group.length > 1) {
      groupCounter++;
      const groupId = `parallel-${groupCounter}`;
      for (const idx of group) {
        steps[idx].isParallel = true;
        steps[idx].parallelGroupId = groupId;
      }
    }
  }
}
