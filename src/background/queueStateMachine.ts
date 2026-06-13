import { QueueState, type QueueProgress } from "../types";
import { StorageService } from "../services/storage";
import { Logger } from "../services/logger";

export class QueueStateMachine {
  private static progress: QueueProgress = this.getInitialProgress();
  private static onStateChangeListeners: ((progress: QueueProgress) => void)[] = [];

  private static getInitialProgress(): QueueProgress {
    return {
      state: QueueState.IDLE,
      currentIndex: 0,
      totalItems: 0,
      processedItems: 0,
      retryCount: 0,
      lastUpdated: new Date().toISOString(),
      mediaIds: [],
    };
  }

  public static getProgress(): QueueProgress {
    return { ...this.progress };
  }

  public static addStateChangeListener(listener: (progress: QueueProgress) => void): void {
    this.onStateChangeListeners.push(listener);
  }

  public static removeStateChangeListener(listener: (progress: QueueProgress) => void): void {
    this.onStateChangeListeners = this.onStateChangeListeners.filter((l) => l !== listener);
  }

  private static async transitionTo(nextState: QueueState, error?: string): Promise<void> {
    const previousState = this.progress.state;
    if (previousState === nextState && !error) return;

    // Validate transition
    if (!this.isValidTransition(previousState, nextState)) {
      await Logger.warn(
        "QueueStateMachine",
        `Invalid state transition attempted: ${previousState} -> ${nextState}`,
      );
      return;
    }

    await Logger.info("QueueStateMachine", `Transitioning: ${previousState} -> ${nextState}`);
    this.progress.state = nextState;
    this.progress.lastUpdated = new Date().toISOString();
    if (error) {
      this.progress.error = error;
    } else {
      delete this.progress.error;
    }

    // Save checkpoint
    await StorageService.setQueueProgress(this.progress);

    // Notify listeners
    for (const listener of this.onStateChangeListeners) {
      try {
        listener({ ...this.progress });
      } catch (err) {
        console.error("State listener error", err);
      }
    }
  }

  private static isValidTransition(from: QueueState, to: QueueState): boolean {
    const valid: Partial<Record<QueueState, QueueState[]>> = {
      [QueueState.IDLE]:         [QueueState.LOADING],
      [QueueState.LOADING]:      [QueueState.READY, QueueState.FAILED],
      [QueueState.READY]:        [QueueState.RUNNING, QueueState.IDLE, QueueState.FAILED, QueueState.CANCELLING],
      [QueueState.RUNNING]:      [QueueState.PAUSED, QueueState.RATE_LIMITED, QueueState.COMPLETED, QueueState.FAILED, QueueState.CANCELLING],
      [QueueState.PAUSED]:       [QueueState.RUNNING, QueueState.CANCELLING, QueueState.FAILED],
      [QueueState.RATE_LIMITED]: [QueueState.RETRYING, QueueState.CANCELLING, QueueState.FAILED],
      [QueueState.RETRYING]:     [QueueState.RUNNING, QueueState.RATE_LIMITED, QueueState.FAILED, QueueState.CANCELLING],
      [QueueState.CANCELLING]:   [QueueState.IDLE],
      [QueueState.COMPLETED]:    [QueueState.IDLE],
      [QueueState.FAILED]:       [QueueState.IDLE, QueueState.LOADING],
    };
    return valid[from]?.includes(to) ?? false;
  }

  public static async loadFromStorage(): Promise<boolean> {
    const saved = await StorageService.getQueueProgress();
    if (saved) {
      this.progress = saved;
      await Logger.info(
        "QueueStateMachine",
        `Loaded queue progress from storage. State: ${this.progress.state}, Index: ${this.progress.currentIndex}`,
      );
      return true;
    }
    return false;
  }

  public static async initialize(mediaIds: string[], collectionId?: string): Promise<void> {
    await this.transitionTo(QueueState.LOADING);
    this.progress = {
      state: QueueState.LOADING,
      currentIndex: 0,
      totalItems: mediaIds.length,
      processedItems: 0,
      retryCount: 0,
      lastUpdated: new Date().toISOString(),
      mediaIds,
      collectionId,
    };
    await this.transitionTo(QueueState.READY);
  }

  public static async start(): Promise<void> {
    if (this.progress.state !== QueueState.READY) {
      throw new Error(`Cannot start queue from state: ${this.progress.state}`);
    }
    await this.transitionTo(QueueState.RUNNING);
  }

  public static async pause(): Promise<void> {
    if (this.progress.state !== QueueState.RUNNING) return;
    await this.transitionTo(QueueState.PAUSED);
  }

  public static async resume(): Promise<void> {
    if (this.progress.state !== QueueState.PAUSED) return;
    await this.transitionTo(QueueState.RUNNING);
  }

  public static async rateLimit(): Promise<void> {
    if (this.progress.state !== QueueState.RUNNING) return;
    this.progress.retryCount += 1;
    await this.transitionTo(QueueState.RATE_LIMITED);
  }

  public static async retry(): Promise<void> {
    if (this.progress.state !== QueueState.RATE_LIMITED) return;
    await this.transitionTo(QueueState.RETRYING);
  }

  public static async complete(): Promise<void> {
    await this.transitionTo(QueueState.COMPLETED);
  }

  public static async fail(errorMessage: string): Promise<void> {
    await this.transitionTo(QueueState.FAILED, errorMessage);
  }

  public static async cancel(): Promise<void> {
    await this.transitionTo(QueueState.CANCELLING);
    await StorageService.clearQueueProgress();
    this.progress = this.getInitialProgress();
    await this.transitionTo(QueueState.IDLE);
  }

  public static async updateProgress(processedIncrement = 1): Promise<void> {
    this.progress.currentIndex += 1;
    this.progress.processedItems += processedIncrement;
    this.progress.lastUpdated = new Date().toISOString();
    await StorageService.setQueueProgress(this.progress);

    // Notify listeners
    for (const listener of this.onStateChangeListeners) {
      try {
        listener({ ...this.progress });
      } catch (err) {
        console.error("State listener error", err);
      }
    }
  }

  public static resetRetryCount(): void {
    this.progress.retryCount = 0;
  }
}
