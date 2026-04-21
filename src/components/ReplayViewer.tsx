import { useCallback, useMemo, useState } from "react";
import { useReplayPlayback } from "../hooks/useReplayPlayback";
import type { ReplayStep } from "../types";
import { Controls } from "./Controls";
import { DetailPanel } from "./DetailPanel";
import { FlowGraph } from "./FlowGraph";

interface ReplayViewerProps {
  /** Pre-parsed replay steps. Use a parser to convert raw logs first. */
  steps: ReplayStep[];
  /** Optional: container height (default "600px") */
  height?: string | number;
}

/**
 * Full replay viewer component.
 * Combines FlowGraph, DetailPanel, and Controls into a single widget.
 */
export function ReplayViewer({ steps, height = "600px" }: ReplayViewerProps) {
  const playback = useReplayPlayback(steps);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const selectedStep = useMemo(
    () => steps.find((s) => s.id === selectedStepId) ?? null,
    [steps, selectedStepId],
  );

  const handleSelectStep = useCallback((id: string) => {
    setSelectedStepId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div role="region" aria-label="Agent trace replay viewer" style={{ ...containerStyle, height }}>
      <div style={layoutStyle}>
        <FlowGraph
          steps={steps}
          currentStepIndex={playback.currentStepIndex}
          selectedStepId={selectedStepId}
          onSelectStep={handleSelectStep}
        />
        <DetailPanel step={selectedStep} />
      </div>
      <Controls
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
      <style>{`
        @keyframes afr-spin { to { transform: rotate(360deg); } }
        @keyframes afr-glow-pulse {
          0%, 100% { box-shadow: 0 0 6px 2px var(--afr-glow-color, rgba(59,130,246,0.3)); }
          50% { box-shadow: 0 0 14px 4px var(--afr-glow-color, rgba(59,130,246,0.5)); }
        }
        @keyframes afr-node-enter {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  border: "1px solid var(--afr-border, #e2e8f0)",
  borderRadius: 8,
  background: "var(--afr-bg-primary, white)",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const layoutStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  overflow: "hidden",
  minHeight: 0,
};
