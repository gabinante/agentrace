import { createRoot } from "react-dom/client";
import { useCallback, useMemo, useState } from "react";
import { PrimeReactProvider } from "primereact/api";
import { Splitter, SplitterPanel } from "primereact/splitter";

// PrimeReact styles
import "primereact/resources/themes/soho-dark/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";

// Demo CSS (variables, animations, scrollbar, layout)
import "./demo.css";

// Library
import { useReplayPlayback } from "../src/hooks/useReplayPlayback";
import { parseMastermindEvents } from "../src/parsers/mastermind";
import { parseOTelSpans } from "../src/parsers/otel";
import type { MastermindEvent } from "../src/parsers/mastermind";
import { FlowGraph } from "../src/components/FlowGraph";
import { sampleEvents } from "./sampleData";
import { sampleOtelSpans } from "./sampleOtelData";

// Demo-specific PrimeReact components
import { DemoControls } from "./DemoControls";
import { DemoDetailPanel } from "./DemoDetailPanel";

type DataSource = "mastermind" | "otel";

const DATA_SOURCES: { key: DataSource; label: string }[] = [
  { key: "mastermind", label: "Mastermind" },
  { key: "otel", label: "OpenTelemetry" },
];

/** Agent color legend entries */
const AGENT_LEGEND: { name: string; color: string }[] = [
  { name: "Intake", color: "var(--afr-step-user-message)" },
  { name: "Reasoning", color: "var(--afr-step-llm-call)" },
  { name: "Executor", color: "var(--afr-step-tool-call)" },
  { name: "Research", color: "var(--afr-step-knowledge-search)" },
];

function App() {
  const [dataSource, setDataSource] = useState<DataSource>("mastermind");

  const steps = useMemo(() => {
    if (dataSource === "otel") {
      return parseOTelSpans(sampleOtelSpans);
    }
    return parseMastermindEvents(sampleEvents as MastermindEvent[]);
  }, [dataSource]);

  const playback = useReplayPlayback(steps);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const selectedStep = useMemo(
    () => steps.find((s) => s.id === selectedStepId) ?? null,
    [steps, selectedStepId],
  );

  const handleSelectStep = useCallback((id: string) => {
    setSelectedStepId((prev) => (prev === id ? null : id));
  }, []);

  const handleDataSourceChange = useCallback((source: DataSource) => {
    setDataSource(source);
    setSelectedStepId(null);
  }, []);

  // Compute total duration
  const totalDuration = useMemo(() => {
    const durations = steps.filter((s) => s.durationMs).map((s) => s.durationMs!);
    const total = durations.reduce((a, b) => a + b, 0);
    return total >= 1000 ? `${(total / 1000).toFixed(1)}s` : `${total}ms`;
  }, [steps]);

  return (
    <PrimeReactProvider>
      <div className="afr-demo-shell">
        {/* Header bar */}
        <div className="afr-demo-header">
          <h1>Agent Flow Replay</h1>

          {/* Data source toggle */}
          <div style={sourceToggleGroupStyle}>
            {DATA_SOURCES.map((ds) => (
              <button
                key={ds.key}
                type="button"
                onClick={() => handleDataSourceChange(ds.key)}
                style={
                  dataSource === ds.key
                    ? { ...sourceToggleBtnStyle, ...sourceToggleActiveStyle }
                    : sourceToggleBtnStyle
                }
              >
                {ds.label}
              </button>
            ))}
          </div>

          <span className="badge">Session abc-123</span>

          {/* Agent legend */}
          <div style={legendStyle}>
            {AGENT_LEGEND.map((a) => (
              <span key={a.name} style={legendItemStyle}>
                <span style={{ ...legendDotStyle, background: a.color }} />
                {a.name}
              </span>
            ))}
          </div>

          <span style={{ flex: 1 }} />

          {/* Summary badge */}
          <span className="badge" style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>
            {steps.length} steps &middot; {totalDuration} total
          </span>
        </div>

        {/* Main content: Splitter with flow graph + detail panel */}
        <div className="afr-demo-main">
          <Splitter style={{ width: "100%", height: "100%", border: "none" }}>
            <SplitterPanel size={65} minSize={30} style={{ overflow: "hidden" }}>
              <FlowGraph
                steps={steps}
                currentStepIndex={playback.currentStepIndex}
                selectedStepId={selectedStepId}
                onSelectStep={handleSelectStep}
              />
            </SplitterPanel>
            <SplitterPanel size={35} minSize={20} style={{ overflow: "hidden" }}>
              <DemoDetailPanel step={selectedStep} steps={steps} />
            </SplitterPanel>
          </Splitter>
        </div>

        {/* Controls bar */}
        <DemoControls
          currentStepIndex={playback.currentStepIndex}
          totalSteps={steps.length}
          isPlaying={playback.isPlaying}
          speed={playback.speed}
          play={playback.play}
          pause={playback.pause}
          stepForward={playback.stepForward}
          stepBack={playback.stepBack}
          seekTo={playback.seekTo}
          setSpeed={playback.setSpeed}
        />
      </div>
    </PrimeReactProvider>
  );
}

// ─── Header styles ────────────────────────────────────

const legendStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  marginLeft: 8,
};

const legendItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  fontSize: 12,
  color: "var(--afr-text-secondary)",
};

const legendDotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
};

const sourceToggleGroupStyle: React.CSSProperties = {
  display: "flex",
  borderRadius: 8,
  overflow: "hidden",
  border: "1px solid var(--afr-glass-border, rgba(205,214,244,0.08))",
};

const sourceToggleBtnStyle: React.CSSProperties = {
  padding: "4px 12px",
  fontSize: 11,
  fontWeight: 600,
  fontFamily: "ui-monospace, SFMono-Regular, monospace",
  background: "rgba(205, 214, 244, 0.04)",
  color: "var(--afr-text-secondary, #6c7086)",
  border: "none",
  borderRight: "1px solid var(--afr-glass-border, rgba(205,214,244,0.08))",
  cursor: "pointer",
  transition: "all 0.15s ease",
};

const sourceToggleActiveStyle: React.CSSProperties = {
  background: "rgba(137, 220, 235, 0.15)",
  color: "var(--afr-step-tool-call, #89dceb)",
  boxShadow: "inset 0 0 12px rgba(137, 220, 235, 0.1)",
};

createRoot(document.getElementById("root")!).render(<App />);
