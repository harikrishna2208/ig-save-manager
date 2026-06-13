# ADR-003: Instagram API Client Design

## Context

The original extension mixed HTTP request building, response parsing, and business logic inside the UI views and a single utility file. This made it difficult to:
* Validate session headers uniformly.
* Safely parse changing Instagram JSON structures.
* Run automated mocking/unit testing on networking functions.

## Decision

We will encapsulate all network requests and parsing logic inside a unified, stateless `InstagramApiClient` class:

1. **Isolation**: Screens and queue execution components never make direct `fetch` calls. They interact only through the `InstagramApiClient` methods.
2. **Credential Management**: The client automatically retrieves CSRF cookies and builds headers (e.g., `x-csrftoken`, user-agent configurations, app-id headers).
3. **Graceful Schema Parsing**: Safe navigation parameters parse different media variants (image, video, carousel) and fallback to defaults without crashing the extension.
4. **Structured Error Raising**: Network errors are mapped to domain-specific error objects (e.g., `AuthenticationError`, `RateLimitError`, `NetworkError`) allowing the caller to make clear state adjustments.

## Consequences

* **Pros**:
  * Unified header and cookie configuration.
  * Extensively mockable using testing tools like Vitest.
  * Centralized changes if Instagram updates their endpoints.
* **Cons**:
  * Slightly higher initial boilerplate code.
