# ADR-001: Background Queue Architecture

## Context

In the original extension codebase, the unsaving and downloading loops executed entirely within the context of the React Popup script. However, Chrome extension popups are transient: as soon as the user clicks away or closes the popup, the script context is destroyed. This halts any running operations mid-progress, forcing users to keep the popup window open throughout long-running unsave operations.

## Decision

We will decouple the unsave and download task execution from the Popup UI and place it inside the Manifest V3 Background Service Worker.

1. **State Ownership**: The Background Service Worker owns the queue state, processing scheduler, and execution loop.
2. **UI Communication**: The Popup UI connects to the Service Worker via `chrome.runtime.connect` (establishing a messaging port). 
3. **Execution Continuity**: When the popup is closed, the connection port disconnects, but the Background Service Worker continues running the active queue. When the popup is opened, it reconnects, queries the current state of the queue, and resynchronizes.

## Consequences

* **Pros**:
  * Operations can run uninterrupted for thousands of posts.
  * Resilient to transient UI lifecycles.
  * Better error logging and state management.
* **Cons**:
  * Service worker state must be synchronized via messaging.
  * Background Service Workers in MV3 are ephemeral and can be terminated by the browser during inactive periods. We must employ alarms (`chrome.alarms`) to wake up and sustain the worker when the queue is running.
