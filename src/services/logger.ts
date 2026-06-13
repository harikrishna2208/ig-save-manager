export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  data?: any;
}

const MAX_LOG_ENTRIES = 200;
const STORAGE_KEY = "diagnostic_logs";

export class Logger {
  private static async addEntry(entry: LogEntry): Promise<void> {
    // Print to developer console
    const logMsg = `[${entry.timestamp}] [${entry.level}] [${entry.context}] ${entry.message}`;
    if (entry.level === LogLevel.ERROR) console.error(logMsg, entry.data || "");
    else if (entry.level === LogLevel.WARN) console.warn(logMsg, entry.data || "");
    else console.log(logMsg, entry.data || "");

    // Persist to chrome.storage
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      try {
        const result = await chrome.storage.local.get(STORAGE_KEY);
        const logs: LogEntry[] = result[STORAGE_KEY] || [];
        logs.push(entry);

        // Rotate logs
        if (logs.length > MAX_LOG_ENTRIES) {
          logs.splice(0, logs.length - MAX_LOG_ENTRIES);
        }

        await chrome.storage.local.set({ [STORAGE_KEY]: logs });
      } catch (err) {
        console.error("Failed to write log to storage", err);
      }
    }
  }

  public static async debug(context: string, message: string, data?: any): Promise<void> {
    await this.addEntry({
      timestamp: new Date().toISOString(),
      level: LogLevel.DEBUG,
      context,
      message,
      data,
    });
  }

  public static async info(context: string, message: string, data?: any): Promise<void> {
    await this.addEntry({
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      context,
      message,
      data,
    });
  }

  public static async warn(context: string, message: string, data?: any): Promise<void> {
    await this.addEntry({
      timestamp: new Date().toISOString(),
      level: LogLevel.WARN,
      context,
      message,
      data,
    });
  }

  public static async error(context: string, message: string, data?: any): Promise<void> {
    await this.addEntry({
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      context,
      message,
      data,
    });
  }

  public static async getLogs(): Promise<LogEntry[]> {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      return result[STORAGE_KEY] || [];
    }
    return [];
  }

  public static async clearLogs(): Promise<void> {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.remove(STORAGE_KEY);
    }
  }
}
