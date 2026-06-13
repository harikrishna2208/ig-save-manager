import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { type UserPreferences, DEFAULT_PREFERENCES } from "../types";
import { StorageService } from "../services/storage";
import { FeatureFlagsService, type FeatureFlags } from "../services/featureFlags";
import { Button } from "../components/Button";
import { LoggerView } from "../components/LoggerView";
import "../styles/index.css";

const OptionsPage: React.FC = () => {
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [flags, setFlags] = useState<FeatureFlags | null>(null);
  const [status, setStatus] = useState("");
  const [showLogs, setShowLogs] = useState(false);

  const loadSettings = async () => {
    const loadedPrefs = await StorageService.getPreferences();
    setPrefs(loadedPrefs);
    applyTheme(loadedPrefs.theme);

    const loadedFlags = await FeatureFlagsService.getFlags();
    setFlags(loadedFlags);
  };

  const applyTheme = (theme: "light" | "dark") => {
    document.body.classList.remove("theme-light", "theme-dark");
    document.body.classList.add(`theme-${theme}`);
  };

  const handleSave = async () => {
    await StorageService.setPreferences(prefs);
    if (flags) {
      await FeatureFlagsService.setFlags(flags);
    }
    applyTheme(prefs.theme);
    setStatus("Settings saved successfully!");
    setTimeout(() => setStatus(""), 2000);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  return (
    <div
      style={{
        maxWidth: "650px",
        margin: "0 auto",
        padding: "30px 20px",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      <div>
        <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "4px" }}>
          Unsaver for Instagram
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
          Configure extension behaviors, rate limits, and view diagnostic logs.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Section 1: User Preferences */}
        <div
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "20px",
          }}
        >
          <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>
            User Preferences
          </h2>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label htmlFor="theme-select" style={{ fontWeight: 500 }}>Color Theme</label>
              <select
                id="theme-select"
                value={prefs.theme}
                onChange={(e) => setPrefs({ ...prefs, theme: e.target.value as "light" | "dark" })}
                style={{ padding: "6px", borderRadius: "4px", border: "1px solid var(--border)", backgroundColor: "var(--background)", color: "var(--text)" }}
              >
                <option value="dark">Dark Theme</option>
                <option value="light">Light Theme</option>
              </select>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label htmlFor="size-select" style={{ fontWeight: 500 }}>Popup Layout Size</label>
              <select
                id="size-select"
                value={prefs.popupSize}
                onChange={(e) => setPrefs({ ...prefs, popupSize: e.target.value as any })}
                style={{ padding: "6px", borderRadius: "4px", border: "1px solid var(--border)", backgroundColor: "var(--background)", color: "var(--text)" }}
              >
                <option value="compact">Compact (400x500)</option>
                <option value="normal">Normal (600x600)</option>
                <option value="expanded">Expanded (800x650)</option>
              </select>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <label htmlFor="delay-input" style={{ fontWeight: 500 }}>Wait Time Interval (ms)</label>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  Interval between unsaving actions (Recommended: 1000ms+)
                </span>
              </div>
              <input
                id="delay-input"
                type="number"
                min="500"
                step="100"
                value={prefs.waitTime}
                onChange={(e) => setPrefs({ ...prefs, waitTime: parseInt(e.target.value) || 1000 })}
                style={{ padding: "6px", width: "80px", borderRadius: "4px", border: "1px solid var(--border)", backgroundColor: "var(--background)", color: "var(--text)" }}
              />
            </div>

            <hr style={{ border: "0", borderTop: "1px solid var(--border)", margin: "8px 0" }} />

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                id="dl-media"
                type="checkbox"
                checked={prefs.downloadMedia}
                onChange={(e) => setPrefs({ ...prefs, downloadMedia: e.target.checked })}
                style={{ cursor: "pointer", width: "16px", height: "16px" }}
              />
              <label htmlFor="dl-media" style={{ cursor: "pointer", fontWeight: 500 }}>Download media files before unsaving</label>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingLeft: "24px" }}>
              <input
                id="dl-thumbs"
                type="checkbox"
                disabled={!prefs.downloadMedia}
                checked={prefs.includeThumbnails}
                onChange={(e) => setPrefs({ ...prefs, includeThumbnails: e.target.checked })}
                style={{ cursor: "pointer", width: "16px", height: "16px" }}
              />
              <label htmlFor="dl-thumbs" style={{ cursor: "pointer", color: prefs.downloadMedia ? "var(--text)" : "var(--text-muted)" }}>Include video poster thumbnails in download</label>
            </div>

            <hr style={{ border: "0", borderTop: "1px solid var(--border)", margin: "8px 0" }} />

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                id="autoplay-vid"
                type="checkbox"
                checked={prefs.autoplayVideos}
                onChange={(e) => setPrefs({ ...prefs, autoplayVideos: e.target.checked })}
                style={{ cursor: "pointer", width: "16px", height: "16px" }}
              />
              <label htmlFor="autoplay-vid" style={{ cursor: "pointer", fontWeight: 500 }}>Autoplay videos in preview modal</label>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                id="mute-vid"
                type="checkbox"
                checked={prefs.videoMutedByDefault}
                onChange={(e) => setPrefs({ ...prefs, videoMutedByDefault: e.target.checked })}
                style={{ cursor: "pointer", width: "16px", height: "16px" }}
              />
              <label htmlFor="mute-vid" style={{ cursor: "pointer", fontWeight: 500 }}>Mute preview video playback by default</label>
            </div>
          </div>
        </div>

        {/* Section 2: Feature Flags */}
        {flags && (
          <div
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "20px",
            }}
          >
            <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>
              Developer Feature Flags
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  id="flag-bg-queue"
                  type="checkbox"
                  checked={flags.backgroundQueue}
                  onChange={(e) => setFlags({ ...flags, backgroundQueue: e.target.checked })}
                  style={{ cursor: "pointer" }}
                />
                <label htmlFor="flag-bg-queue" style={{ cursor: "pointer" }}>Background Queue Engine</label>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  id="flag-rate-limit"
                  type="checkbox"
                  checked={flags.adaptiveRateLimit}
                  onChange={(e) => setFlags({ ...flags, adaptiveRateLimit: e.target.checked })}
                  style={{ cursor: "pointer" }}
                />
                <label htmlFor="flag-rate-limit" style={{ cursor: "pointer" }}>Adaptive Throttling (429)</label>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  id="flag-parallel"
                  type="checkbox"
                  checked={flags.parallelDownloads}
                  onChange={(e) => setFlags({ ...flags, parallelDownloads: e.target.checked })}
                  style={{ cursor: "pointer" }}
                />
                <label htmlFor="flag-parallel" style={{ cursor: "pointer" }}>Parallel DL Processing</label>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  id="flag-exp-api"
                  type="checkbox"
                  checked={flags.experimentalApi}
                  onChange={(e) => setFlags({ ...flags, experimentalApi: e.target.checked })}
                  style={{ cursor: "pointer" }}
                />
                <label htmlFor="flag-exp-api" style={{ cursor: "pointer" }}>Use Experimental APIs</label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Buttons bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <Button variant="primary" onClick={handleSave}>
          Save Configuration
        </Button>
        <Button variant="secondary" onClick={() => setShowLogs(!showLogs)}>
          {showLogs ? "Hide Diagnostics logs" : "View Diagnostics logs"}
        </Button>
        {status && <span style={{ color: "var(--success)", fontWeight: 500, fontSize: "13px" }}>{status}</span>}
      </div>

      {/* Embedded Logger Console */}
      {showLogs && (
        <div style={{ position: "relative", height: "260px", marginTop: "10px", width: "100%", overflow: "hidden", border: "1px solid var(--border)", borderRadius: "8px" }}>
          <LoggerView onClose={() => setShowLogs(false)} />
        </div>
      )}
    </div>
  );
};

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <OptionsPage />
    </React.StrictMode>,
  );
}
