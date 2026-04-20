import { useState } from "react";
import type { ReplayStep } from "../types";

interface DetailPanelProps {
  step: ReplayStep | null;
}

export function DetailPanel({ step }: DetailPanelProps) {
  if (!step) {
    return (
      <div style={panelStyle}>
        <p style={emptyStyle}>Select a step to view details</p>
      </div>
    );
  }

  return (
    <div style={panelStyle}>
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
            return <CollapsibleJson key={key} label={key} data={value as Record<string, unknown>} />;
          }
          return <DetailRow key={key} label={key} value={String(value)} />;
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ReplayStep["status"] }) {
  const colors: Record<string, { bg: string; color: string }> = {
    pending: { bg: "#f1f5f9", color: "#475569" },
    running: { bg: "#dbeafe", color: "#1d4ed8" },
    completed: { bg: "#d1fae5", color: "#047857" },
    failed: { bg: "#fee2e2", color: "#dc2626" },
  };
  const c = colors[status] ?? colors.pending;
  return (
    <span style={{ ...badgeStyle, background: c.bg, color: c.color }}>
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
        <button type="button" onClick={() => setExpanded(!expanded)} style={toggleStyle}>
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
  borderLeft: "1px solid #e2e8f0",
  background: "#f8fafc",
};

const emptyStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#9ca3af",
  fontStyle: "italic",
  textAlign: "center",
  padding: "40px 20px",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  paddingBottom: 12,
  borderBottom: "1px solid #e2e8f0",
  marginBottom: 12,
};

const titleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "#1d262c",
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
  color: "#9ca3af",
};

const agentTagStyle: React.CSSProperties = {
  padding: "1px 8px",
  borderRadius: 9999,
  fontSize: 10,
  fontWeight: 500,
  background: "#ede9fe",
  color: "#7c3aed",
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
  color: "#525a66",
  textTransform: "uppercase",
  letterSpacing: "0.3px",
};

const valueStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#1d262c",
  wordBreak: "break-word",
};

const jsonBlockStyle: React.CSSProperties = {
  fontSize: 10,
  fontFamily: "ui-monospace, SFMono-Regular, monospace",
  color: "#1d262c",
  background: "white",
  padding: "6px 8px",
  borderRadius: 4,
  border: "1px solid #e2e8f0",
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
  color: "#2563eb",
  background: "none",
  border: "none",
  cursor: "pointer",
};
