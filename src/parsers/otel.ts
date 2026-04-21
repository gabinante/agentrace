/**
 * OpenTelemetry span parser.
 *
 * Transforms OTel spans (OTLP JSON format) into ReplayStep[].
 * Supports:
 *   - GenAI semantic conventions (gen_ai.* attributes)
 *   - LangChain / LangGraph / LlamaIndex span patterns
 *   - Langtrace-instrumented spans
 *   - Generic spans with heuristic type detection
 *
 * Accepts spans in the OTLP JSON export format or a simplified
 * flat representation (see OTelSpan interface).
 */
import type { ReplayStep, ReplayStepType } from "../types";

// ─── Span Types ──────────────────────────────────────────────────────────────

/**
 * Simplified OTel span — accepts both OTLP JSON and flat key-value attributes.
 *
 * Users can pass raw OTLP JSON (with `attributes` as `{key, value}[]`) or
 * a pre-flattened object (with `attributes` as `Record<string, unknown>`).
 */
export interface OTelSpan {
  /** Trace ID (hex string) */
  traceId: string;
  /** Span ID (hex string) */
  spanId: string;
  /** Parent span ID (hex string, empty or absent for root spans) */
  parentSpanId?: string;
  /** Operation name */
  name: string;
  /** Span kind: INTERNAL, CLIENT, SERVER, PRODUCER, CONSUMER */
  kind?: number | string;
  /** Start time — nanosecond unix timestamp (string or number) or ISO string */
  startTimeUnixNano?: string | number;
  /** End time — nanosecond unix timestamp (string or number) or ISO string */
  endTimeUnixNano?: string | number;
  /** Alternative: ISO start time */
  startTime?: string;
  /** Alternative: ISO end time */
  endTime?: string;
  /** Span status */
  status?: {
    code?: number | string;
    message?: string;
  };
  /** Attributes — OTLP array format or flat key-value */
  attributes?: OTelAttribute[] | Record<string, unknown>;
  /** Span events (e.g. exceptions, log messages) */
  events?: OTelSpanEvent[];
}

/** OTLP attribute format */
interface OTelAttribute {
  key: string;
  value: {
    stringValue?: string;
    intValue?: string | number;
    doubleValue?: number;
    boolValue?: boolean;
    arrayValue?: { values: Array<{ stringValue?: string }> };
  };
}

/** OTel span event */
interface OTelSpanEvent {
  name: string;
  timeUnixNano?: string | number;
  attributes?: OTelAttribute[] | Record<string, unknown>;
}

/** Configuration for OTel parsing behavior */
export interface OTelParserOptions {
  /** Custom span-name → step-type mapping (checked before heuristics) */
  typeOverrides?: Record<string, ReplayStepType>;
  /** Attribute key used to identify the agent/stage (default: "agent.name") */
  agentAttribute?: string;
  /** Threshold in ms for detecting parallel spans (default: 100) */
  parallelThresholdMs?: number;
  /** Whether to include child spans inline or only show leaf spans (default: false — show all) */
  leafOnly?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Flatten OTLP attributes array into a plain object */
function flattenAttributes(
  attrs?: OTelAttribute[] | Record<string, unknown>,
): Record<string, unknown> {
  if (!attrs) return {};
  if (!Array.isArray(attrs)) return { ...attrs };

  const out: Record<string, unknown> = {};
  for (const attr of attrs) {
    const v = attr.value;
    if (v.stringValue !== undefined) out[attr.key] = v.stringValue;
    else if (v.intValue !== undefined) out[attr.key] = Number(v.intValue);
    else if (v.doubleValue !== undefined) out[attr.key] = v.doubleValue;
    else if (v.boolValue !== undefined) out[attr.key] = v.boolValue;
    else if (v.arrayValue)
      out[attr.key] = v.arrayValue.values.map((x) => x.stringValue ?? "");
  }
  return out;
}

/** Convert nanosecond timestamp (string/number) or ISO string to epoch ms */
function toEpochMs(t?: string | number): number | null {
  if (t === undefined || t === null) return null;
  if (typeof t === "string" && t.includes("T")) {
    return new Date(t).getTime();
  }
  return Number(t) / 1_000_000;
}

/** Convert epoch ms to ISO string */
function toISO(ms: number): string {
  return new Date(ms).toISOString();
}

/** OTel status code: 0 = UNSET, 1 = OK, 2 = ERROR */
function mapStatus(
  status?: OTelSpan["status"],
): "completed" | "failed" | "pending" {
  if (!status) return "completed";
  const code =
    typeof status.code === "string" ? parseInt(status.code, 10) : status.code;
  if (code === 2) return "failed";
  return "completed";
}

// ─── GenAI semantic convention keys ──────────────────────────────────────────

const GENAI_KEYS = {
  system: "gen_ai.system",
  model: "gen_ai.request.model",
  operation: "gen_ai.operation.name",
  inputTokens: "gen_ai.usage.input_tokens",
  outputTokens: "gen_ai.usage.output_tokens",
  finishReason: "gen_ai.response.finish_reasons",
  prompt: "gen_ai.prompt",
  completion: "gen_ai.completion",
  temperature: "gen_ai.request.temperature",
  maxTokens: "gen_ai.request.max_tokens",
  toolName: "gen_ai.tool.name",
} as const;

// ─── Type detection ──────────────────────────────────────────────────────────

/** Lowercase patterns → ReplayStepType */
const NAME_PATTERNS: [RegExp, ReplayStepType][] = [
  // LLM / GenAI
  [/^(chat|completion|generate|predict|invoke_llm)/i, "llm_call"],
  [/\bllm\b/i, "llm_call"],
  [/\bchat_model\b/i, "llm_call"],
  [/^openai\./i, "llm_call"],
  [/^anthropic\./i, "llm_call"],
  [/^bedrock\./i, "llm_call"],
  [/^cohere\./i, "llm_call"],
  [/^vertexai\./i, "llm_call"],
  // Tools
  [/\btool[_.]?(call|execute|run|invoke)\b/i, "tool_call"],
  [/^tool:/i, "tool_call"],
  [/\bfunction[_.]?call\b/i, "tool_call"],
  // Retrieval / knowledge
  [/\bretrieval?\b/i, "knowledge_search"],
  [/\bsearch\b/i, "knowledge_search"],
  [/\bvector[_.]?store\b/i, "knowledge_search"],
  [/\bembedding/i, "knowledge_search"],
  [/\brag\b/i, "knowledge_search"],
  // Chain / agent stages
  [/\bchain\b/i, "stage_transition"],
  [/\bagent[_.]?executor\b/i, "stage_transition"],
  [/\bworkflow\b/i, "stage_transition"],
  [/\bgraph\b/i, "stage_transition"],
  [/\bnode:/i, "stage_transition"],
  // Errors
  [/\berror\b/i, "error"],
  [/\bexception\b/i, "error"],
];

function detectStepType(
  name: string,
  attrs: Record<string, unknown>,
  overrides?: Record<string, ReplayStepType>,
): ReplayStepType {
  // Check explicit overrides first
  if (overrides?.[name]) return overrides[name];

  // GenAI attributes → llm_call
  if (attrs[GENAI_KEYS.system] || attrs[GENAI_KEYS.model]) {
    // Check if it's actually a tool call within an LLM context
    if (attrs[GENAI_KEYS.toolName]) return "tool_call";
    return "llm_call";
  }

  // Attribute-based detection: traceloop, langtrace, etc.
  const spanType = attrs["traceloop.span.kind"] ?? attrs["langtrace.span.kind"];
  if (spanType) {
    const st = String(spanType).toLowerCase();
    if (st === "llm" || st === "chat") return "llm_call";
    if (st === "tool") return "tool_call";
    if (st === "retrieval" || st === "embedding") return "knowledge_search";
    if (st === "agent" || st === "workflow" || st === "chain")
      return "stage_transition";
    if (st === "task") return "skill_call";
  }

  // Name pattern matching
  for (const [pattern, type] of NAME_PATTERNS) {
    if (pattern.test(name)) return type;
  }

  return "custom";
}

// ─── Label generation ────────────────────────────────────────────────────────

function makeLabel(
  type: ReplayStepType,
  name: string,
  attrs: Record<string, unknown>,
): string {
  switch (type) {
    case "llm_call": {
      const model = attrs[GENAI_KEYS.model] ?? attrs["llm.model"];
      return model ? `LLM: ${model}` : `LLM: ${name}`;
    }
    case "tool_call": {
      const toolName =
        attrs[GENAI_KEYS.toolName] ?? attrs["tool.name"] ?? name;
      return `Tool: ${toolName}`;
    }
    case "knowledge_search": {
      const query = attrs["db.query"] ?? attrs["retrieval.query"];
      if (query) {
        const q = String(query);
        return `Search: "${q.slice(0, 40)}${q.length > 40 ? "..." : ""}"`;
      }
      return `Search: ${name}`;
    }
    case "stage_transition":
      return name;
    case "error":
      return `Error: ${name}`;
    default:
      return name;
  }
}

// ─── Parser ──────────────────────────────────────────────────────────────────

/**
 * Transform OpenTelemetry spans into ReplayStep[].
 *
 * Accepts spans from OTLP JSON export, Jaeger, or any OTel-compatible
 * collector output. Also handles Langtrace, LangSmith, and other
 * OTel-based AI observability tools.
 */
export function parseOTelSpans(
  spans: OTelSpan[],
  options: OTelParserOptions = {},
): ReplayStep[] {
  const {
    typeOverrides,
    agentAttribute = "agent.name",
    parallelThresholdMs = 100,
    leafOnly = false,
  } = options;

  // Build parent→children map for hierarchy detection
  const childMap = new Map<string, string[]>();
  const spanById = new Map<string, OTelSpan>();
  for (const span of spans) {
    spanById.set(span.spanId, span);
    if (span.parentSpanId) {
      const children = childMap.get(span.parentSpanId) ?? [];
      children.push(span.spanId);
      childMap.set(span.parentSpanId, children);
    }
  }

  // If leafOnly, filter to spans that have no children
  const spansToProcess = leafOnly
    ? spans.filter((s) => !childMap.has(s.spanId))
    : spans;

  // Sort by start time
  const sorted = [...spansToProcess].sort((a, b) => {
    const aMs =
      toEpochMs(a.startTimeUnixNano) ??
      toEpochMs(a.startTime) ??
      0;
    const bMs =
      toEpochMs(b.startTimeUnixNano) ??
      toEpochMs(b.startTime) ??
      0;
    return aMs - bMs;
  });

  const steps: ReplayStep[] = [];

  // Track context across spans for the agent_context detail
  let currentTraceId: string | null = null;
  let lastLlmModel: string | null = null;
  let lastLlmPrompt: string | null = null;
  let llmCallCount = 0;
  let toolCallCount = 0;

  // Agent-level context extracted from root/workflow spans
  let systemPrompt: string | null = null;
  let availableTools: unknown[] | null = null;
  let agentConfigObj: Record<string, unknown> | null = null;
  let conversationHistory: unknown[] | null = null;

  for (const span of sorted) {
    const attrs = flattenAttributes(span.attributes);
    const type = detectStepType(span.name, attrs, typeOverrides);
    const label = makeLabel(type, span.name, attrs);

    const startMs =
      toEpochMs(span.startTimeUnixNano) ??
      toEpochMs(span.startTime) ??
      Date.now();
    const endMs =
      toEpochMs(span.endTimeUnixNano) ?? toEpochMs(span.endTime);
    const durationMs =
      endMs !== null ? Math.round(endMs - startMs) : undefined;
    const timestamp = toISO(startMs);

    // Reset context on new trace
    if (span.traceId !== currentTraceId) {
      currentTraceId = span.traceId;
      lastLlmModel = null;
      lastLlmPrompt = null;
      llmCallCount = 0;
      toolCallCount = 0;
      systemPrompt = null;
      availableTools = null;
      agentConfigObj = null;
      conversationHistory = null;
    }

    // Extract agent-level context from root/workflow spans
    if (attrs["agent.system_prompt"] && !systemPrompt) {
      systemPrompt = String(attrs["agent.system_prompt"]);
    }
    if (attrs["agent.available_tools"] && !availableTools) {
      try {
        availableTools = JSON.parse(String(attrs["agent.available_tools"]));
      } catch {
        availableTools = null;
      }
    }
    if (attrs["agent.config"] && !agentConfigObj) {
      try {
        agentConfigObj = JSON.parse(String(attrs["agent.config"]));
      } catch {
        agentConfigObj = null;
      }
    }
    if (attrs["agent.conversation_history"] && !conversationHistory) {
      try {
        conversationHistory = JSON.parse(String(attrs["agent.conversation_history"]));
      } catch {
        conversationHistory = null;
      }
    }

    // Track tallies
    if (type === "llm_call") llmCallCount++;
    if (type === "tool_call") toolCallCount++;

    // Build detail object
    const detail: Record<string, unknown> = {};

    // Include select attributes based on type
    switch (type) {
      case "llm_call": {
        const model = attrs[GENAI_KEYS.model] ?? attrs["llm.model"];
        if (model) detail.model = model;
        if (attrs[GENAI_KEYS.system]) detail.system = attrs[GENAI_KEYS.system];
        if (attrs[GENAI_KEYS.inputTokens])
          detail.input_tokens = attrs[GENAI_KEYS.inputTokens];
        if (attrs[GENAI_KEYS.outputTokens])
          detail.output_tokens = attrs[GENAI_KEYS.outputTokens];
        if (attrs[GENAI_KEYS.temperature])
          detail.temperature = attrs[GENAI_KEYS.temperature];
        if (attrs[GENAI_KEYS.maxTokens])
          detail.max_tokens = attrs[GENAI_KEYS.maxTokens];
        if (attrs[GENAI_KEYS.finishReason])
          detail.finish_reason = attrs[GENAI_KEYS.finishReason];
        if (attrs[GENAI_KEYS.prompt])
          detail.prompt_summary = attrs[GENAI_KEYS.prompt];
        if (attrs[GENAI_KEYS.completion])
          detail.response_summary = attrs[GENAI_KEYS.completion];
        // Update rolling context
        lastLlmModel = String(model ?? span.name);
        lastLlmPrompt = (attrs[GENAI_KEYS.prompt] as string) ?? null;
        break;
      }
      case "tool_call": {
        const toolName =
          attrs[GENAI_KEYS.toolName] ?? attrs["tool.name"] ?? span.name;
        detail.name = toolName;
        if (attrs["tool.input"]) detail.inputs = attrs["tool.input"];
        if (attrs["tool.output"]) detail.result_summary = attrs["tool.output"];
        break;
      }
      case "knowledge_search": {
        if (attrs["db.query"]) detail.query = attrs["db.query"];
        if (attrs["retrieval.query"]) detail.query = attrs["retrieval.query"];
        if (attrs["db.results_count"])
          detail.results_count = attrs["db.results_count"];
        if (attrs["retrieval.documents"])
          detail.chunks = attrs["retrieval.documents"];
        break;
      }
      default:
        break;
    }

    // Add any error info from span events
    const errorEvent = span.events?.find((e) => e.name === "exception");
    if (errorEvent) {
      const errorAttrs = flattenAttributes(errorEvent.attributes);
      detail.error_message =
        errorAttrs["exception.message"] ?? errorAttrs["exception.type"];
      if (errorAttrs["exception.stacktrace"])
        detail.stacktrace = errorAttrs["exception.stacktrace"];
    }

    // Build agent context
    const agentContext: Record<string, unknown> = {
      trace_id: span.traceId,
      span_id: span.spanId,
    };
    if (span.parentSpanId) agentContext.parent_span_id = span.parentSpanId;
    if (systemPrompt) agentContext.system_prompt = systemPrompt;
    if (availableTools) agentContext.available_tools = availableTools;
    if (agentConfigObj) agentContext.agent_config = agentConfigObj;
    if (conversationHistory) agentContext.conversation_history = conversationHistory;
    if (lastLlmModel) agentContext.llm_model = lastLlmModel;
    if (lastLlmPrompt) agentContext.llm_prompt = lastLlmPrompt;
    agentContext.llm_calls = llmCallCount;
    agentContext.tool_calls = toolCallCount;

    // Include children count for hierarchy awareness
    const children = childMap.get(span.spanId);
    if (children) agentContext.child_span_count = children.length;

    detail.agent_context = agentContext;

    // Add remaining attributes that weren't explicitly handled
    for (const [k, v] of Object.entries(attrs)) {
      if (!(k in detail) && !k.startsWith("gen_ai.")) {
        detail[k] = v;
      }
    }

    const agent = (attrs[agentAttribute] as string) ?? undefined;

    steps.push({
      id: `otel-${span.spanId}`,
      type,
      label,
      timestamp,
      durationMs,
      status: mapStatus(span.status),
      agent,
      detail,
    });
  }

  // Detect parallel spans: sibling spans under the same parent starting within threshold
  const parentGroups = new Map<string, number[]>();
  for (let i = 0; i < sorted.length; i++) {
    const parentId = sorted[i].parentSpanId;
    if (parentId) {
      const group = parentGroups.get(parentId) ?? [];
      group.push(i);
      parentGroups.set(parentId, group);
    }
  }

  let parallelGroupCounter = 0;
  for (const indices of parentGroups.values()) {
    if (indices.length < 2) continue;

    // Group siblings that start within the threshold
    const subgroups: number[][] = [];
    let current = [indices[0]];

    for (let j = 1; j < indices.length; j++) {
      const prevStart =
        toEpochMs(sorted[current[current.length - 1]].startTimeUnixNano) ??
        toEpochMs(sorted[current[current.length - 1]].startTime) ??
        0;
      const curStart =
        toEpochMs(sorted[indices[j]].startTimeUnixNano) ??
        toEpochMs(sorted[indices[j]].startTime) ??
        0;

      if (curStart - prevStart <= parallelThresholdMs) {
        current.push(indices[j]);
      } else {
        if (current.length > 1) subgroups.push(current);
        current = [indices[j]];
      }
    }
    if (current.length > 1) subgroups.push(current);

    for (const group of subgroups) {
      parallelGroupCounter++;
      const groupId = `otel-parallel-${parallelGroupCounter}`;
      for (const idx of group) {
        steps[idx].isParallel = true;
        steps[idx].parallelGroupId = groupId;
      }
    }
  }

  return steps;
}

// ─── OTLP JSON Helpers ───────────────────────────────────────────────────────

/**
 * Extract spans from OTLP JSON export format.
 * Handles the nested `resourceSpans[].scopeSpans[].spans[]` structure.
 */
export function extractSpansFromOTLP(otlpJson: OTLPExportPayload): OTelSpan[] {
  const spans: OTelSpan[] = [];

  for (const resourceSpan of otlpJson.resourceSpans ?? []) {
    // Capture resource attributes (e.g. service.name) for span enrichment
    const resourceAttrs = flattenAttributes(resourceSpan.resource?.attributes);

    for (const scopeSpan of resourceSpan.scopeSpans ?? []) {
      for (const span of scopeSpan.spans ?? []) {
        // Merge resource attributes as span-level context
        const spanAttrs = flattenAttributes(span.attributes);
        const merged = { ...resourceAttrs, ...spanAttrs };

        spans.push({
          ...span,
          attributes: merged,
        });
      }
    }
  }

  return spans;
}

/** OTLP JSON export payload structure */
export interface OTLPExportPayload {
  resourceSpans?: Array<{
    resource?: {
      attributes?: OTelAttribute[];
    };
    scopeSpans?: Array<{
      scope?: {
        name?: string;
        version?: string;
      };
      spans?: OTelSpan[];
    }>;
  }>;
}

/**
 * Convenience: parse OTLP JSON export payload directly into ReplayStep[].
 */
export function parseOTLPExport(
  otlpJson: OTLPExportPayload,
  options?: OTelParserOptions,
): ReplayStep[] {
  return parseOTelSpans(extractSpansFromOTLP(otlpJson), options);
}
