import React, { useState, useEffect } from "react";
import { Logger, type LogEntry } from "../services/logger";
import { Button } from "./Button";

interface LoggerViewProps {
  onClose?: () => void;
}

export const LoggerView: React.FC<LoggerViewProps> = ({ onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const loadLogs = async () => {
    const data = await Logger.getLogs();
    // Show newest logs at bottom
    setLogs(data);
  };

  const handleClearLogs = async () => {
    await Logger.clearLogs();
    setLogs([]);
  };

  const handleExportLogs = () => {
    const text = logs
      .map((l) => `[${l.timestamp}] [${l.level}] [${l.context}] ${l.message}`)
      .join("\n");
    
    navigator.clipboard.writeText(text);
    alert("Diagnostic logs copied to clipboard!");
  };

  useEffect(() => {
    loadLogs();

    // Poll logs for updates while open
    const interval = setInterval(loadLogs, 1500);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="logger-drawer">
      {/* Header */}
      <div className="logger-header">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontWeight: 700, fontSize: "12px" }}>Diagnostics Console</span>
          <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
            ({logs.length} entries)
          </span>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <Button variant="secondary" style={{ padding: "3px 8px", fontSize: "10px" }} onClick={handleExportLogs}>
            Export
          </Button>
          <Button variant="secondary" style={{ padding: "3px 8px", fontSize: "10px" }} onClick={handleClearLogs}>
            Clear
          </Button>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "var(--text)",
                cursor: "pointer",
                padding: "2px",
                marginLeft: "4px",
                fontSize: "14px",
              }}
              aria-label="Close Logs"
            >
              &#10005;
            </button>
          )}
        </div>
      </div>

      {/* Logs lines body */}
      <div className="logger-logs">
        {logs.length === 0 ? (
          <div style={{ color: "var(--text-muted)", textAlign: "center", padding: "20px" }}>
            No logs captured yet.
          </div>
        ) : (
          logs.map((log, idx) => {
            const time = new Date(log.timestamp).toLocaleTimeString();
            return (
              <div key={idx} className={`log-line ${log.level}`}>
                <span style={{ color: "var(--text-muted)" }}>[{time}]</span>
                <span style={{ fontWeight: 600 }}>[{log.context}]</span>
                <span>{log.message}</span>
                {log.data && (
                  <span style={{ fontSize: "10px", opacity: 0.7 }}>
                    ({JSON.stringify(log.data)})
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
