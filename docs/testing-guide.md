# Testing Guide

This extension contains two testing tiers:
1. **Unit Tests**: Powered by **Vitest** to validate algorithms, clients, state machines, and components.
2. **End-to-End Tests**: Powered by **Playwright** to run UI flows against chromium engines loading the extension.

---

## 1. Unit Testing (Vitest)

Unit tests mock Chrome extensions API variables and test logical units.

* **Location**: `src/__tests__/**/*.test.ts` or `src/__tests__/**/*.test.tsx`.
* **Execution**:
  * Execute a single run:
    ```bash
    npm run test
    ```
  * Run in watch mode:
    ```bash
    npm run test:watch
    ```

### Mocking Chrome APIs in Vitest
Since Vitest runs in a Node environment (or JSDOM), the global `chrome` object is undefined. We use mock fixtures to simulate `chrome.storage`, `chrome.runtime`, and `chrome.cookies` events.

---

## 2. End-to-End Testing (Playwright)

Playwright loads the unpacked extension dynamically and drives UI actions.

* **Location**: `e2e/**/*.spec.ts`
* **Execution**:
  ```bash
  npm run test:e2e
  ```

### How Playwright Loads the Extension
Playwright launches Chromium with the `--disable-extensions-except` and `--load-extension` flags referencing the `dist` directory:

```typescript
import { test, chromium } from "@playwright/test";
import path from "node:path";

test("load extension popup", async () => {
  const pathToExtension = path.resolve(__dirname, "../dist");
  const userDataDir = "/tmp/test-user-data-dir";
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false, // Extensions only load in headed browser sessions
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
    ],
  });
  
  const [backgroundPage] = context.serviceWorkers();
  // Wait or query extension popup page
});
```

### Mocking API Calls during E2E
To avoid hitting real Instagram servers and triggering bot detections during CI, our API client checks a feature flag or global interceptor to serve mock data (e.g. lists of collections and posts) during test runs.
