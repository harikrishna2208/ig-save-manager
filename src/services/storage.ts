import { type QueueProgress, type UserPreferences, DEFAULT_PREFERENCES } from "../types";

const PREFS_KEY = "preferences";
const QUEUE_KEY = "unsave_queue_progress";

export class StorageService {
  public static async getPreferences(): Promise<UserPreferences> {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
      try {
        const result = await chrome.storage.sync.get(PREFS_KEY);
        return {
          ...DEFAULT_PREFERENCES,
          ...(result[PREFS_KEY] || {}),
        };
      } catch (err) {
        console.error("Failed to load sync preferences, using defaults", err);
        return DEFAULT_PREFERENCES;
      }
    }
    return DEFAULT_PREFERENCES;
  }

  public static async setPreferences(prefs: Partial<UserPreferences>): Promise<void> {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
      const current = await this.getPreferences();
      const updated = { ...current, ...prefs };
      await chrome.storage.sync.set({ [PREFS_KEY]: updated });
    }
  }

  public static async getQueueProgress(): Promise<QueueProgress | null> {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      try {
        const result = await chrome.storage.local.get(QUEUE_KEY);
        return result[QUEUE_KEY] || null;
      } catch (err) {
        console.error("Failed to load local queue progress", err);
        return null;
      }
    }
    return null;
  }

  public static async setQueueProgress(progress: QueueProgress): Promise<void> {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ [QUEUE_KEY]: progress });
    }
  }

  public static async clearQueueProgress(): Promise<void> {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.remove(QUEUE_KEY);
    }
  }
}
