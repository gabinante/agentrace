import { useState } from "react";
import type { ReplayStep } from "../types";

interface DetailPanelProps {
  step: ReplayStep | null;
}

export function DetailPanel({ step }: DetailPanelProps) {
  if (!step) {
    return (
      <aside aria-label="Step details" style={panelStyle}>
        <p style={emptyStyle}>Select a step to view details</p>
      </aside>
    );
  }

  return (
    <aside aria-label="Step details" style={panelStyle}>
      <div style={headerStyle}>
        <h4 style={titleStyle}>{step.label}</h4>
        <div style={metaStyle}>
          <span style={timestampStyle}>
            {new Date(step.timestamp).toLocaleTimeString("en-US", {
              hour12: false,
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
          {step.agent && <span style={agentTagStyle}>{step.agent}</span>}
          <StatusBadge status={step.status} />
        </div>
      </div>

      <div style={bodyStyle}>
        {step.durationMs !== undefined && (
          <DetailRow label="Duration" value={`${step.durationMs}ms`} />
        )}
        {Object.entries(step.detail).map(([key, value]) => {
          if (value === undefined || value === null) return null;
          if (typeof value === "object") {
            return (
              <CollapsibleJson key={key} label={key} data={value as Record<string, unknown>} />
            );
          }
          return <DetailRow key={key} label={key} value={String(value)} />;
        })}
      </div>
    </aside>
  );
}

function StatusBadge({ status }: { status: ReplayStep["status"] }) {
  const colors: Record<string, { bg: string; color: string }> = {
    pending: {
      bg: "var(--afr-bg-secondary, #f1f5f9)",
      color: "var(--afr-text-secondary, #475569)",
    },
    running: { bg: "rgba(59,130,246,0.15)", color: "var(--afr-step-state-change, #1d4ed8)" },
    completed: { bg: "rgba(16,185,129,0.15)", color: "var(--afr-step-skill-call, #047857)" },
    failed: { bg: "rgba(239,68,68,0.15)", color: "var(--afr-step-error, #dc2626)" },
  };
  const c = colors[status] ?? colors.pending;
  return (
    <span role="status" style={{ ...badgeStyle, background: c.bg, color: c.color }}>
      {status}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={rowStyle}>
      <span style={labelStyle}>{label}</span>
      <span style={valueStyle}>{value}</span>
    </div>
  );
}

function CollapsibleJson({ label, data }: { label: string; data: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);
  const json = JSON.stringify(data, null, 2);
  const isLong = json.length > 200;
  const displayed = !expanded && isLong ? `${json.slice(0, 200)}...` : json;

  return (
    <div style={rowStyle}>
      <span style={labelStyle}>{label}</span>
      <code style={jsonBlockStyle}>{displayed}</code>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          style={toggleStyle}
          aria-expanded={expanded}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  overflowY: "auto",
  padding: 16,
  borderLeft: "1px solid var(--afr-border, #e2e8f0)",
  background: "var(--afr-bg-secondary, #f8fafc)",
  width: 320,
  flexShrink: 0,
};

const emptyStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--afr-text-secondary, #9ca3af)",
  fontStyle: "italic",
  textAlign: "center",
  padding: "40px 20px",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  paddingBottom: 12,
  borderBottom: "1px solid var(--afr-border, #e2e8f0)",
  marginBottom: 12,
};

const titleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "var(--afr-text-primary, #1d262c)",
  margin: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const metaStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const timestampStyle: React.CSSProperties = {
  fontSize: 11,
  fontFamily: "ui-monospace, SFMono-Regular, monospace",
  color: "var(--afr-text-secondary, #9ca3af)",
};

const agentTagStyle: React.CSSProperties = {
  padding: "1px 8px",
  borderRadius: 9999,
  fontSize: 10,
  fontWeight: 500,
  background: "var(--afr-bg-surface, #ede9fe)",
  color: "var(--afr-step-stage-transition, #7c3aed)",
};

const badgeStyle: React.CSSProperties = {
  padding: "1px 8px",
  borderRadius: 9999,
  fontSize: 10,
  fontWeight: 500,
  textTransform: "capitalize",
};

const bodyStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: "var(--afr-text-secondary, #525a66)",
  textTransform: "uppercase",
  letterSpacing: "0.3px",
};

const valueStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--afr-text-primary, #1d262c)",
  wordBreak: "break-word",
};

const jsonBlockStyle: React.CSSProperties = {
  fontSize: 10,
  fontFamily: "ui-monospace, SFMono-Regular, monospace",
  color: "var(--afr-text-mono, #1d262c)",
  background: "var(--afr-bg-surface, white)",
  padding: "6px 8px",
  borderRadius: 4,
  border: "1px solid var(--afr-border, #e2e8f0)",
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
  maxHeight: 200,
  overflowY: "auto",
};

const toggleStyle: React.CSSProperties = {
  marginTop: 4,
  padding: 0,
  fontSize: 10,
  fontWeight: 500,
  color: "var(--afr-step-tool-call, #2563eb)",
  background: "none",
  border: "none",
  cursor: "pointer",
};
