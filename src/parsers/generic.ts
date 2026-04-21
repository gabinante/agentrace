/**
 * Generic JSON log parser.
 *
 * Accepts any JSON log entries with a `timestamp` field and optional
 * `type`, `name`, `status`, `duration_ms`, and `metadata` fields.
 * Useful as a starting point for custom integrations.
 */
import type { ReplayStep, ReplayStepType } from "../types";
import { detectParallelGroups } from "../utils/detectParallelGroups";

export interface GenericLogEntry {
  /** ISO timestamp (required) */
  timestamp: string;
  /** Event type — maps to ReplayStepType or defaults to "custom" */
  type?: string;
  /** Human-readable label */
  name?: string;
  /** Status */
  status?: "pending" | "running" | "completed" | "failed";
  /** Duration in milliseconds */
  duration_ms?: number;
  /** Agent/stage name */
  agent?: string;
  /** Parallel group identifier */
  parallel_group?: string;
  /** Any additional metadata */
  [key: string]: unknown;
}

const VALID_TYPES: Set<string> = new Set([
  "user_message",
  "intent_classification",
  "stage_transition",
  "llm_call",
  "tool_call",
  "skill_call",
  "knowledge_search",
  "response",
  "error",
  "state_change",
  "custom",
]);

/**
 * Parse generic JSON log entries into ReplayStep[].
 */
export function parseGenericJsonLogs(entries: GenericLogEntry[]): ReplayStep[] {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const steps: ReplayStep[] = sorted.map((entry, i) => {
    const type: ReplayStepType = VALID_TYPES.has(entry.type ?? "")
      ? (entry.type as ReplayStepType)
      : "custom";

    // Extract known fields, put the rest in detail
    const { timestamp, type: _, name, status, duration_ms, agent, parallel_group, ...rest } = entry;

    const step: ReplayStep = {
      id: `step-${i}-${timestamp}`,
      type,
      label: name ?? entry.type ?? `Step ${i + 1}`,
      timestamp,
      status: status ?? "completed",
      durationMs: duration_ms,
      agent,
      detail: rest,
    };

    if (parallel_group) {
      step.isParallel = true;
      step.parallelGroupId = parallel_group;
    }

    return step;
  });

  // Auto-detect parallel groups if not explicitly specified
  const hasExplicitGroups = steps.some((s) => s.parallelGroupId);
  if (!hasExplicitGroups) {
    detectParallelGroups(steps);
  }

  return steps;
}
