import { describe, it, expect, beforeEach, vi } from "vitest";
import { QueueStateMachine } from "../background/queueStateMachine";
import { QueueState } from "../types";

// Mock the Logger service to prevent writing diagnostic storage lines during tests
vi.mock("../services/logger", () => ({
  Logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock the StorageService
vi.mock("../services/storage", () => ({
  StorageService: {
    setQueueProgress: vi.fn(() => Promise.resolve()),
    clearQueueProgress: vi.fn(() => Promise.resolve()),
  },
}));

describe("QueueStateMachine Tests", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset state machine to idle
    await QueueStateMachine.cancel();
  });

  it("should initialize progress list to READY state", async () => {
    const ids = ["item1", "item2", "item3"];
    await QueueStateMachine.initialize(ids, "test_collection");

    const progress = QueueStateMachine.getProgress();
    expect(progress.state).toBe(QueueState.READY);
    expect(progress.totalItems).toBe(3);
    expect(progress.currentIndex).toBe(0);
    expect(progress.processedItems).toBe(0);
    expect(progress.mediaIds).toEqual(ids);
    expect(progress.collectionId).toBe("test_collection");
  });

  it("should process RUNNING state transitions successfully", async () => {
    const ids = ["item1", "item2"];
    await QueueStateMachine.initialize(ids);
    await QueueStateMachine.start();

    expect(QueueStateMachine.getProgress().state).toBe(QueueState.RUNNING);

    // Update progress index
    await QueueStateMachine.updateProgress();
    let progress = QueueStateMachine.getProgress();
    expect(progress.currentIndex).toBe(1);
    expect(progress.processedItems).toBe(1);

    // Pause state
    await QueueStateMachine.pause();
    expect(QueueStateMachine.getProgress().state).toBe(QueueState.PAUSED);

    // Resume state
    await QueueStateMachine.resume();
    expect(QueueStateMachine.getProgress().state).toBe(QueueState.RUNNING);

    // Complete state
    await QueueStateMachine.complete();
    expect(QueueStateMachine.getProgress().state).toBe(QueueState.COMPLETED);
  });

  it("should handle rate limiting backoff and retries correctly", async () => {
    const ids = ["item1"];
    await QueueStateMachine.initialize(ids);
    await QueueStateMachine.start();

    // Hit Rate Limit
    await QueueStateMachine.rateLimit();
    let progress = QueueStateMachine.getProgress();
    expect(progress.state).toBe(QueueState.RATE_LIMITED);
    expect(progress.retryCount).toBe(1);

    // Transition to Retrying
    await QueueStateMachine.retry();
    expect(QueueStateMachine.getProgress().state).toBe(QueueState.RETRYING);

    // Back to Running
    await QueueStateMachine.start();
    expect(QueueStateMachine.getProgress().state).toBe(QueueState.RUNNING);
  });

  it("should block invalid state transition paths", async () => {
    const ids = ["item1"];
    await QueueStateMachine.initialize(ids);

    // Current state is READY. Directly transitioning to COMPLETED is invalid!
    await (QueueStateMachine as any).transitionTo(QueueState.COMPLETED);
    
    // State should still be READY
    expect(QueueStateMachine.getProgress().state).toBe(QueueState.READY);
  });

  it("should reset state progress on cancel actions", async () => {
    const ids = ["item1", "item2"];
    await QueueStateMachine.initialize(ids);
    await QueueStateMachine.start();
    await QueueStateMachine.cancel();

    const progress = QueueStateMachine.getProgress();
    expect(progress.state).toBe(QueueState.IDLE);
    expect(progress.mediaIds.length).toBe(0);
    expect(progress.totalItems).toBe(0);
  });
});
