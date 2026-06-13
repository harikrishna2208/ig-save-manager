export interface FeatureFlags {
  backgroundQueue: boolean;
  adaptiveRateLimit: boolean;
  parallelDownloads: boolean;
  experimentalApi: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  backgroundQueue: true,
  adaptiveRateLimit: true,
  parallelDownloads: true,
  experimentalApi: false,
};

const STORAGE_KEY = "feature_flags";

export class FeatureFlagsService {
  public static async getFlags(): Promise<FeatureFlags> {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      try {
        const result = await chrome.storage.local.get(STORAGE_KEY);
        return {
          ...DEFAULT_FLAGS,
          ...(result[STORAGE_KEY] || {}),
        };
      } catch (err) {
        console.error("Failed to read feature flags from storage", err);
        return DEFAULT_FLAGS;
      }
    }
    return DEFAULT_FLAGS;
  }

  public static async setFlags(flags: Partial<FeatureFlags>): Promise<void> {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      const current = await this.getFlags();
      const updated = { ...current, ...flags };
      await chrome.storage.local.set({ [STORAGE_KEY]: updated });
    }
  }
}
