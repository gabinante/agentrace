# agentic-flow-replay

Turn agent logs into interactive flow visualizations. Replay agent executions step-by-step with parallel fork/join detection, timing-aware playback, and detailed step inspection.

![License](https://img.shields.io/badge/license-MIT-blue)

## What is this?

It's more than a log viewer — it's a **flow replay engine** for AI agents. It:

1. **Parses** structured agent logs (any format — bring your own parser)
2. **Detects** execution patterns like parallel tool calls, stage transitions, and error flows
3. **Visualizes** the execution as an animated directed graph with fork/join topology
4. **Replays** with timing-aware playback (respects inter-step delays, adjustable speed)

Think of it as a debugger's "step through" view for agent orchestration.

## Quick Start

```bash
npm install agentic-flow-replay
```

```tsx
import { ReplayViewer, parseMastermindEvents } from "agentic-flow-replay";

function AgentDebugger({ events }) {
  const steps = parseMastermindEvents(events);
  return <ReplayViewer steps={steps} height="600px" />;
}
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Raw Logs (any format)                          │
└──────────────────────┬──────────────────────────┘
                       │ Parser
                       ▼
┌─────────────────────────────────────────────────┐
│  ReplayStep[]  (universal intermediate format)  │
└──────────────────────┬──────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │FlowGraph │ │DetailPane│ │ Controls │
    └──────────┘ └──────────┘ └──────────┘
```

## Parsers

### Built-in

- **`parseMastermindEvents`** — Woflow Mastermind debug SSE events
- **`parseGenericJsonLogs`** — Any JSON with `timestamp` + optional `type`/`name`/`status` fields

### Custom Parser

```ts
import type { LogParser, ReplayStep } from "agentic-flow-replay";

const myParser: LogParser<MyLogEntry> = (logs) => {
  return logs.map((log, i) => ({
    id: `step-${i}`,
    type: "tool_call",
    label: log.toolName,
    timestamp: log.ts,
    status: log.error ? "failed" : "completed",
    durationMs: log.elapsed,
    detail: { ...log },
  }));
};
```

## Components

### `<ReplayViewer>`

All-in-one widget. Pass `steps` and you're done.

```tsx
<ReplayViewer steps={steps} height="80vh" />
```

### Individual components

For custom layouts, use the pieces directly:

```tsx
import { FlowGraph, DetailPanel, Controls, useReplayPlayback } from "agentic-flow-replay";

function Custom({ steps }) {
  const playback = useReplayPlayback(steps);
  const [selected, setSelected] = useState(null);

  return (
    <>
      <FlowGraph
        steps={steps}
        currentStepIndex={playback.currentStepIndex}
        selectedStepId={selected}
        onSelectStep={setSelected}
      />
      <DetailPanel step={steps.find(s => s.id === selected)} />
      <Controls {...playback} totalSteps={steps.length} />
    </>
  );
}
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Play / Pause |
| → | Step forward |
| ← | Step back |

## Features

- Timing-aware playback (respects real delays between events)
- Automatic parallel group detection (tool/skill calls within 100ms)
- Fork/join SVG connectors for parallel execution
- Click-to-inspect any step
- Adjustable speed (0.5x, 1x, 2x, 4x)
- Scrubber for random access
- Zero external dependencies (besides React)

## Development

```bash
git clone https://github.com/woflowinc/agentic-flow-replay
cd agentic-flow-replay
npm install
npm run dev    # Opens demo at localhost:5173
```

## License

MIT
