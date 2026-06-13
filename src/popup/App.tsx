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

  // Preset size layout mapping class
  const getContainerPresetClass = () => {
    if (!prefs) return "preset-normal";
    return `preset-${prefs.popupSize}`;
  };

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

  return <div className={`app-container ${getContainerPresetClass()}`}>{renderScreen()}</div>;
};
