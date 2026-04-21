import { Slider } from "primereact/slider";
import type { PlaybackSpeed } from "../src/types";

interface DemoControlsProps {
  currentStepIndex: number;
  totalSteps: number;
  isPlaying: boolean;
  speed: PlaybackSpeed;
  play: () => void;
  pause: () => void;
  stepForward: () => void;
  stepBack: () => void;
  seekTo: (index: number) => void;
  setSpeed: (speed: PlaybackSpeed) => void;
}

const SPEEDS: PlaybackSpeed[] = [0.5, 1, 2, 4];

export function DemoControls({
  currentStepIndex,
  totalSteps,
  isPlaying,
  speed,
  play,
  pause,
  stepForward,
  stepBack,
  seekTo,
  setSpeed,
}: DemoControlsProps) {
  const displayIndex = Math.max(0, currentStepIndex + 1);

  return (
    <div style={controlsStyle}>
      <div style={transportStyle}>
        <button
          type="button"
          className="afr-transport-btn"
          onClick={stepBack}
          title="Step back (Left arrow)"
          style={transportBtnStyle}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="19 20 9 12 19 4 19 20" />
            <line x1="5" y1="19" x2="5" y2="5" />
          </svg>
        </button>

        <button
          type="button"
          className="afr-play-btn"
          onClick={isPlaying ? pause : play}
          title={isPlaying ? "Pause (Space)" : "Play (Space)"}
          style={playBtnStyle}
        >
          {isPlaying ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="5" y="3" width="5" height="18" rx="1" />
              <rect x="14" y="3" width="5" height="18" rx="1" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6 3 20 12 6 21 6 3" />
            </svg>
          )}
        </button>

        <button
          type="button"
          className="afr-transport-btn"
          onClick={stepForward}
          title="Step forward (Right arrow)"
          style={transportBtnStyle}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 4 15 12 5 20 5 4" />
            <line x1="19" y1="5" x2="19" y2="19" />
          </svg>
        </button>
      </div>

      <div style={scrubberContainerStyle}>
        <Slider
          value={Math.max(0, currentStepIndex)}
          min={0}
          max={Math.max(0, totalSteps - 1)}
          onChange={(e) => seekTo(e.value as number)}
          style={{ width: "100%" }}
        />
      </div>

      <span style={counterStyle}>
        {displayIndex} / {totalSteps}
      </span>

      <div style={speedGroupStyle} className="afr-speed-group">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            className={speed === s ? "afr-speed-active" : ""}
            onClick={() => setSpeed(s)}
            style={speed === s ? { ...speedBtnStyle, ...speedActiveStyle } : speedBtnStyle}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
}

const controlsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  padding: "12px 20px",
  borderTop: "1px solid var(--afr-glass-border, var(--afr-border))",
  background: "var(--afr-glass-bg, var(--afr-bg-secondary))",
  backdropFilter: "blur(var(--afr-glass-blur, 0px))",
  WebkitBackdropFilter: "blur(var(--afr-glass-blur, 0px))",
  flexShrink: 0,
};

const transportStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flexShrink: 0,
};

const transportBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 34,
  height: 34,
  borderRadius: 8,
  border: "1px solid var(--afr-glass-border, rgba(205,214,244,0.08))",
  background: "rgba(205, 214, 244, 0.05)",
  color: "var(--afr-text-secondary, #6c7086)",
  cursor: "pointer",
  transition: "all 0.2s ease",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
};

const playBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 42,
  height: 42,
  borderRadius: "50%",
  border: "1px solid rgba(137, 220, 235, 0.25)",
  background: "rgba(137, 220, 235, 0.12)",
  color: "var(--afr-step-tool-call, #89dceb)",
  cursor: "pointer",
  transition: "all 0.2s ease",
  boxShadow: "0 0 16px rgba(137, 220, 235, 0.15), inset 0 1px 0 rgba(255,255,255,0.06)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
};

const scrubberContainerStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  padding: "0 8px",
};

const counterStyle: React.CSSProperties = {
  fontSize: 11,
  fontFamily: "ui-monospace, SFMono-Regular, monospace",
  color: "var(--afr-text-secondary)",
  whiteSpace: "nowrap",
  flexShrink: 0,
  minWidth: 50,
  textAlign: "center",
};

const speedGroupStyle: React.CSSProperties = {
  display: "flex",
  flexShrink: 0,
  borderRadius: 8,
  overflow: "hidden",
  border: "1px solid var(--afr-glass-border, rgba(205,214,244,0.08))",
};

const speedBtnStyle: React.CSSProperties = {
  padding: "5px 12px",
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

const speedActiveStyle: React.CSSProperties = {
  background: "rgba(137, 220, 235, 0.15)",
  color: "var(--afr-step-tool-call, #89dceb)",
  boxShadow: "inset 0 0 12px rgba(137, 220, 235, 0.1)",
  borderRight: "1px solid var(--afr-glass-border, rgba(205,214,244,0.08))",
};
