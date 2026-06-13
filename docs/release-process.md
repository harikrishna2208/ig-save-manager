# Release Process

This document outlines the pipeline for releasing updates to the Chrome Web Store.

## Step 1: Pre-Release Verification

Before tagging a release, you must verify the code quality:

1. **Verify Formatting and Linting**:
   Ensure Biome checks pass with zero errors:
   ```bash
   npm run lint
   ```
2. **Execute Unit Tests**:
   Ensure Vitest tests pass:
   ```bash
   npm run test
   ```
3. **Execute E2E Integration Suite**:
   Run all automated Playwright tests:
   ```bash
   npm run test:e2e
   ```
4. **Clean and Compile**:
   Ensure a clean production build compiles without TS warnings:
   ```bash
   npm run clean
   │   npm run build
   ```

---

## Step 2: Versioning

We adhere to Semantic Versioning (SemVer).

1. **Update Manifest**:
   Update the `"version"` field in `public/manifest.json`:
   ```json
   {
     "manifest_version": 3,
     "version": "6.0.0",
     ...
   }
   ```
2. **Update Package Config**:
   Update `package.json`:
   ```json
   {
     "name": "instagram-unsaver-revamp",
     "version": "6.0.0",
     ...
   }
   ```
3. **Run Biome check**:
   Apply Biome check to update any lockfiles.

---

## Step 3: Packaging

To submit the extension to the Chrome Developer Dashboard, you must build a clean zip file of the compiled output.

1. **Produce Build**:
   ```bash
   npm run build
   ```
2. **Zip Dist Directory**:
   Create a zip archive containing the contents of the `dist` directory. Do not zip the parent folder; zip only the child files inside `dist`.
   * On Windows (PowerShell):
     ```powershell
     Compress-Archive -Path .\dist\* -DestinationPath .\unsaver-release-v6.0.0.zip -Force
     ```

---

## Step 4: Submission to Chrome Web Store

1. Open the [Chrome Web Store Developer Console](https://chrome.google.com/webstore/devconsole).
2. Select your extension listing.
3. In the sidebar, select **Package**.
4. Click **Upload new package** and upload `unsaver-release-v6.0.0.zip`.
5. Update promotional tiles, store descriptions, and privacy declarations if permissions were modified.
6. Submit the item for review. Review times can take anywhere from a few hours to several days.
