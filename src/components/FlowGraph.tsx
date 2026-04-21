import { forwardRef, useEffect, useRef } from "react";
import type { ReplayStep, ReplayStepType } from "../types";

const DEFAULT_BORDER_COLORS: Record<ReplayStepType, string> = {
  user_message: "var(--afr-step-user-message, #475569)",
  intent_classification: "var(--afr-step-intent-classification, #7c3aed)",
  stage_transition: "var(--afr-step-stage-transition, #7c3aed)",
  llm_call: "var(--afr-step-llm-call, #92400e)",
  tool_call: "var(--afr-step-tool-call, #0891b2)",
  skill_call: "var(--afr-step-skill-call, #047857)",
  knowledge_search: "var(--afr-step-knowledge-search, #a16207)",
  response: "var(--afr-step-response, #047857)",
  error: "var(--afr-step-error, #dc2626)",
  state_change: "var(--afr-step-state-change, #1d4ed8)",
  custom: "var(--afr-step-custom, #6b7280)",
};

const DEFAULT_BG_COLORS: Record<ReplayStepType, string> = {
  user_message: "rgba(137,180,250,0.08)",
  intent_classification: "rgba(203,166,247,0.08)",
  stage_transition: "rgba(203,166,247,0.08)",
  llm_call: "rgba(250,179,135,0.08)",
  tool_call: "rgba(137,220,235,0.08)",
  skill_call: "rgba(166,227,161,0.08)",
  knowledge_search: "rgba(249,226,175,0.08)",
  response: "rgba(166,227,161,0.08)",
  error: "rgba(243,139,168,0.08)",
  state_change: "rgba(137,180,250,0.08)",
  custom: "rgba(108,112,134,0.08)",
};

/** Extract a subtitle from the detail record */
function getSubtitle(step: ReplayStep): string | null {
  const d = step.detail;
  return (
    (d.content_preview as string) ??
    (d.result_summary as string) ??
    (d.input_summary as string) ??
    (d.output_summary as string) ??
    (d.prompt_summary as string) ??
    (d.response_summary as string) ??
    (d.reason as string) ??
    (d.error_message as string) ??
    null
  );
}

/** Format duration for display */
function formatDuration(ms?: number): string | null {
  if (ms === undefined) return null;
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

interface FlowGraphProps {
  steps: ReplayStep[];
  currentStepIndex: number;
  selectedStepId: string | null;
  onSelectStep: (id: string) => void;
  borderColors?: Partial<Record<ReplayStepType, string>>;
  bgColors?: Partial<Record<ReplayStepType, string>>;
}

export function FlowGraph({
  steps,
  currentStepIndex,
  selectedStepId,
  onSelectStep,
  borderColors,
  bgColors,
}: FlowGraphProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  const colors = { ...DEFAULT_BORDER_COLORS, ...borderColors };
  const bgs = { ...DEFAULT_BG_COLORS, ...bgColors };

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [currentStepIndex]);

  const visibleSteps = steps.slice(0, currentStepIndex + 1);
  const rendered: React.ReactNode[] = [];
  let i = 0;

  while (i < visibleSteps.length) {
    const step = visibleSteps[i];
    const isActive = i === currentStepIndex;
    const isSelected = step.id === selectedStepId;

    if (step.isParallel && step.parallelGroupId) {
      const groupId = step.parallelGroupId;
      const groupSteps: { step: ReplayStep; idx: number }[] = [];
      while (i < visibleSteps.length && visibleSteps[i].parallelGroupId === groupId) {
        groupSteps.push({ step: visibleSteps[i], idx: i });
        i++;
      }

      rendered.push(
        <div
          key={groupId}
          role="group"
          aria-label="Parallel execution group"
          style={parallelGroupStyle}
        >
          {/* Fan-out: center top → each branch with curved paths */}
          <div style={connectorStyle}>
            <svg
              width="100%"
              height={PARALLEL_CONNECTOR_H}
              viewBox={`0 0 200 ${PARALLEL_CONNECTOR_H}`}
              preserveAspectRatio="none"
              style={{ overflow: "visible" }}
            >
              {groupSteps.map((_, gi) => {
                const x = getParallelX(gi, groupSteps.length);
                return (
                  <path
                    key={gi}
                    d={fanOutPath(x, PARALLEL_CONNECTOR_H)}
                    fill="none"
                    stroke="var(--afr-connector, #e2e8f0)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    filter="url(#afr-glow)"
                  />
                );
              })}
            </svg>
          </div>
          <div style={parallelNodesStyle}>
            {groupSteps.map(({ step: gs, idx: gi }) => (
              <StepNode
                key={gs.id}
                step={gs}
                isActive={gi === currentStepIndex}
                isSelected={gs.id === selectedStepId}
                onClick={() => onSelectStep(gs.id)}
                ref={gi === currentStepIndex ? activeRef : undefined}
                borderColor={colors[gs.type]}
                bgColor={bgs[gs.type]}
              />
            ))}
          </div>
          {/* Fan-in: each branch → center bottom with curved paths */}
          <div style={connectorStyle}>
            <svg
              width="100%"
              height={PARALLEL_CONNECTOR_H}
              viewBox={`0 0 200 ${PARALLEL_CONNECTOR_H}`}
              preserveAspectRatio="none"
              style={{ overflow: "visible" }}
            >
              {groupSteps.map((_, gi) => {
                const x = getParallelX(gi, groupSteps.length);
                return (
                  <path
                    key={gi}
                    d={fanInPath(x, PARALLEL_CONNECTOR_H)}
                    fill="none"
                    stroke="var(--afr-connector, #e2e8f0)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    filter="url(#afr-glow)"
                  />
                );
              })}
            </svg>
          </div>
        </div>,
      );
    } else {
      rendered.push(
        <div key={step.id} role="listitem" style={sequentialNodeStyle}>
          {i > 0 && (
            <svg
              aria-hidden="true"
              width="100%"
              height={SEQ_CONNECTOR_H}
              viewBox={`0 0 200 ${SEQ_CONNECTOR_H}`}
              preserveAspectRatio="none"
              style={{ flexShrink: 0, display: "block", overflow: "visible" }}
            >
              <path
                d={`M100,0 L100,${SEQ_CONNECTOR_H}`}
                fill="none"
                stroke="var(--afr-connector, #e2e8f0)"
                strokeWidth="2"
                strokeLinecap="round"
                filter="url(#afr-glow)"
              />
            </svg>
          )}
          <StepNode
            step={step}
            isActive={isActive}
            isSelected={isSelected}
            onClick={() => onSelectStep(step.id)}
            ref={isActive ? activeRef : undefined}
            borderColor={colors[step.type]}
            bgColor={bgs[step.type]}
          />
        </div>,
      );
      i++;
    }
  }

  return (
    <div ref={scrollRef} role="list" aria-label="Agent execution steps" style={flowGraphStyle}>
      {/* Shared SVG filter definition — referenced by all connectors */}
      <svg aria-hidden="true" width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <filter id="afr-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>
      {rendered.length === 0 && <p style={emptyStateStyle}>Press Play to start the replay</p>}
      {rendered}
    </div>
  );
}

const StepNode = forwardRef<
  HTMLButtonElement,
  {
    step: ReplayStep;
    isActive: boolean;
    isSelected: boolean;
    onClick: () => void;
    borderColor: string;
    bgColor: string;
  }
>(function StepNode({ step, isActive, isSelected, onClick, borderColor, bgColor }, ref) {
  const subtitle = getSubtitle(step);
  const duration = formatDuration(step.durationMs);
  const typeBadgeLabel = getTypeBadge(step);

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={`${step.label}, ${step.status}${duration ? `, ${duration}` : ""}`}
      aria-pressed={isSelected}
      aria-current={isActive ? "step" : undefined}
      style={{
        ...stepNodeStyle,
        borderColor:
          isSelected || isActive
            ? borderColor
            : "var(--afr-glass-border, var(--afr-border, #e2e8f0))",
        background: isSelected ? bgColor : "var(--afr-bg-surface, white)",
        boxShadow: isActive
          ? `0 0 20px 4px color-mix(in srgb, ${borderColor} 30%, transparent), inset 0 1px 0 rgba(255,255,255,0.05)`
          : "var(--afr-glass-shadow, none)",
        animation: "afr-node-enter 0.3s ease-out both",
      }}
    >
      {/* Row 1: status dot + label + duration */}
      <div style={stepRow1Style}>
        <span style={{ ...statusDotStyle, background: borderColor }} />
        <span style={stepLabelStyle}>{step.label}</span>
        {duration && <span style={stepDurationStyle}>{duration}</span>}
      </div>

      {/* Row 2: subtitle */}
      {subtitle && <div style={subtitleStyle}>{subtitle}</div>}

      {/* Row 3: badges */}
      <div style={badgeRowStyle}>
        {step.agent && (
          <span style={{ ...agentBadgeStyle, borderColor }}>
            <span style={{ ...badgeDotStyle, background: borderColor }} />
            {step.agent.charAt(0).toUpperCase() + step.agent.slice(1)} Agent
          </span>
        )}
        {typeBadgeLabel && <span style={typeBadgeSyle}>{typeBadgeLabel}</span>}
      </div>
    </button>
  );
});

/** Get a secondary badge label based on step type/detail */
function getTypeBadge(step: ReplayStep): string | null {
  switch (step.type) {
    case "tool_call":
      return (step.detail.name as string) ?? null;
    case "skill_call":
      return (step.detail.name as string) ?? null;
    case "llm_call":
      return (step.detail.stage as string) ?? null;
    case "stage_transition":
      return (step.detail.stage as string) ?? null;
    case "state_change":
      return step.status;
    case "response":
      return "complete";
    default:
      return null;
  }
}

// ── Connector constants & helpers ──

const SEQ_CONNECTOR_H = 24;
const PARALLEL_CONNECTOR_H = 36;

/** Compute the x position for the nth branch in a parallel group (0-200 viewBox) */
function getParallelX(index: number, total: number): number {
  if (total === 1) return 100;
  // Spread branches evenly across the viewBox, with padding from edges
  const pad = 20;
  return pad + (index * (200 - 2 * pad)) / (total - 1);
}

/** Build a fan-out path from center top to branch position */
function fanOutPath(x: number, h: number): string {
  // When the target is at center (x≈100), add a subtle S-curve so it's visible as a branch
  if (Math.abs(x - 100) < 1) {
    return `M100,0 C92,${h * 0.35} 108,${h * 0.65} ${x},${h}`;
  }
  return `M100,0 C100,${h * 0.6} ${x},${h * 0.4} ${x},${h}`;
}

/** Build a fan-in path from branch position to center bottom */
function fanInPath(x: number, h: number): string {
  if (Math.abs(x - 100) < 1) {
    return `M${x},0 C108,${h * 0.35} 92,${h * 0.65} 100,${h}`;
  }
  return `M${x},0 C${x},${h * 0.6} 100,${h * 0.4} 100,${h}`;
}

// Inline styles
const flowGraphStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: 24,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 0,
};

const emptyStateStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--afr-text-secondary, #9ca3af)",
  fontStyle: "italic",
  textAlign: "center",
  padding: "40px 20px",
};

const sequentialNodeStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  width: "100%",
  maxWidth: 700,
};

const stepNodeStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: "12px 16px",
  borderRadius: 10,
  border: "1px solid var(--afr-glass-border, var(--afr-border, #e2e8f0))",
  background: "var(--afr-bg-surface, white)",
  backdropFilter: "blur(var(--afr-glass-blur, 0px))",
  WebkitBackdropFilter: "blur(var(--afr-glass-blur, 0px))",
  cursor: "pointer",
  width: "100%",
  transition: "border-color 0.2s ease, box-shadow 0.3s ease, background 0.2s ease",
  textAlign: "left",
};

const stepRow1Style: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
};

const statusDotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  flexShrink: 0,
  boxShadow: "0 0 6px currentColor",
};

const stepLabelStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "var(--afr-text-primary, #1d262c)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  flex: 1,
};

const stepDurationStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--afr-text-secondary, #9ca3af)",
  fontFamily: "ui-monospace, SFMono-Regular, monospace",
  flexShrink: 0,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--afr-text-secondary, #9ca3af)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  paddingLeft: 16,
};

const badgeRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  paddingLeft: 16,
  flexWrap: "wrap",
};

const agentBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "3px 10px",
  borderRadius: 9999,
  fontSize: 11,
  fontWeight: 500,
  background: "rgba(205, 214, 244, 0.06)",
  color: "var(--afr-text-primary, #1d262c)",
  border: "1px solid var(--afr-glass-border, var(--afr-border, #e2e8f0))",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
};

const badgeDotStyle: React.CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: "50%",
  boxShadow: "0 0 4px currentColor",
};

const typeBadgeSyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "3px 10px",
  borderRadius: 9999,
  fontSize: 11,
  fontWeight: 500,
  background: "rgba(205, 214, 244, 0.04)",
  color: "var(--afr-text-secondary, #9ca3af)",
  border: "1px solid var(--afr-glass-border, var(--afr-border, #e2e8f0))",
};

const parallelGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  width: "100%",
  maxWidth: 900,
  background: "rgba(205, 214, 244, 0.02)",
  border: "1px dashed rgba(205, 214, 244, 0.08)",
  borderRadius: 12,
  padding: "4px 8px",
};

const parallelNodesStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  width: "100%",
};

const connectorStyle: React.CSSProperties = {
  width: "100%",
  height: PARALLEL_CONNECTOR_H,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "visible",
};
