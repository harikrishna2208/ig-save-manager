import React, { useState, useEffect } from "react";
import { type UserPreferences, type Collection, type Media, QueueState } from "../types";
import { StorageService } from "../services/storage";
import { InstagramApiClient } from "../services/instagramApiClient";
import { LoginScreen } from "../screens/LoginScreen";
import { CollectionsScreen } from "../screens/CollectionsScreen";
import { SelectionScreen } from "../screens/SelectionScreen";
import { QueueScreen } from "../screens/QueueScreen";
import { Logger } from "../services/logger";

type Route = "LOADING" | "LOGIN" | "COLLECTIONS" | "SELECTION" | "QUEUE";

export const App: React.FC = () => {
  const [route, setRoute] = useState<Route>("LOADING");
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [username, setUsername] = useState("");
  
  // Navigation contextual values
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [mediaToUnsave, setMediaToUnsave] = useState<Media[] | null>(null);

  // 1. Initial configuration load & session validation
  const checkSessionAndInitialize = async () => {
    setRoute("LOADING");
    try {
      // Load user configurations
      const userPrefs = await StorageService.getPreferences();
      setPrefs(userPrefs);

      // Apply stylesheet theme class
      applyTheme(userPrefs.theme);

      // Check if a queue is currently active in background
      const progress = await StorageService.getQueueProgress();
      const activeStates = [
        QueueState.RUNNING,
        QueueState.PAUSED,
        QueueState.RATE_LIMITED,
        QueueState.RETRYING,
      ];

      if (progress && activeStates.includes(progress.state)) {
        await Logger.info("PopupApp", `Active queue detected. Routing to QueueScreen. State: ${progress.state}`);
        setMediaToUnsave(null); // Indicates recovery mode, no need to issue new START message
        setRoute("QUEUE");
        return;
      }

      // Check Instagram session
      const info = await InstagramApiClient.getAccountInfo();
      setUsername(info.username);
      setRoute("COLLECTIONS");
    } catch (err) {
      console.warn("Authentication verify failed", err);
      setRoute("LOGIN");
    }
  };

  const applyTheme = (theme: "light" | "dark") => {
    if (typeof document !== "undefined") {
      document.body.classList.remove("theme-light", "theme-dark");
      document.body.classList.add(`theme-${theme}`);
    }
  };

  useEffect(() => {
    checkSessionAndInitialize();
  }, []);

  const isFullTab = typeof window !== "undefined" && window.innerWidth > 900;

  // Preset size layout mapping class
  const getContainerPresetClass = () => {
    if (isFullTab) return "preset-fulltab";
    if (!prefs) return "preset-normal";
    return `preset-${prefs.popupSize}`;
  };

  // Mark body so CSS can apply full-tab-specific rules
  useEffect(() => {
    if (isFullTab) {
      document.body.classList.add("fulltab-mode");
    }
    return () => document.body.classList.remove("fulltab-mode");
  }, [isFullTab]);

  const renderScreen = () => {
    if (!prefs) return null;

    switch (route) {
      case "LOGIN":
        return <LoginScreen onCheckSession={checkSessionAndInitialize} />;
      case "COLLECTIONS":
        return (
          <CollectionsScreen
            username={username}
            lastSelectedCollectionId={prefs.lastSelectedCollectionId}
            onSelectCollection={(col) => {
              setSelectedCollection(col);
              setRoute("SELECTION");
              StorageService.setPreferences({ lastSelectedCollectionId: col.collection_id });
            }}
          />
        );
      case "SELECTION":
        if (!selectedCollection) return null;
        return (
          <SelectionScreen
            collection={selectedCollection}
            prefs={prefs}
            onBack={() => {
              setSelectedCollection(null);
              setRoute("COLLECTIONS");
            }}
            onStartQueue={(items, _colId) => {
              setMediaToUnsave(items);
              setSelectedCollection(null);
              setRoute("QUEUE");
            }}
          />
        );
      case "QUEUE":
        return (
          <QueueScreen
            mediaItemsToUnsave={mediaToUnsave}
            collectionId={selectedCollection?.collection_id}
            onExit={() => {
              setMediaToUnsave(null);
              setSelectedCollection(null);
              checkSessionAndInitialize();
            }}
          />
        );
      case "LOADING":
      default:
        return (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
            <button className="btn" disabled>Loading Unsaver Engine...</button>
          </div>
        );
    }
  };

  const handleOpenInTab = () => {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
    }
  };

  return (
    <div className={`app-container ${getContainerPresetClass()}`} style={{ position: "relative" }}>
      {renderScreen()}
      {route !== "LOADING" && (
        <button
          onClick={handleOpenInTab}
          title="Open in full tab"
          style={{
            position: "absolute",
            bottom: "16px",
            right: "16px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            color: "var(--text-muted)",
            cursor: "pointer",
            padding: "4px 6px",
            lineHeight: 0,
            zIndex: 5,
            opacity: 0.6,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.6")}
          aria-label="Open in Tab"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </button>
      )}
    </div>
  );
};
