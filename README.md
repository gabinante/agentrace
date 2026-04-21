# agentrace

[![CI](https://github.com/gabinante/agentrace/actions/workflows/ci.yml/badge.svg)](https://github.com/gabinante/agentrace/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue)](https://www.typescriptlang.org/)

Turn agent logs into interactive flow visualizations. Framework-agnostic log parsing with React replay components.

Parse structured logs from any AI agent framework into a universal step format, then visualize them as an interactive flow graph with playback controls, parallel execution detection, and a detail panel.

## Quick Start

```bash
npm install github:gabinante/agentrace
```

```tsx
import { FlowGraph, useReplayPlayback, parseOTelSpans } from "agentrace";

function AgentReplay({ spans }) {
  const steps = parseOTelSpans(spans);
  const playback = useReplayPlayback(steps);
  const [selectedId, setSelectedId] = useState(null);

  return (
    <>
      <FlowGraph
        steps={steps}
        currentStepIndex={playback.currentStepIndex}
        selectedStepId={selectedId}
        onSelectStep={setSelectedId}
      />
      <button onClick={playback.play}>Play</button>
    </>
  );
}
```

## Architecture

```
Raw agent logs ──> Parser ──> ReplayStep[] ──> React components
                   │                            │
                   ├─ parseOTelSpans()           ├─ FlowGraph
                   ├─ parseGenericJsonLogs()     ├─ DetailPanel
                   └─ parseMastermindEvents()    ├─ Controls
                                                 └─ ReplayViewer (all-in-one)
```

The library separates **parsing** (converting logs into `ReplayStep[]`) from **rendering** (React components that consume steps). This means you can use any log format — write a parser once, get the full visualization for free.

## Parsers

### OpenTelemetry (`parseOTelSpans`)

The recommended path for most teams. Accepts OTel spans and automatically detects step types from:

- **GenAI semantic conventions** (`gen_ai.request.model`, `gen_ai.usage.*`, etc.)
- **Langtrace / Traceloop attributes** (`traceloop.span.kind`)
- **Span name patterns** (e.g. `openai.chat` -> LLM call, `tool_call:*` -> tool call)
- **Parent-child relationships** for parallel execution detection

```tsx
import { parseOTelSpans, parseOTLPExport } from "agentrace";

// From flat spans (Jaeger, custom collector, Langtrace export)
const steps = parseOTelSpans(spans);

// From OTLP JSON export format (otel-collector output)
const steps = parseOTLPExport(otlpPayload);

// With options
const steps = parseOTelSpans(spans, {
  typeOverrides: { "my_custom_span": "skill_call" },
  agentAttribute: "service.name",    // attribute key for agent badges
  parallelThresholdMs: 100,          // max gap for parallel detection
  leafOnly: true,                    // only show leaf spans
});
```

**Supported OTel span sources:**

| Source | How to use |
|--------|-----------|
| OTLP JSON export | `parseOTLPExport(payload)` — handles nested `resourceSpans[].scopeSpans[].spans[]` |
| Jaeger / Zipkin | `parseOTelSpans(spans)` — pass flat span array |
| Langtrace | `parseOTelSpans(spans)` — `traceloop.span.kind` auto-detected |
| LangSmith | Export as OTel, then `parseOTelSpans(spans)` |

### Generic JSON (`parseGenericJsonLogs`)

For custom structured logs. Accepts any JSON with a `timestamp` field:

```tsx
import { parseGenericJsonLogs } from "agentrace";

const steps = parseGenericJsonLogs([
  {
    timestamp: "2026-01-01T00:00:00Z",
    type: "llm_call",           // maps to step type + color
    name: "LLM: gpt-4o",       // node label
    status: "completed",
    duration_ms: 1200,
    agent: "reasoning",         // agent badge
    model: "gpt-4o",            // goes into detail panel
    prompt: "Analyze the data", // goes into detail panel
  },
  // ...
]);
```

**Step types and what they render as:**

| Type | Color | Use for |
|------|-------|---------|
| `user_message` | Blue | User input, messages received |
| `llm_call` | Orange | LLM inference calls |
| `tool_call` | Teal | Tool/function execution |
| `skill_call` | Green | Higher-level skill invocations |
| `knowledge_search` | Yellow | RAG retrieval, vector search |
| `stage_transition` | Purple | Pipeline stage changes |
| `intent_classification` | Purple | Intent/routing decisions |
| `response` | Green | Final response generation |
| `error` | Red | Errors and exceptions |
| `state_change` | Blue | State machine transitions |
| `custom` | Gray | Anything else |

### Writing a Custom Parser

Implement a function that returns `ReplayStep[]`:

```tsx
import type { ReplayStep } from "agentrace";

function parseMyLogs(logs: MyLogEntry[]): ReplayStep[] {
  return logs.map((log, i) => ({
    id: `step-${i}`,
    type: "tool_call",              // determines color
    label: `Tool: ${log.toolName}`, // shown on node
    timestamp: log.ts,              // ISO string, used for playback timing
    status: log.ok ? "completed" : "failed",
    durationMs: log.elapsed,
    agent: log.stage,               // optional agent badge
    detail: {                       // shown in detail panel
      name: log.toolName,
      inputs: log.args,
      result_summary: log.result,
    },
  }));
}
```

## Components

### `FlowGraph`

The main visualization. Renders steps as a vertical flow with connectors and parallel groups.

```tsx
<FlowGraph
  steps={steps}
  currentStepIndex={playback.currentStepIndex}
  selectedStepId={selectedId}
  onSelectStep={(id) => setSelectedId(id)}
  borderColors={{ tool_call: "#22d3ee" }}  // optional color overrides
  bgColors={{ tool_call: "rgba(34,211,238,0.1)" }}
/>
```

### `useReplayPlayback`

Hook that manages playback state. Returns transport controls and current position.

```tsx
const {
  currentStepIndex, // number — current position
  isPlaying,        // boolean
  speed,            // 0.5 | 1 | 2 | 4
  play,             // () => void — starts from beginning
  pause,            // () => void
  stepForward,      // () => void
  stepBack,         // () => void
  seekTo,           // (index: number) => void
  setSpeed,         // (speed: PlaybackSpeed) => void
} = useReplayPlayback(steps);
```

The default view shows the entire trace. Pressing play replays from the beginning with timing-aware delays derived from step timestamps, scaled by the speed multiplier.

### `ReplayViewer`

All-in-one component that combines FlowGraph, DetailPanel, and Controls:

```tsx
import { ReplayViewer } from "agentrace";

<ReplayViewer steps={steps} />
```

### `DetailPanel` & `Controls`

Available separately for custom layouts:

```tsx
import { DetailPanel, Controls } from "agentrace";
```

## Theming

All colors use CSS custom properties with light-mode fallbacks. Set `--afr-*` variables to theme:

```css
:root {
  --afr-bg-primary: #ffffff;
  --afr-bg-secondary: #f8fafc;
  --afr-bg-surface: #ffffff;
  --afr-border: #e2e8f0;
  --afr-text-primary: #1d262c;
  --afr-text-secondary: #9ca3af;
  --afr-connector: #e2e8f0;

  /* Step type colors */
  --afr-step-user-message: #475569;
  --afr-step-llm-call: #92400e;
  --afr-step-tool-call: #0891b2;
  --afr-step-skill-call: #047857;
  --afr-step-error: #dc2626;
  --afr-step-stage-transition: #7c3aed;
  --afr-step-knowledge-search: #a16207;
  --afr-step-response: #047857;
  --afr-step-state-change: #1d4ed8;
  --afr-step-custom: #6b7280;
}
```

## Features

- **Full trace on load** — The entire execution is visible immediately; press play to animate from the beginning
- **Parallel execution detection** — Sibling spans/steps starting within a configurable threshold are grouped with curved fan-out/fan-in connectors
- **Timing-aware playback** — Step delays match the original execution timing, with 0.5x-4x speed control
- **Keyboard shortcuts** — Space (play/pause), Left/Right arrows (step)
- **Agent context tracking** — Parsers build a rolling context snapshot (active stage, LLM model, reasoning chain, call tallies) attached to every step
- **Zero runtime dependencies** — Only `react` as a peer dependency, no CSS framework required

## Detail Panel Fields

The detail panel renders the step's `detail` object. Certain keys get special treatment:

| Key | Behavior |
|-----|----------|
| `agent_context` | Rendered as a dedicated "Agent Context" section |
| `name` | Used as a type badge on the node |
| `result_summary` | Shown as the node subtitle |
| `content_preview` | Shown as the node subtitle |
| `input_summary` | Shown as the node subtitle |
| `prompt_summary` | Shown as the node subtitle |
| `error_message` | Shown as the node subtitle |

## Integration Examples

### With OpenTelemetry Collector

Export spans as OTLP JSON and parse:

```tsx
const response = await fetch("/api/traces/my-trace-id");
const otlpJson = await response.json();
const steps = parseOTLPExport(otlpJson);
```

### With Langtrace

Langtrace exports standard OTel spans with `traceloop.span.kind` attributes:

```tsx
const spans = await langtrace.getTraceSpans(traceId);
const steps = parseOTelSpans(spans);
```

### With Custom Structured Logging

Add structured log calls to your agent code, then parse with `parseGenericJsonLogs()`:

```python
# Python agent code
import json
from datetime import datetime

def log_step(step_type, name, **kwargs):
    print(json.dumps({
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "type": step_type,
        "name": name,
        **kwargs
    }))

log_step("llm_call", "LLM: claude-sonnet", model="claude-sonnet-4-5-20250514", status="running")
# ... call LLM ...
log_step("tool_call", "Tool: search", name="vector_search", status="completed", duration_ms=450)
```

## Development

```bash
git clone https://github.com/gabinante/agentrace
cd agentrace
npm install
npm run dev    # Opens demo at localhost:5173
```

The demo includes sample data for both Mastermind (custom event format) and OpenTelemetry (GenAI semantic conventions) with a toggle to switch between them.

## License

MIT
