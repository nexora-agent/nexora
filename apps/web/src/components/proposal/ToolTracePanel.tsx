import type { ToolTraceEntry } from "@nexora/shared";

type ToolTracePanelProps = {
  trace: ToolTraceEntry[];
};

export function ToolTracePanel({ trace }: ToolTracePanelProps) {
  if (trace.length === 0) {
    return null;
  }

  return (
    <section className="tool-trace-panel" aria-label="Tool trace">
      <div className="console-topline">
        <span>Tool Trace</span>
        <span className="status-pill status-ready">{trace.length} calls</span>
      </div>

      <ol>
        {trace.map((entry) => (
          <li key={`${entry.index}-${entry.toolName}`}>
            <span>Tool call {entry.index}</span>
            <strong>{entry.toolName}</strong>
            <small>{entry.summary}</small>
          </li>
        ))}
      </ol>
    </section>
  );
}
