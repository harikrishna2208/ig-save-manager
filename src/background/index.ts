import { QueueStateMachine } from "./queueStateMachine";
import { InstagramApiClient, RateLimitError, AuthenticationError } from "../services/instagramApiClient";
import { DownloaderService } from "../services/downloader";
import { StorageService } from "../services/storage";
import { Logger } from "../services/logger";
import { QueueState, type Media } from "../types";

const ALARM_NAME = "rate_limit_retry_alarm";
const ITEMS_STORAGE_KEY = "unsave_queue_items";

let activePort: chrome.runtime.Port | null = null;
let isLoopRunning = false;

// 1. Establish Messaging Ports with Popup UI
if (typeof chrome !== "undefined" && chrome.runtime) {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== "instagram_unsave_port") return;
    activePort = port;
    awaitLogger("Port connected to Popup UI");

    // Immediately synchronize popup with current state
    sendStateUpdate();

    port.onMessage.addListener(async (msg) => {
      try {
        switch (msg.type) {
          case "START":
            await startQueue(msg.mediaItems, msg.collectionId);
            break;
          case "PAUSE":
            await QueueStateMachine.pause();
            break;
          case "RESUME":
            await QueueStateMachine.resume();
            triggerLoop();
            break;
          case "CANCEL":
            await QueueStateMachine.cancel();
            await chrome.storage.local.remove(ITEMS_STORAGE_KEY);
            break;
          case "SYNC":
            sendStateUpdate();
            break;
        }
      } catch (err) {
        await Logger.error("BackgroundPort", "Error processing message", err);
      }
    });

    port.onDisconnect.addListener(() => {
      activePort = null;
      awaitLogger("Port disconnected from Popup UI");
    });
  });

  // 2. Handle Startup Queue Recovery
  chrome.runtime.onStartup.addListener(() => {
    handleRecovery();
  });

  chrome.runtime.onInstalled.addListener(() => {
    handleRecovery();
  });

  // 3. Listen for Rate Limit Alarms
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === ALARM_NAME) {
      await Logger.info("BackgroundAlarm", "Backoff alarm fired. Attempting queue retry.");
      await handleAlarmRetry();
    }
  });
}

async function awaitLogger(msg: string) {
  await Logger.debug("BackgroundService", msg);
}

function sendStateUpdate() {
  if (activePort) {
    try {
      activePort.postMessage({
        type: "QUEUE_UPDATE",
        progress: QueueStateMachine.getProgress(),
      });
    } catch (err) {
      console.error("Failed to post message over port", err);
    }
  }
}

// Subscribe state machine to auto-push updates to active ports
QueueStateMachine.addStateChangeListener(() => {
  sendStateUpdate();
});

async function startQueue(mediaItems: Media[], collectionId?: string) {
  await Logger.info("BackgroundQueue", `Initializing queue with ${mediaItems.length} items`);
  
  // Store full media objects in local storage for background availability
  await chrome.storage.local.set({ [ITEMS_STORAGE_KEY]: mediaItems });

  const mediaIds = mediaItems.map((m) => m.id);
  await QueueStateMachine.initialize(mediaIds, collectionId);
  await QueueStateMachine.start();
  
  triggerLoop();
}

function triggerLoop() {
  if (isLoopRunning) return;
  isLoopRunning = true;
  runExecutionLoop().finally(() => {
    isLoopRunning = false;
  });
}

async function runExecutionLoop() {
  awaitLogger("Execution loop started");

  while (QueueStateMachine.getProgress().state === QueueState.RUNNING) {
    const progress = QueueStateMachine.getProgress();
    const idx = progress.currentIndex;

    if (idx >= progress.totalItems) {
      await Logger.info("BackgroundQueue", "Queue completed successfully");
      await QueueStateMachine.complete();
      await chrome.storage.local.remove(ITEMS_STORAGE_KEY);
      break;
    }

    // Retrieve media item
    const storageData = await chrome.storage.local.get(ITEMS_STORAGE_KEY);
    const items: Media[] = storageData[ITEMS_STORAGE_KEY] || [];
    const media = items[idx];

    if (!media) {
      await Logger.error("BackgroundQueue", `Media item missing at index ${idx}`);
      await QueueStateMachine.fail(`Media item missing at index ${idx}`);
      break;
    }

    try {
      const prefs = await StorageService.getPreferences();

      // Step A: Download if enabled
      if (prefs.downloadMedia) {
        awaitLogger(`Downloading item: ${media.id}`);
        try {
          await DownloaderService.downloadItem(media, prefs.includeThumbnails);
        } catch (err) {
          await Logger.error("BackgroundQueue", `Download failed for: ${media.id}`, err);
          // Non-fatal, proceed to unsave
        }
      }

      // Step B: Unsave API call
      awaitLogger(`Unsaving item: ${media.id}`);
      await InstagramApiClient.unsaveMedia(media.id);

      // Reset retry count on successful API call
      QueueStateMachine.resetRetryCount();

      // Step C: Shift progress
      await QueueStateMachine.updateProgress();

      // Step D: Intercept status and await delay
      if (QueueStateMachine.getProgress().state === QueueState.RUNNING) {
        // Add random jitter +/- 10% to prevent strict timing profiles
        const jitter = (Math.random() - 0.5) * 0.2 * prefs.waitTime;
        const delay = Math.max(100, prefs.waitTime + jitter);
        await wait(delay);
      }

    } catch (err) {
      if (err instanceof RateLimitError) {
        await Logger.warn("BackgroundQueue", "Instagram rate limit hit. Pausing for alarm backoff.");
        await scheduleRateLimitBackoff();
        break;
      } else if (err instanceof AuthenticationError) {
        await Logger.error("BackgroundQueue", "Authentication lost during execution.", err);
        await QueueStateMachine.fail("Authentication lost. Please login to Instagram.");
        break;
      } else {
        await Logger.error("BackgroundQueue", `Unexpected error processing item: ${media.id}`, err);
        await QueueStateMachine.fail((err as Error).message);
        break;
      }
    }
  }

  awaitLogger("Execution loop ended");
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Calculates backoff duration: Attempt 1 = 1m, Attempt 2 = 2m, Attempt 3 = 3m, Attempt 4+ = 5m
async function scheduleRateLimitBackoff() {
  await QueueStateMachine.rateLimit();
  const retryCount = QueueStateMachine.getProgress().retryCount;
  let delayInMinutes = 1;

  if (retryCount === 2) delayInMinutes = 2;
  else if (retryCount === 3) delayInMinutes = 3;
  else if (retryCount >= 4) delayInMinutes = 5;

  await Logger.warn("BackgroundQueue", `Scheduling rate limit backoff alarm for ${delayInMinutes} minute(s)`);
  
  if (typeof chrome !== "undefined" && chrome.alarms) {
    chrome.alarms.create(ALARM_NAME, { delayInMinutes });
  }
}

async function handleAlarmRetry() {
  await QueueStateMachine.retry();
  const valid = await InstagramApiClient.validateSession();
  
  if (valid) {
    await Logger.info("BackgroundQueue", "Session re-validated successfully. Resuming queue.");
    await QueueStateMachine.start();
    triggerLoop();
  } else {
    await Logger.error("BackgroundQueue", "Session verification failed after rate-limiting backoff.");
    await QueueStateMachine.fail("Session expired. Please log in to Instagram again.");
  }
}

async function handleRecovery() {
  const isLoaded = await QueueStateMachine.loadFromStorage();
  if (!isLoaded) return;

  const progress = QueueStateMachine.getProgress();
  const recoverableStates = [
    QueueState.RUNNING,
    QueueState.PAUSED,
    QueueState.RATE_LIMITED,
    QueueState.RETRYING,
  ];

  if (recoverableStates.includes(progress.state)) {
    await Logger.info("BackgroundRecovery", `Interrupted queue session detected: ${progress.state}`);
    
    // Shift to loading to run verification
    await QueueStateMachine.loadFromStorage(); 
    
    const valid = await InstagramApiClient.validateSession();
    if (valid) {
      if (progress.state === QueueState.RUNNING || progress.state === QueueState.RETRYING) {
        await Logger.info("BackgroundRecovery", "Valid session found. Resuming running queue.");
        // Set state back to RUNNING and restart loop
        progress.state = QueueState.RUNNING;
        await StorageService.setQueueProgress(progress);
        triggerLoop();
      } else if (progress.state === QueueState.RATE_LIMITED) {
        await Logger.info("BackgroundRecovery", "Queue is rate limited. Resetting alarm.");
        // Re-trigger alarm in case it got cleared
        chrome.alarms.create(ALARM_NAME, { delayInMinutes: 1 });
      }
    } else {
      await Logger.warn("BackgroundRecovery", "Session invalid on recovery. Marking queue as failed.");
      await QueueStateMachine.fail("Session expired. Please log in to Instagram again.");
    }
  }
}
