import { createRoot } from "react-dom/client";
import { ReplayViewer } from "../src/components/ReplayViewer";
import { parseMastermindEvents } from "../src/parsers/mastermind";
import type { MastermindEvent } from "../src/parsers/mastermind";
import { sampleEvents } from "./sampleData";

function App() {
  const steps = parseMastermindEvents(sampleEvents as MastermindEvent[]);

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Agentic Flow Replay</h1>
      <p style={{ color: "#666", marginBottom: 24, fontSize: 14 }}>
        Drop in any structured agent logs and visualize the execution flow.
        Use Space to play/pause, arrow keys to step through.
      </p>
      <ReplayViewer steps={steps} height="70vh" />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
