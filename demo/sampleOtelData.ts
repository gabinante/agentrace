/**
 * Sample OpenTelemetry spans simulating a RAG-based agent flow.
 *
 * Scenario: User asks "What were our Q3 revenue numbers and how do they
 * compare to competitors?" — the agent classifies intent, searches a
 * knowledge base, calls an LLM for reasoning, runs two parallel tool
 * calls (financial data + competitor lookup), then generates a response.
 *
 * Uses GenAI semantic conventions + Langtrace-style attributes.
 */
import type { OTelSpan } from "../src/parsers/otel";

const TRACE_ID = "a1b2c3d4e5f60718a1b2c3d4e5f60718";

// Helpers for nanosecond timestamps
const BASE = new Date("2026-04-20T14:00:00.000Z").getTime();
function ns(offsetMs: number): string {
  return String((BASE + offsetMs) * 1_000_000);
}

export const sampleOtelSpans: OTelSpan[] = [
  // ─── Root span: agent workflow ───
  {
    traceId: TRACE_ID,
    spanId: "0001000000000001",
    name: "agent_workflow",
    kind: 1, // INTERNAL
    startTimeUnixNano: ns(0),
    endTimeUnixNano: ns(12500),
    status: { code: 1 },
    attributes: [
      { key: "agent.name", value: { stringValue: "research-agent" } },
      { key: "traceloop.span.kind", value: { stringValue: "workflow" } },
      { key: "user.query", value: { stringValue: "What were our Q3 revenue numbers and how do they compare to competitors?" } },
      // System prompt and tool catalog — carried on the root workflow span
      {
        key: "agent.system_prompt",
        value: {
          stringValue:
            "You are a senior financial research analyst with access to internal databases and market intelligence tools. " +
            "When answering questions: (1) Always verify claims against primary data sources using available tools. " +
            "(2) For financial figures, use the financial_data_api for precise, auditable numbers — never rely on memory alone. " +
            "(3) When comparing competitors, pull fresh data from competitor_analysis to avoid stale benchmarks. " +
            "(4) Present findings with supporting data points and cite the tool/source. " +
            "(5) If data is unavailable, clearly state the gap rather than estimating. " +
            "You have access to the company's Pinecone vector store for internal documents and three execution tools.",
        },
      },
      {
        key: "agent.available_tools",
        value: {
          stringValue: JSON.stringify([
            {
              name: "financial_data_api",
              description: "Query the internal financial data warehouse for revenue, margins, growth rates, and other KPIs by ticker, quarter, and metric type",
              parameters: {
                type: "object",
                properties: {
                  ticker: { type: "string", description: "Company ticker symbol (e.g., 'ACME')" },
                  quarter: { type: "string", description: "Quarter identifier (e.g., 'Q3-2026')" },
                  metrics: {
                    type: "array",
                    items: { type: "string" },
                    description: "Metrics to retrieve: revenue, growth, margin, ebitda, headcount",
                  },
                },
                required: ["ticker", "quarter", "metrics"],
              },
            },
            {
              name: "competitor_analysis",
              description: "Retrieve competitive intelligence including market share, positioning, and benchmark comparisons across a sector",
              parameters: {
                type: "object",
                properties: {
                  sector: { type: "string", description: "Industry sector (e.g., 'enterprise-saas')" },
                  quarter: { type: "string", description: "Quarter to analyze" },
                  competitors: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of competitor names to include",
                  },
                },
                required: ["sector", "quarter"],
              },
            },
            {
              name: "chart_generator",
              description: "Generate data visualizations (bar, line, pie charts) from structured data, output as SVG or PNG",
              parameters: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["bar", "line", "pie", "scatter"], description: "Chart type" },
                  data: { type: "string", description: "Data reference key or inline JSON" },
                  format: { type: "string", enum: ["svg", "png"], default: "svg" },
                  title: { type: "string", description: "Chart title" },
                },
                required: ["type", "data"],
              },
            },
          ]),
        },
      },
      {
        key: "agent.config",
        value: {
          stringValue: JSON.stringify({
            max_reasoning_steps: 5,
            parallel_tool_calls: true,
            vector_store: "pinecone",
            embedding_model: "text-embedding-3-large",
            primary_model: "claude-sonnet-4-5-20250514",
            fallback_model: "gpt-4o-mini",
            temperature: 0.3,
            max_tokens: 8192,
          }),
        },
      },
      // Conversation history — prior turns in this session
      {
        key: "agent.conversation_history",
        value: {
          stringValue: JSON.stringify([
            {
              role: "user",
              content: "Pull up the Q3 board deck summary",
              timestamp: "2026-04-20T13:45:00.000Z",
            },
            {
              role: "assistant",
              content: "Here's the Q3 board deck summary: Revenue reached $142.3M (+18.2% YoY), gross margin improved to 72.1%, and we added 847 net new enterprise customers. The full deck is available in the shared drive.",
              timestamp: "2026-04-20T13:45:12.000Z",
            },
            {
              role: "user",
              content: "What were our Q3 revenue numbers and how do they compare to competitors?",
              timestamp: "2026-04-20T14:00:00.000Z",
            },
          ]),
        },
      },
    ],
  },

  // ─── Intent classification (child of root) ───
  {
    traceId: TRACE_ID,
    spanId: "0001000000000002",
    parentSpanId: "0001000000000001",
    name: "classify_intent",
    kind: 1,
    startTimeUnixNano: ns(50),
    endTimeUnixNano: ns(320),
    status: { code: 1 },
    attributes: [
      { key: "agent.name", value: { stringValue: "intake" } },
      { key: "traceloop.span.kind", value: { stringValue: "chain" } },
      { key: "intent.type", value: { stringValue: "complex_analysis" } },
      { key: "intent.confidence", value: { doubleValue: 0.91 } },
      { key: "intent.requires_research", value: { boolValue: true } },
    ],
  },

  // ─── LLM call for intent classification ───
  {
    traceId: TRACE_ID,
    spanId: "0001000000000003",
    parentSpanId: "0001000000000002",
    name: "openai.chat",
    kind: 2, // CLIENT
    startTimeUnixNano: ns(80),
    endTimeUnixNano: ns(290),
    status: { code: 1 },
    attributes: [
      { key: "gen_ai.system", value: { stringValue: "openai" } },
      { key: "gen_ai.request.model", value: { stringValue: "gpt-4o-mini" } },
      { key: "gen_ai.operation.name", value: { stringValue: "chat" } },
      { key: "gen_ai.usage.input_tokens", value: { intValue: 145 } },
      { key: "gen_ai.usage.output_tokens", value: { intValue: 38 } },
      { key: "gen_ai.request.temperature", value: { doubleValue: 0 } },
      { key: "gen_ai.prompt", value: { stringValue: "Classify the following user query..." } },
      { key: "gen_ai.completion", value: { stringValue: "complex_analysis: requires financial data retrieval + competitive comparison" } },
      { key: "agent.name", value: { stringValue: "intake" } },
    ],
  },

  // ─── Knowledge retrieval stage ───
  {
    traceId: TRACE_ID,
    spanId: "0001000000000004",
    parentSpanId: "0001000000000001",
    name: "research_stage",
    kind: 1,
    startTimeUnixNano: ns(350),
    endTimeUnixNano: ns(2800),
    status: { code: 1 },
    attributes: [
      { key: "agent.name", value: { stringValue: "research" } },
      { key: "traceloop.span.kind", value: { stringValue: "agent" } },
      { key: "stage.goal", value: { stringValue: "Retrieve Q3 financial data and competitor benchmarks" } },
    ],
  },

  // ─── Vector search: Q3 revenue ───
  {
    traceId: TRACE_ID,
    spanId: "0001000000000005",
    parentSpanId: "0001000000000004",
    name: "vector_store.search",
    kind: 2,
    startTimeUnixNano: ns(400),
    endTimeUnixNano: ns(1100),
    status: { code: 1 },
    attributes: [
      { key: "agent.name", value: { stringValue: "research" } },
      { key: "traceloop.span.kind", value: { stringValue: "retrieval" } },
      { key: "retrieval.query", value: { stringValue: "Q3 2026 revenue numbers financial results" } },
      { key: "db.system", value: { stringValue: "pinecone" } },
      { key: "db.results_count", value: { intValue: 5 } },
      { key: "retrieval.top_k", value: { intValue: 10 } },
    ],
  },

  // ─── Vector search: competitor data (parallel with above — starts 20ms later) ───
  {
    traceId: TRACE_ID,
    spanId: "0001000000000006",
    parentSpanId: "0001000000000004",
    name: "vector_store.search",
    kind: 2,
    startTimeUnixNano: ns(420),
    endTimeUnixNano: ns(1350),
    status: { code: 1 },
    attributes: [
      { key: "agent.name", value: { stringValue: "research" } },
      { key: "traceloop.span.kind", value: { stringValue: "retrieval" } },
      { key: "retrieval.query", value: { stringValue: "competitor revenue comparison market share Q3" } },
      { key: "db.system", value: { stringValue: "pinecone" } },
      { key: "db.results_count", value: { intValue: 8 } },
      { key: "retrieval.top_k", value: { intValue: 10 } },
    ],
  },

  // ─── LLM: synthesize research findings ───
  {
    traceId: TRACE_ID,
    spanId: "0001000000000007",
    parentSpanId: "0001000000000004",
    name: "anthropic.chat",
    kind: 2,
    startTimeUnixNano: ns(1400),
    endTimeUnixNano: ns(2700),
    status: { code: 1 },
    attributes: [
      { key: "gen_ai.system", value: { stringValue: "anthropic" } },
      { key: "gen_ai.request.model", value: { stringValue: "claude-sonnet-4-5-20250514" } },
      { key: "gen_ai.operation.name", value: { stringValue: "chat" } },
      { key: "gen_ai.usage.input_tokens", value: { intValue: 3200 } },
      { key: "gen_ai.usage.output_tokens", value: { intValue: 890 } },
      { key: "gen_ai.request.temperature", value: { doubleValue: 0.3 } },
      { key: "gen_ai.prompt", value: { stringValue: "Synthesize the retrieved documents into a research brief..." } },
      { key: "gen_ai.completion", value: { stringValue: "Q3 revenue was $142M (+18% YoY). Key competitors: Acme ($128M), Beta Corp ($95M). Market share increased to 34%." } },
      { key: "agent.name", value: { stringValue: "research" } },
    ],
  },

  // ─── Executor stage ───
  {
    traceId: TRACE_ID,
    spanId: "0001000000000008",
    parentSpanId: "0001000000000001",
    name: "executor_stage",
    kind: 1,
    startTimeUnixNano: ns(2850),
    endTimeUnixNano: ns(8500),
    status: { code: 1 },
    attributes: [
      { key: "agent.name", value: { stringValue: "executor" } },
      { key: "traceloop.span.kind", value: { stringValue: "agent" } },
      { key: "stage.goal", value: { stringValue: "Execute data enrichment tools and prepare final analysis" } },
    ],
  },

  // ─── LLM: decide which tools to call ───
  {
    traceId: TRACE_ID,
    spanId: "0001000000000009",
    parentSpanId: "0001000000000008",
    name: "anthropic.chat",
    kind: 2,
    startTimeUnixNano: ns(2900),
    endTimeUnixNano: ns(4200),
    status: { code: 1 },
    attributes: [
      { key: "gen_ai.system", value: { stringValue: "anthropic" } },
      { key: "gen_ai.request.model", value: { stringValue: "claude-sonnet-4-5-20250514" } },
      { key: "gen_ai.operation.name", value: { stringValue: "chat" } },
      { key: "gen_ai.usage.input_tokens", value: { intValue: 4100 } },
      { key: "gen_ai.usage.output_tokens", value: { intValue: 245 } },
      { key: "gen_ai.request.temperature", value: { doubleValue: 0.1 } },
      { key: "gen_ai.prompt", value: { stringValue: "Given the research brief, determine which tools to call for data enrichment..." } },
      { key: "gen_ai.completion", value: { stringValue: "I'll call financial_data_api for precise numbers and competitor_analysis for market positioning." } },
      { key: "agent.name", value: { stringValue: "executor" } },
    ],
  },

  // ─── Tool: financial data API (parallel) ───
  {
    traceId: TRACE_ID,
    spanId: "000100000000000a",
    parentSpanId: "0001000000000008",
    name: "tool_call: financial_data_api",
    kind: 2,
    startTimeUnixNano: ns(4250),
    endTimeUnixNano: ns(5800),
    status: { code: 1 },
    attributes: [
      { key: "agent.name", value: { stringValue: "executor" } },
      { key: "traceloop.span.kind", value: { stringValue: "tool" } },
      { key: "tool.name", value: { stringValue: "financial_data_api" } },
      { key: "tool.input", value: { stringValue: "{\"ticker\": \"ACME\", \"quarter\": \"Q3-2026\", \"metrics\": [\"revenue\", \"growth\", \"margin\"]}" } },
      { key: "tool.output", value: { stringValue: "Revenue: $142.3M, YoY Growth: 18.2%, Gross Margin: 72.1%" } },
    ],
  },

  // ─── Tool: competitor analysis (parallel — starts 30ms after financial) ───
  {
    traceId: TRACE_ID,
    spanId: "000100000000000b",
    parentSpanId: "0001000000000008",
    name: "tool_call: competitor_analysis",
    kind: 2,
    startTimeUnixNano: ns(4280),
    endTimeUnixNano: ns(6200),
    status: { code: 1 },
    attributes: [
      { key: "agent.name", value: { stringValue: "executor" } },
      { key: "traceloop.span.kind", value: { stringValue: "tool" } },
      { key: "tool.name", value: { stringValue: "competitor_analysis" } },
      { key: "tool.input", value: { stringValue: "{\"sector\": \"enterprise-saas\", \"quarter\": \"Q3-2026\", \"competitors\": [\"Acme\", \"Beta Corp\", \"Gamma Inc\"]}" } },
      { key: "tool.output", value: { stringValue: "Market share: ACME 34% (+3pp), Acme 28% (-1pp), Beta 15% (flat), Gamma 8% (+1pp)" } },
    ],
  },

  // ─── Tool: chart generation ───
  {
    traceId: TRACE_ID,
    spanId: "000100000000000c",
    parentSpanId: "0001000000000008",
    name: "tool_call: chart_generator",
    kind: 2,
    startTimeUnixNano: ns(6300),
    endTimeUnixNano: ns(7100),
    status: { code: 1 },
    attributes: [
      { key: "agent.name", value: { stringValue: "executor" } },
      { key: "traceloop.span.kind", value: { stringValue: "tool" } },
      { key: "tool.name", value: { stringValue: "chart_generator" } },
      { key: "tool.input", value: { stringValue: "{\"type\": \"bar\", \"data\": \"revenue_comparison\", \"format\": \"svg\"}" } },
      { key: "tool.output", value: { stringValue: "Generated revenue comparison chart (3 companies, Q1-Q3 2026)" } },
    ],
  },

  // ─── LLM: final response synthesis ───
  {
    traceId: TRACE_ID,
    spanId: "000100000000000d",
    parentSpanId: "0001000000000008",
    name: "anthropic.chat",
    kind: 2,
    startTimeUnixNano: ns(7200),
    endTimeUnixNano: ns(8400),
    status: { code: 1 },
    attributes: [
      { key: "gen_ai.system", value: { stringValue: "anthropic" } },
      { key: "gen_ai.request.model", value: { stringValue: "claude-sonnet-4-5-20250514" } },
      { key: "gen_ai.operation.name", value: { stringValue: "chat" } },
      { key: "gen_ai.usage.input_tokens", value: { intValue: 5800 } },
      { key: "gen_ai.usage.output_tokens", value: { intValue: 1200 } },
      { key: "gen_ai.request.temperature", value: { doubleValue: 0.4 } },
      { key: "gen_ai.prompt", value: { stringValue: "Compose a comprehensive analysis using the financial data, competitor analysis, and chart..." } },
      { key: "gen_ai.completion", value: { stringValue: "Our Q3 2026 results show strong momentum with $142.3M revenue (+18.2% YoY)..." } },
      { key: "gen_ai.response.finish_reasons", value: { arrayValue: { values: [{ stringValue: "stop" }] } } },
      { key: "agent.name", value: { stringValue: "executor" } },
    ],
  },

  // ─── Response delivery ───
  {
    traceId: TRACE_ID,
    spanId: "000100000000000e",
    parentSpanId: "0001000000000001",
    name: "deliver_response",
    kind: 1,
    startTimeUnixNano: ns(8550),
    endTimeUnixNano: ns(8700),
    status: { code: 1 },
    attributes: [
      { key: "agent.name", value: { stringValue: "executor" } },
      { key: "response.text_length", value: { intValue: 1847 } },
      { key: "response.has_attachments", value: { boolValue: true } },
      { key: "response.attachment_count", value: { intValue: 1 } },
    ],
  },
];
