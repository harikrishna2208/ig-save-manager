# ig-save-manager

> A Chrome extension for browsing, previewing, and bulk-managing your Instagram saved posts. Currently supported on Google Chrome.

---

## Features

### Collection Management

- Browse all your saved collections with cover art grid thumbnails
- Infinite scroll with automatic viewport-fill pagination
- Collection names and post counts displayed cleanly below each tile
- Remembers the last collection you visited across sessions

### Post Grid

- Virtual scrolling grid — handles thousands of posts without DOM bloat
- Filter by type: **All / Images / Videos / Carousels**
- Sort by **Oldest** or **Newest** (with confirmation guard for large collections)
- Position badges on every tile — shows original index (`#85`) even when filtered, so you never lose your place
- Select individual posts or **Select All** in one click
- Tick marks stay visible above hover overlays

### Preview Modal

- Full-screen preview for images and videos
- Carousel navigation with slide counter (`2 / 7`)
- **Skip ⏭** button to jump past an entire carousel to the next post
- Previous / Next post navigation with keyboard support (`←` `→` `Space` `Esc`)
- Adjacent video pre-buffering — next/prev video loads in background while you watch, zero cold-start delay

### Video Player

- Play / Pause, seek bar, timestamp
- Volume control + mute toggle (preference persists across sessions)
- Playback speed: 0.5× / 1× / 1.5× / 2×
- Rotate left / right / reset with **auto-zoom** for 90°/270° — fills black space using the video's aspect ratio
- Autoplay / loop toggle
- **Full-tab mode**: controls auto-hide after 2.5s of inactivity — header, seek bar, footer, and nav arrows all fade out so the video fills the entire window; any mouse movement brings them back

### Image Viewer

- Zoom in / out / reset
- Rotation controls

### Download

- Download individual posts directly from the preview modal
- **Bulk download** selected posts from the grid — sequential with rate-limit delay to avoid browser throttling

### Unsave / Bulk Remove

- Queue engine runs in the background service worker — survives popup close
- Pause / resume / cancel at any time
- Auto rate-limit detection with exponential backoff and retry
- Progress persists — reopening the extension recovers an in-progress queue

### Preferences

- Light / Dark theme
- Popup size: Compact / Normal / Expanded
- Default mute state, autoplay, volume — all synced via `chrome.storage.sync`
- **Open in Tab** button — expands to a full browser tab with a wider layout

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Extension | Chrome Manifest V3 |
| UI | React 18 + TypeScript |
| Bundler | Webpack 5 |
| Linter / Formatter | Biome |
| Unit tests | Vitest |
| E2E tests | Playwright |

---

## Installation (Development)

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode (auto-rebuild on save)
npm run watch
```

Then load the `dist/` folder as an unpacked extension in `chrome://extensions`.

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run build` | Production build |
| `npm run watch` | Development watch mode |
| `npm run test` | Run unit tests |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run lint` | Lint with Biome |
| `npm run lint:apply` | Lint and auto-fix |
| `npm run format` | Format with Biome |

---

## Privacy

- No data leaves your browser
- No analytics, no telemetry, no third-party requests
- Communicates exclusively with Instagram using your existing logged-in session
- Nothing is stored on any server

---

## Permissions

| Permission | Reason |
| --- | --- |
| `storage` | Persist preferences and queue state |
| `downloads` | Save media files to your machine |
| `cookies` | Read Instagram session token for API auth |
| `alarms` | Drive rate-limit retry backoff in the background worker |
| `*.instagram.com` | Access Instagram's API |

---

## Disclaimer

This extension interacts with Instagram's internal API. Use responsibly. Aggressive bulk operations may trigger rate limits on your account.
