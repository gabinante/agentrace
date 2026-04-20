import { forwardRef, useEffect, useRef } from "react";
import type { ReplayStep, ReplayStepType } from "../types";

const DEFAULT_BORDER_COLORS: Record<ReplayStepType, string> = {
  user_message: "#475569",
  intent_classification: "#7c3aed",
  stage_transition: "#7c3aed",
  llm_call: "#92400e",
  tool_call: "#0891b2",
  skill_call: "#047857",
  knowledge_search: "#a16207",
  response: "#047857",
  error: "#dc2626",
  state_change: "#1d4ed8",
  custom: "#6b7280",
};

const DEFAULT_BG_COLORS: Record<ReplayStepType, string> = {
  user_message: "#f1f5f9",
  intent_classification: "#ede9fe",
  stage_transition: "#ede9fe",
  llm_call: "#fef3c7",
  tool_call: "#cffafe",
  skill_call: "#d1fae5",
  knowledge_search: "#fef9c3",
  response: "#d1fae5",
  error: "#fee2e2",
  state_change: "#dbeafe",
  custom: "#f3f4f6",
};

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
      while (
        i < visibleSteps.length &&
        visibleSteps[i].parallelGroupId === groupId
      ) {
        groupSteps.push({ step: visibleSteps[i], idx: i });
        i++;
      }

      rendered.push(
        <div key={groupId} style={parallelGroupStyle}>
          <div style={connectorStyle}>
            <svg width="100%" height="20" viewBox="0 0 200 20" preserveAspectRatio="none">
              <line x1="100" y1="0" x2="100" y2="10" stroke="#e2e8f0" strokeWidth="2" />
              <line x1={100 / groupSteps.length} y1="10" x2={200 - 100 / groupSteps.length} y2="10" stroke="#e2e8f0" strokeWidth="2" />
              {groupSteps.map((_, gi) => {
                const x = 100 / groupSteps.length + (gi * (200 - 200 / groupSteps.length)) / Math.max(groupSteps.length - 1, 1);
                return <line key={gi} x1={x} y1="10" x2={x} y2="20" stroke="#e2e8f0" strokeWidth="2" />;
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
          <div style={connectorStyle}>
            <svg width="100%" height="20" viewBox="0 0 200 20" preserveAspectRatio="none">
              {groupSteps.map((_, gi) => {
                const x = 100 / groupSteps.length + (gi * (200 - 200 / groupSteps.length)) / Math.max(groupSteps.length - 1, 1);
                return <line key={gi} x1={x} y1="0" x2={x} y2="10" stroke="#e2e8f0" strokeWidth="2" />;
              })}
              <line x1={100 / groupSteps.length} y1="10" x2={200 - 100 / groupSteps.length} y2="10" stroke="#e2e8f0" strokeWidth="2" />
              <line x1="100" y1="10" x2="100" y2="20" stroke="#e2e8f0" strokeWidth="2" />
            </svg>
          </div>
        </div>,
      );
    } else {
      rendered.push(
        <div key={step.id} style={sequentialNodeStyle}>
          {i > 0 && <div style={verticalLineStyle} />}
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
    <div ref={scrollRef} style={flowGraphStyle}>
      {rendered.length === 0 && (
        <p style={emptyStateStyle}>Press Play to start the replay</p>
      )}
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
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      style={{
        ...stepNodeStyle,
        borderLeftColor: borderColor,
        background: isSelected ? bgColor : "white",
        boxShadow: isActive ? `0 0 0 2px ${borderColor}` : undefined,
      }}
    >
      <div style={stepHeaderStyle}>
        <span style={stepLabelStyle}>{step.label}</span>
        {step.durationMs !== undefined && (
          <span style={stepDurationStyle}>{step.durationMs}ms</span>
        )}
      </div>
      {step.agent && (
        <span style={{ ...agentBadgeStyle, background: bgColor, color: borderColor }}>
          {step.agent}
        </span>
      )}
      <StatusIndicator status={step.status} />
    </button>
  );
});

function StatusIndicator({ status }: { status: ReplayStep["status"] }) {
  switch (status) {
    case "running":
      return <span style={statusRunningStyle} />;
    case "completed":
      return <span style={{ color: "#10b981", fontWeight: 600, fontSize: 12 }}>&#x2713;</span>;
    case "failed":
      return <span style={{ color: "#ef4444", fontWeight: 600, fontSize: 12 }}>&#x2717;</span>;
    default:
      return <span style={statusPendingStyle} />;
  }
}

// Inline styles (no CSS modules dependency for portability)
const flowGraphStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: 16,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 0,
};

const emptyStateStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#9ca3af",
  fontStyle: "italic",
  textAlign: "center",
  padding: "40px 20px",
};

const sequentialNodeStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  width: "100%",
  maxWidth: 400,
};

const verticalLineStyle: React.CSSProperties = {
  width: 2,
  height: 16,
  background: "#e2e8f0",
};

const stepNodeStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  borderLeft: "4px solid #e2e8f0",
  background: "white",
  cursor: "pointer",
  width: "100%",
  transition: "all 0.15s ease",
  textAlign: "left",
};

const stepHeaderStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: 2,
  minWidth: 0,
};

const stepLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: "#1d262c",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const stepDurationStyle: React.CSSProperties = {
  fontSize: 10,
  color: "#9ca3af",
  fontFamily: "ui-monospace, SFMono-Regular, monospace",
};

const agentBadgeStyle: React.CSSProperties = {
  padding: "1px 8px",
  borderRadius: 9999,
  fontSize: 10,
  fontWeight: 500,
  flexShrink: 0,
  whiteSpace: "nowrap",
};

const parallelGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  width: "100%",
  maxWidth: 500,
};

const parallelNodesStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  width: "100%",
};

const connectorStyle: React.CSSProperties = {
  width: "100%",
  height: 20,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const statusRunningStyle: React.CSSProperties = {
  width: 12,
  height: 12,
  border: "2px solid #e5e7eb",
  borderTopColor: "#3b82f6",
  borderRadius: "50%",
  animation: "afr-spin 0.8s linear infinite",
  flexShrink: 0,
};

const statusPendingStyle: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: "50%",
  background: "#e5e7eb",
  flexShrink: 0,
};
