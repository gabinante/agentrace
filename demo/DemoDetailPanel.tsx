import { Panel } from "primereact/panel";
import { Tag } from "primereact/tag";
import { useState, useMemo } from "react";
import type { ReplayStep } from "../src/types";

interface DemoDetailPanelProps {
  step: ReplayStep | null;
  steps?: ReplayStep[];
}

type TagSeverity = "success" | "info" | "warn" | "danger" | "secondary" | null | undefined;

const STATUS_SEVERITY: Record<string, TagSeverity> = {
  pending: "secondary",
  running: "info",
  completed: "success",
  failed: "danger",
};

// Keys that belong in the agent context section, not in details
const AGENT_CONTEXT_KEY = "agent_context";

/** Categorize detail fields into display sections */
function categorizeDetails(step: ReplayStep) {
  const sections: { title: string; rows: { label: string; value: string; color?: string }[] }[] = [];

  // Status section
  sections.push({
    title: "STATUS",
    rows: [
      { label: "Status", value: step.status },
      ...(step.durationMs !== undefined
        ? [{ label: "Duration", value: formatDuration(step.durationMs), color: "var(--afr-step-llm-call)" }]
        : []),
      ...(step.agent
        ? [{ label: "Agent", value: `${step.agent.charAt(0).toUpperCase() + step.agent.slice(1)} Agent` }]
        : []),
      { label: "Type", value: step.type.replace(/_/g, " ") },
    ],
  });

  // Separate detail fields from agent context
  const detailRows: { label: string; value: string; color?: string }[] = [];
  const jsonFields: { label: string; data: Record<string, unknown> }[] = [];
  let agentCtx: Record<string, unknown> | null = null;

  for (const [key, value] of Object.entries(step.detail)) {
    if (value === undefined || value === null) continue;

    // Pull out agent_context for its own section
    if (key === AGENT_CONTEXT_KEY && typeof value === "object") {
      agentCtx = value as Record<string, unknown>;
      continue;
    }

    if (typeof value === "object") {
      jsonFields.push({ label: key, data: value as Record<string, unknown> });
    } else {
      detailRows.push({
        label: formatLabel(key),
        value: String(value),
        color: typeof value === "number" ? "var(--afr-step-tool-call)" : undefined,
      });
    }
  }

  if (detailRows.length > 0) {
    sections.push({ title: "DETAILS", rows: detailRows });
  }

  // Build agent context section from the structured object
  const contextRows: { label: string; value: string; color?: string }[] = [];
  if (agentCtx) {
    if (agentCtx.user_message) {
      contextRows.push({ label: "User Message", value: String(agentCtx.user_message) });
    }
    if (agentCtx.active_stage) {
      contextRows.push({ label: "Active Stage", value: String(agentCtx.active_stage) });
    }
    if (agentCtx.stage_goal) {
      contextRows.push({ label: "Stage Goal", value: String(agentCtx.stage_goal) });
    }
    if (agentCtx.llm_model) {
      contextRows.push({ label: "LLM Model", value: String(agentCtx.llm_model) });
    }
    if (agentCtx.llm_prompt) {
      contextRows.push({ label: "LLM Prompt", value: String(agentCtx.llm_prompt) });
    }
    if (agentCtx.llm_reasoning) {
      contextRows.push({ label: "LLM Reasoning", value: String(agentCtx.llm_reasoning), color: "var(--afr-step-llm-call)" });
    }
    if (agentCtx.llm_tool_calls_requested !== undefined) {
      contextRows.push({ label: "Tool Calls Requested", value: String(agentCtx.llm_tool_calls_requested), color: "var(--afr-step-tool-call)" });
    }
    if (agentCtx.turn_id) {
      contextRows.push({ label: "Turn", value: String(agentCtx.turn_id) });
    }
    if (agentCtx.execution_id) {
      contextRows.push({ label: "Execution", value: String(agentCtx.execution_id) });
    }

    // Turn tallies
    const tallies: string[] = [];
    if (agentCtx.turn_llm_calls) tallies.push(`${agentCtx.turn_llm_calls} LLM`);
    if (agentCtx.turn_tool_calls) tallies.push(`${agentCtx.turn_tool_calls} tool`);
    if (agentCtx.turn_skill_calls) tallies.push(`${agentCtx.turn_skill_calls} skill`);
    if (tallies.length > 0) {
      contextRows.push({ label: "Turn Calls So Far", value: tallies.join(", "), color: "var(--afr-step-tool-call)" });
    }
  }

  return { sections, jsonFields, contextRows };
}

function formatLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDuration(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

export function DemoDetailPanel({ step, steps }: DemoDetailPanelProps) {
  if (!step) {
    return (
      <div style={emptyContainerStyle}>
        <div style={{ textAlign: "center" }}>
          <i className="pi pi-info-circle" style={{ fontSize: 28, color: "var(--afr-text-secondary)", marginBottom: 12, display: "block" }} />
          <p style={emptyStyle}>Select a step to view details</p>
        </div>
      </div>
    );
  }

  const { sections, jsonFields, contextRows } = useMemo(() => categorizeDetails(step), [step]);

  // Compute agent summary if steps are available
  const agentSummary = useMemo(() => {
    if (!steps) return null;
    const counts = new Map<string, number>();
    for (const s of steps) {
      if (s.agent) {
        counts.set(s.agent, (counts.get(s.agent) ?? 0) + 1);
      }
    }
    if (counts.size === 0) return null;
    return Array.from(counts.entries()).map(([agent, count]) => ({
      agent: `${agent.charAt(0).toUpperCase() + agent.slice(1)} Agent`,
      count: `${count} invocation${count > 1 ? "s" : ""}`,
    }));
  }, [steps]);

  return (
    <div style={panelContainerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <span style={{ ...headerDotStyle, background: getStepColor(step.type) }} />
        <h3 style={headerTitleStyle}>{step.label}</h3>
      </div>

      {/* Sections */}
      {sections.map((section) => (
        <div key={section.title} style={sectionStyle}>
          <div style={sectionHeaderStyle}>{section.title}</div>
          <div style={tableStyle}>
            {section.rows.map((row) => (
              <div key={row.label} style={tableRowStyle}>
                <span style={tableLabelStyle}>{row.label}</span>
                <span style={{ ...tableValueStyle, ...(row.color ? { color: row.color } : {}) }}>
                  {row.label === "Status" ? (
                    <Tag value={row.value} severity={STATUS_SEVERITY[row.value] ?? "secondary"} style={{ fontSize: 10 }} />
                  ) : (
                    row.value
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Agent context */}
      {contextRows.length > 0 && (
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>AGENT CONTEXT</div>
          <div style={tableStyle}>
            {contextRows.map((row) => (
              <div key={row.label} style={contextRowStyle}>
                <span style={contextLabelStyle}>{row.label}</span>
                <span style={{ ...contextValueStyle, ...(row.color ? { color: row.color } : {}) }}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agent summary */}
      {agentSummary && (
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>AGENT SUMMARY</div>
          <div style={tableStyle}>
            {agentSummary.map(({ agent, count }) => (
              <div key={agent} style={tableRowStyle}>
                <span style={tableLabelStyle}>{agent}</span>
                <span style={{ ...tableValueStyle, color: "var(--afr-step-skill-call)" }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* JSON fields */}
      {jsonFields.map((field) => (
        <div key={field.label} style={sectionStyle}>
          <div style={sectionHeaderStyle}>{formatLabel(field.label)}</div>
          <JsonBlock data={field.data} />
        </div>
      ))}

      {/* Timestamp footer */}
      <div style={footerStyle}>
        <span style={footerLabelStyle}>Timestamp</span>
        <span style={footerValueStyle}>
          {new Date(step.timestamp).toLocaleTimeString("en-US", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
          .{new Date(step.timestamp).getMilliseconds().toString().padStart(3, "0")}
        </span>
      </div>
    </div>
  );
}

function JsonBlock({ data }: { data: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);
  const json = JSON.stringify(data, null, 2);
  const isLong = json.length > 200;
  const displayed = !expanded && isLong ? `${json.slice(0, 200)}...` : json;

  return (
    <>
      <pre style={jsonStyle}>{syntaxColorize(displayed)}</pre>
      {isLong && (
        <button type="button" onClick={() => setExpanded(!expanded)} style={toggleStyle}>
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </>
  );
}

function syntaxColorize(json: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /("(?:\\.|[^"\\])*")\s*(:)?|(\b(?:true|false|null)\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(json)) !== null) {
    if (match.index > lastIndex) {
      parts.push(json.slice(lastIndex, match.index));
    }

    if (match[1] && match[2]) {
      parts.push(<span key={match.index} style={{ color: "var(--afr-step-tool-call)" }}>{match[1]}</span>);
      parts.push(match[2]);
    } else if (match[1]) {
      parts.push(<span key={match.index} style={{ color: "var(--afr-step-skill-call)" }}>{match[1]}</span>);
    } else if (match[3]) {
      parts.push(<span key={match.index} style={{ color: "var(--afr-step-llm-call)" }}>{match[3]}</span>);
    } else if (match[4]) {
      parts.push(<span key={match.index} style={{ color: "var(--afr-step-stage-transition)" }}>{match[4]}</span>);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < json.length) {
    parts.push(json.slice(lastIndex));
  }

  return parts;
}

function getStepColor(type: string): string {
  const map: Record<string, string> = {
    user_message: "var(--afr-step-user-message)",
    llm_call: "var(--afr-step-llm-call)",
    tool_call: "var(--afr-step-tool-call)",
    skill_call: "var(--afr-step-skill-call)",
    error: "var(--afr-step-error)",
    stage_transition: "var(--afr-step-stage-transition)",
    intent_classification: "var(--afr-step-intent-classification)",
    knowledge_search: "var(--afr-step-knowledge-search)",
    response: "var(--afr-step-response)",
    state_change: "var(--afr-step-state-change)",
    custom: "var(--afr-step-custom)",
  };
  return map[type] ?? "var(--afr-text-secondary)";
}

// ─── Styles ─────────────────────────────────────────────────────────

const emptyContainerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  padding: 20,
};

const emptyStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--afr-text-secondary)",
  fontStyle: "italic",
  margin: 0,
};

const panelContainerStyle: React.CSSProperties = {
  height: "100%",
  overflowY: "auto",
  padding: 20,
  display: "flex",
  flexDirection: "column",
  gap: 20,
  background: "var(--afr-glass-bg, transparent)",
  backdropFilter: "blur(var(--afr-glass-blur, 0px))",
  WebkitBackdropFilter: "blur(var(--afr-glass-blur, 0px))",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  paddingBottom: 16,
  borderBottom: "1px solid var(--afr-glass-border, var(--afr-border))",
};

const headerDotStyle: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: "50%",
  flexShrink: 0,
  boxShadow: "0 0 8px currentColor",
};

const headerTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 600,
  color: "var(--afr-text-primary)",
};

const sectionStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: 12,
  borderRadius: 8,
  background: "rgba(205, 214, 244, 0.03)",
  border: "1px solid var(--afr-glass-border, var(--afr-border))",
};

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--afr-text-secondary)",
  textTransform: "uppercase",
  letterSpacing: "0.8px",
};

const tableStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const tableRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "5px 0",
  borderBottom: "1px solid rgba(205, 214, 244, 0.04)",
};

const tableLabelStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--afr-text-secondary)",
};

const tableValueStyle: React.CSSProperties = {
  fontSize: 13,
  fontFamily: "ui-monospace, SFMono-Regular, monospace",
  color: "var(--afr-text-primary)",
  textAlign: "right",
};

const jsonStyle: React.CSSProperties = {
  fontSize: 11,
  fontFamily: "ui-monospace, SFMono-Regular, monospace",
  color: "var(--afr-text-mono)",
  background: "rgba(17, 17, 27, 0.5)",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--afr-glass-border, var(--afr-border))",
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
  maxHeight: 240,
  overflowY: "auto",
  margin: 0,
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
};

const toggleStyle: React.CSSProperties = {
  padding: 0,
  fontSize: 11,
  fontWeight: 500,
  color: "var(--afr-step-tool-call)",
  background: "none",
  border: "none",
  cursor: "pointer",
  textAlign: "left",
};

const contextRowStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  padding: "4px 0",
};

const contextLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: "var(--afr-text-secondary)",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const contextValueStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--afr-text-primary)",
  wordBreak: "break-word",
};

const footerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  paddingTop: 12,
  borderTop: "1px solid var(--afr-glass-border, var(--afr-border))",
};

const footerLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--afr-text-secondary)",
  textTransform: "uppercase",
  fontWeight: 600,
  letterSpacing: "0.5px",
};

const footerValueStyle: React.CSSProperties = {
  fontSize: 12,
  fontFamily: "ui-monospace, SFMono-Regular, monospace",
  color: "var(--afr-text-secondary)",
};
