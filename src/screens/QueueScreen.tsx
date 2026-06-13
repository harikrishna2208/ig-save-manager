import React, { useState, useEffect, useRef } from "react";
import { QueueState, type QueueProgress, type Media } from "../types";
import { Button } from "../components/Button";
import { LoggerView } from "../components/LoggerView";

interface QueueScreenProps {
  mediaItemsToUnsave: Media[] | null; // Pass items if initiating a new queue run
  collectionId?: string;
  onExit: () => void;
}

export const QueueScreen: React.FC<QueueScreenProps> = ({
  mediaItemsToUnsave,
  collectionId,
  onExit,
}) => {
  const [progress, setProgress] = useState<QueueProgress | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const portRef = useRef<chrome.runtime.Port | null>(null);

  useEffect(() => {
    // 1. Establish Messaging Connection Port
    if (typeof chrome !== "undefined" && chrome.runtime) {
      const port = chrome.runtime.connect({ name: "instagram_unsave_port" });
      portRef.current = port;

      port.onMessage.addListener((msg) => {
        if (msg.type === "QUEUE_UPDATE") {
          setProgress(msg.progress);
        }
      });

      // Synchronize immediately
      port.postMessage({ type: "SYNC" });

      // 2. Start queue if new items were passed
      if (mediaItemsToUnsave && mediaItemsToUnsave.length > 0) {
        port.postMessage({
          type: "START",
          mediaItems: mediaItemsToUnsave,
          collectionId,
        });
      }
    }

    return () => {
      if (portRef.current) {
        portRef.current.disconnect();
      }
    };
  }, [mediaItemsToUnsave, collectionId]);

  const handlePause = () => {
    portRef.current?.postMessage({ type: "PAUSE" });
  };

  const handleResume = () => {
    portRef.current?.postMessage({ type: "RESUME" });
  };

  const handleCancel = () => {
    if (confirm("Are you sure you want to stop and reset the current run?")) {
      portRef.current?.postMessage({ type: "CANCEL" });
    }
  };

  if (!progress) {
    return (
<div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
  <button className="btn" disabled>Connecting to background queue...</button>
</div>
    );
  }

  const { state, currentIndex, totalItems, processedItems, error, retryCount } = progress;
  
  // Calculate percentage progress safely
  const percent = totalItems > 0 ? Math.round((currentIndex / totalItems) * 100) : 0;

  // Resolve user readable text based on states
  const getStateDescription = () => {
    switch (state) {
      case QueueState.LOADING:
        return "Initializing background queue...";
      case QueueState.READY:
        return "Queue ready. Preparing to unsave...";
      case QueueState.RUNNING:
        return `Unsaving post ${currentIndex + 1} of ${totalItems}...`;
      case QueueState.PAUSED:
        return "Execution paused by user.";
      case QueueState.RATE_LIMITED:
        return `Instagram Rate Limit Hit! Waiting for backoff (Attempt ${retryCount})...`;
      case QueueState.RETRYING:
        return "Retrying connection session...";
      case QueueState.CANCELLING:
        return "Cancelling queue execution...";
      case QueueState.COMPLETED:
        return `Completed! Successfully unsaved ${processedItems} post(s).`;
      case QueueState.FAILED:
        return `Queue Failed: ${error || "Unknown network failure"}`;
      case QueueState.IDLE:
      default:
        return "No active unsave operation running.";
    }
  };

  const isCompleted = state === QueueState.COMPLETED;
  const isFailed = state === QueueState.FAILED;
  const isIdle = state === QueueState.IDLE;
  const showControls = !isCompleted && !isFailed && !isIdle;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
      {/* Header */}
      <div className="header-bar">
        <h2 style={{ fontSize: "16px", fontWeight: 700 }}>Unsave Progress</h2>
        <span
          style={{
            fontSize: "11px",
            fontWeight: "bold",
            padding: "2px 8px",
            borderRadius: "12px",
            backgroundColor: "var(--border)",
            color: state === QueueState.RUNNING ? "var(--success)" : "var(--text-muted)",
          }}
        >
          {state}
        </span>
      </div>

      {/* Content Area */}
      <div className="content-area" style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "24px" }}>
        {/* Status Graphic / SVG */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          {isCompleted ? (
            <span style={{ fontSize: "48px", color: "var(--success)" }}>&#10004;</span>
          ) : isFailed ? (
            <span style={{ fontSize: "48px", color: "var(--danger)" }}>&#9888;</span>
          ) : (
            <div style={{ display: "inline-block", position: "relative", width: "64px", height: "64px" }}>
              {/* Spinner icon */}
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  border: "4px solid var(--border)",
                  borderTopColor: "var(--primary)",
                  borderRadius: "50%",
                  animation: state === QueueState.RUNNING ? "spin 1s linear infinite" : "none",
                }}
              />
            </div>
          )}
        </div>

        {/* Text descriptions */}
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <p style={{ fontSize: "15px", fontWeight: 600, marginBottom: "8px" }}>
            {getStateDescription()}
          </p>
          <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Processed: {processedItems} | Total: {totalItems}
          </p>
        </div>

        {/* Progress Bar */}
        {showControls && (
          <div
            style={{
              width: "100%",
              height: "10px",
              backgroundColor: "var(--border)",
              borderRadius: "5px",
              overflow: "hidden",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                width: `${percent}%`,
                height: "100%",
                backgroundColor: state === QueueState.RATE_LIMITED ? "var(--danger)" : "var(--primary)",
                transition: "width 0.4s ease",
              }}
            />
          </div>
        )}

        {/* Actions panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%", maxWidth: "250px", margin: "0 auto" }}>
          {state === QueueState.RUNNING && (
            <Button variant="secondary" block onClick={handlePause}>
              Pause Execution
            </Button>
          )}

          {state === QueueState.PAUSED && (
            <Button variant="primary" block onClick={handleResume}>
              Resume Queue
            </Button>
          )}

          {showControls && (
            <Button variant="danger" block onClick={handleCancel}>
              Stop & Reset Queue
            </Button>
          )}

          {(isCompleted || isFailed || isIdle) && (
            <Button variant="primary" block onClick={onExit}>
              Back to Collections
            </Button>
          )}

          <Button variant="secondary" block onClick={() => setShowLogs(!showLogs)}>
            {showLogs ? "Hide Console Logs" : "Show Console Logs"}
          </Button>
        </div>
      </div>

      {/* Diagnostics Logs Drawer panel */}
      {showLogs && <LoggerView onClose={() => setShowLogs(false)} />}
    </div>
  );
};
