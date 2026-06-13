# Setup Guide

This guide will help you set up and run the Instagram Unsaver extension locally in your Chrome browser.

## Prerequisites

Ensure you have the following installed on your machine:
* **Node.js**: Version 18.x or 20.x (Recommended)
* **npm**: Installed with Node.js
* **Google Chrome**: (or any Chromium-based browser supporting MV3 extensions)

## Installation & Setup

1. **Clone the Repository** (or navigate to the project directory):
   ```bash
   cd D:\project\instgram-unsave
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Verify Biome Tooling**:
   Confirm that the linter and formatter are working:
   ```bash
   npm run lint
   ```

4. **Build the Extension**:
   Compile the source files into the bundle output:
   * For a one-time production build:
     ```bash
     npm run build
     ```
   * For active development (automatically builds on changes):
     ```bash
     npm run watch
     ```

This compiles your TypeScript and CSS files into a compiled extension folder located at `D:\project\instgram-unsave\dist`.

## Installing the Extension in Chrome

1. Open Google Chrome.
2. Navigate to the extensions page by entering `chrome://extensions/` in the URL bar.
3. In the top-right corner, toggle the **Developer mode** switch to **ON**.
4. In the top-left corner, click **Load unpacked**.
5. Select the `dist` directory located inside your project:
   `D:\project\instgram-unsave\dist`
6. The extension is now loaded and will appear in your Chrome toolbar.

> [!TIP]
> **Download shelf configuration**: For a seamless experience when downloading media, go to Chrome Settings -> Downloads and disable **"Ask where to save each file before downloading"**. Otherwise, the browser will trigger a popup dialog for every downloaded post, blocking automated queue runs.
