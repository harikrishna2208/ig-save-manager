# ADR-002: Service Worker Recovery Strategy

## Context

A Background Service Worker can be terminated due to:
* Browser restarts
* User closing the browser
* Ephemeral worker shutdowns (after 30 seconds of inactivity in Manifest V3)
* Uncaught errors or network dropouts

If a queue is running and the worker gets suspended, the current progress of the unsave queue is lost unless it is persistently tracked and recoverable.

## Decision

We will implement a persistent recovery checkpoint system:

1. **State Checkpointing**: The background queue saves its state object (containing `state`, `currentIndex`, `totalItems`, `processedItems`, `retryCount`, and list of media IDs to process) to `chrome.storage.local` after each processed item.
2. **Startup Verification**: On service worker startup (within the `chrome.runtime.onStartup` listener and global script execution), the worker reads `chrome.storage.local` to verify if there is an interrupted run (state is `RUNNING`, `PAUSED`, `RATE_LIMITED`, or `RETRYING`).
3. **Session Re-validation**: If an unfinished queue is found, the worker validates the Instagram session. If the session is valid, the queue shifts to `PAUSED` (waiting for user instruction) or automatically resumes, depending on options, and notifies any active popup listeners.
4. **Log Diagnostics**: Recovery events are recorded in the structured diagnostic log database.

## Consequences

* **Pros**:
  * Guarantees that large unsaving operations can survive browser restarts or extension updates.
  * Eliminates manual queue reconstruction.
* **Cons**:
  * Increases disk write operations to `chrome.storage.local` (one write per item). Given the rate-limit delay of >=1000ms per request, this is well within Chrome's write frequency limits.
