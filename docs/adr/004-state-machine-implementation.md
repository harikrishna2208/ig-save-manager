# ADR-004: State Machine Implementation

## Context

Managing asynchronous execution, pause states, rate-limiting locks, retries, and failures using scattered boolean flags leads to "state leakage" and unexpected behaviors (e.g., triggering simultaneous loops or failing to stop active calls). A formal, deterministic state machine ensures state consistency.

## Decision

We will control the background queue using a strict State Machine pattern defined by:

1. **State Enum (`QueueState`)**:
   * `IDLE`: No queue defined.
   * `LOADING`: Fetching queue items/checking session.
   * `READY`: Loaded items, waiting to start.
   * `RUNNING`: Actively processing items.
   * `PAUSED`: User paused execution.
   * `RATE_LIMITED`: Instagram HTTP 429 encountered, waiting for backoff.
   * `RETRYING`: Waking up to retry after rate-limiting.
   * `CANCELLING`: Stop request received, cleaning up.
   * `COMPLETED`: Finished processing all items.
   * `FAILED`: Stopped due to structural error (e.g. invalid credentials).

2. **Transition Rules**: State transitions must follow a strict flow. Direct jumps from `IDLE` to `RUNNING` or `FAILED` to `RUNNING` without initialization are invalid.
3. **Trigger Events**: Commands like `start()`, `pause()`, `resume()`, `cancel()` trigger transitions and execute side-effects (scheduling alarms, updating storage).

## Consequences

* **Pros**:
  * Eliminates concurrent loop execution bugs.
  * Predictable state transitions simplify debugging and test coverage.
  * Synchronized status reporting to UI is deterministic.
* **Cons**:
  * Requires explicit routing of events through a state engine, adding structure.
