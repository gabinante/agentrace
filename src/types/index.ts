/**
 * Core types for agentic-flow-replay.
 *
 * These types are framework-agnostic — any log format can be parsed into
 * ReplayStep[] via a parser function.
 */

export type ReplayStepType =
  | "user_message"
  | "intent_classification"
  | "stage_transition"
  | "llm_call"
  | "tool_call"
  | "skill_call"
  | "knowledge_search"
  | "response"
  | "error"
  | "state_change"
  | "custom";

export type ReplayStepStatus = "pending" | "running" | "completed" | "failed";

export interface ReplayStep {
  /** Unique identifier for this step */
  id: string;
  /** Step type — determines color coding and detail rendering */
  type: ReplayStepType;
  /** Short human-readable label shown on the node */
  label: string;
  /** ISO timestamp */
  timestamp: string;
  /** Duration in milliseconds (if known) */
  durationMs?: number;
  /** Current status */
  status: ReplayStepStatus;
  /** Agent/stage that performed this step */
  agent?: string;
  /** Arbitrary detail metadata shown in the detail panel */
  detail: Record<string, unknown>;
  /** Whether this step runs in parallel with siblings */
  isParallel?: boolean;
  /** Group ID for parallel steps */
  parallelGroupId?: string;
}

/**
 * A parser function transforms raw log data into ReplayStep[].
 * Implement this interface to support any log format.
 */
export type LogParser<T = unknown> = (logs: T[]) => ReplayStep[];

/**
 * Configuration for the replay viewer appearance.
 */
export interface ReplayTheme {
  /** Border colors by step type */
  borderColors?: Partial<Record<ReplayStepType, string>>;
  /** Background colors by step type */
  bgColors?: Partial<Record<ReplayStepType, string>>;
}

/**
 * Playback speed options.
 */
export type PlaybackSpeed = 0.5 | 1 | 2 | 4;
