# Development Guide

Welcome to the development guide for the revamped Instagram Unsaver extension. This document describes our standards, design systems, and code quality workflows.

## Directory Structure

```
D:\project\instgram-unsave\
├── public/                 # Static assets, popup.html, manifest.json
├── src/                    # Source files
│   ├── background/         # Service worker execution and state machine queue
│   ├── components/         # Shared UI elements (Button, Grid, PreviewModal)
│   ├── options/            # Options configuration page
│   ├── popup/              # Main Popup React mount and shell
│   ├── screens/            # UI navigation screens (Login, Collections, Selection, Queue)
│   ├── services/           # Business logic clients (API, storage, logging, downloader)
│   ├── styles/             # Global CSS templates (themes, layouts, typography)
│   └── __tests__/          # Vitest unit test suites
├── docs/                   # Architectural decisions (ADRs) and user guides
├── e2e/                    # Playwright end-to-end tests
└── package.json            # Scripts and dependencies
```

## Coding Standards & Biome

We use **Biome** as our all-in-one formatter, linter, and import organizer. We do not use Prettier or ESLint.
* To check formatting and linting:
  ```bash
  npm run lint
  ```
* To format files and auto-apply fixes:
  ```bash
  npm run lint:apply
  ```

Your code must build without compilation errors and pass Biome checks before any commit.

## Styling & Themes

We use **Vanilla CSS** with a design token system mapping variables to HSL values.
* Custom styles are defined in `src/styles/index.css`.
* Light and Dark modes are toggled by appending the `.theme-light` and `.theme-dark` classes to the `body` element.
* Do not use inline styling objects (`style={{ ... }}`) unless dynamic calculation (e.g. positioning overlays, custom sizes) is required. Use standard stylesheet classes.

## Storage Schema & Session Management

All data persistent stores use `chrome.storage.local` or `chrome.storage.sync`.
* Option settings (themes, download flags) are synced via `chrome.storage.sync` using the wrapper `src/services/storage.ts`.
* Unsave Queue state and diagnostic logs are stored locally using `chrome.storage.local` to minimize cross-device sync noise.

## Adding New Features

1. **Feature Flags**: Add new flags to `src/services/featureFlags.ts` to control new or experimental flows.
2. **Logging**: Log significant state modifications and errors using the `Logger` service:
   ```typescript
   import { Logger } from "../services/logger";
   await Logger.info("Queue", "Custom action initiated");
   ```
3. **Tests**: If adding utility code or API endpoints, add Vitest specs inside `src/__tests__/`. If adding UI interactions, write a Playwright case in `e2e/`.
