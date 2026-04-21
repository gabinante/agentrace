import type { PlaybackSpeed } from "../types";

interface ControlsProps {
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

export function Controls({
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
}: ControlsProps) {
  const displayIndex = Math.max(0, currentStepIndex + 1);

  return (
    <nav aria-label="Playback controls" style={controlsStyle}>
      <div style={transportStyle} role="group" aria-label="Transport">
        <button
          type="button"
          style={transportBtnStyle}
          onClick={stepBack}
          aria-label="Step back"
          title="Step back (Left arrow)"
        >
          ⏮
        </button>
        <button
          type="button"
          style={playBtnStyle}
          onClick={isPlaying ? pause : play}
          aria-label={isPlaying ? "Pause playback" : "Play from start"}
          title={isPlaying ? "Pause (Space)" : "Play (Space)"}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>
        <button
          type="button"
          style={transportBtnStyle}
          onClick={stepForward}
          aria-label="Step forward"
          title="Step forward (Right arrow)"
        >
          ⏭
        </button>
      </div>

      <div style={scrubberContainerStyle}>
        <input
          type="range"
          style={scrubberStyle}
          min={0}
          max={Math.max(0, totalSteps - 1)}
          value={Math.max(0, currentStepIndex)}
          onChange={(e) => seekTo(Number(e.target.value))}
          aria-label="Seek to step"
          aria-valuemin={0}
          aria-valuemax={totalSteps - 1}
          aria-valuenow={Math.max(0, currentStepIndex)}
          aria-valuetext={`Step ${displayIndex} of ${totalSteps}`}
        />
      </div>

      <span style={counterStyle} aria-live="polite">
        {displayIndex} / {totalSteps}
      </span>

      <div style={speedGroupStyle} role="group" aria-label="Playback speed">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            style={speed === s ? { ...speedBtnStyle, ...speedActiveStyle } : speedBtnStyle}
            onClick={() => setSpeed(s)}
            aria-label={`Set speed to ${s}x`}
            aria-pressed={speed === s}
          >
            {s}x
          </button>
        ))}
      </div>
    </nav>
  );
}

const controlsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "10px 16px",
  borderTop: "1px solid var(--afr-border, #e2e8f0)",
  background: "var(--afr-bg-primary, white)",
  flexShrink: 0,
};

const transportStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  flexShrink: 0,
};

const transportBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  borderRadius: 6,
  border: "1px solid var(--afr-border, #e2e8f0)",
  background: "var(--afr-bg-surface, white)",
  color: "var(--afr-text-primary, #525a66)",
  cursor: "pointer",
  fontSize: 14,
};

const playBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 36,
  height: 36,
  borderRadius: "50%",
  border: "1px solid var(--afr-border, #e2e8f0)",
  background: "var(--afr-text-primary, #1d262c)",
  color: "var(--afr-bg-primary, white)",
  cursor: "pointer",
  fontSize: 16,
};

const scrubberContainerStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
};

const scrubberStyle: React.CSSProperties = {
  width: "100%",
  height: 4,
  cursor: "pointer",
};

const counterStyle: React.CSSProperties = {
  fontSize: 11,
  fontFamily: "ui-monospace, SFMono-Regular, monospace",
  color: "var(--afr-text-secondary, #9ca3af)",
  whiteSpace: "nowrap",
  flexShrink: 0,
  minWidth: 50,
  textAlign: "center",
};

const speedGroupStyle: React.CSSProperties = {
  display: "flex",
  gap: 2,
  flexShrink: 0,
};

const speedBtnStyle: React.CSSProperties = {
  padding: "2px 8px",
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 500,
  background: "var(--afr-bg-secondary, #f1f5f9)",
  color: "var(--afr-text-secondary, #475569)",
  border: "1px solid transparent",
  cursor: "pointer",
};

const speedActiveStyle: React.CSSProperties = {
  background: "var(--afr-text-primary, #1d262c)",
  color: "var(--afr-bg-primary, white)",
};
