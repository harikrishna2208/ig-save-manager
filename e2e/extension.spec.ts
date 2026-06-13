import { test, expect, chromium, type BrowserContext } from "@playwright/test";
import path from "node:path";

describe("Instagram Unsaver E2E Extension Tests", () => {
  let context: BrowserContext;
  let extensionId: string;

  test.beforeEach(async () => {
    const pathToExtension = path.resolve(__dirname, "../dist");
    
    // Launch browser loading unpacked extension
    context = await chromium.launchPersistentContext("", {
      headless: false, // E2E tests for extensions require headed mode
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });

    // Capture extension ID from background service worker
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent("serviceworker");
    }
    
    // Extract ID from worker URL: chrome-extension://[ID]/js/background.js
    const urlParts = background.url().split("/");
    extensionId = urlParts[2];
  });

  test.afterEach(async () => {
    await context.close();
  });

  test("should load LoginScreen if session is unauthenticated", async ({ page }) => {
    // Open extension popup html page directly in tab for E2E visibility
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Verify loading transitions to Login warning screen
    const loginHeader = page.locator("h2:has-text('Login to Instagram')");
    await expect(loginHeader).toBeVisible();

    const loginBtn = page.locator("button:has-text('Go to Instagram Login')");
    await expect(loginBtn).toBeVisible();
  });

  test("should render resizable presets correctly from storage", async ({ page }) => {
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    
    // Check default class applied on layout container
    const appContainer = page.locator(".app-container");
    await expect(appContainer).toHaveClass(/preset-normal/);
  });

  test("should allow configuring options settings and saving preferences", async ({ page }) => {
    // Navigate directly to extension options page in tab
    await page.goto(`chrome-extension://${extensionId}/options.html`);

    const header = page.locator("h1:has-text('Unsaver for Instagram')");
    await expect(header).toBeVisible();

    // Toggle download media configuration check
    const dlMediaCheck = page.locator("input#dl-media");
    await expect(dlMediaCheck).toBeVisible();
    await dlMediaCheck.check();

    // Select layout size preset
    const sizeSelect = page.locator("select#size-select");
    await sizeSelect.selectOption("expanded");

    // Click save button
    const saveBtn = page.locator("button:has-text('Save Configuration')");
    await saveBtn.click();

    // Verify success alerts
    const statusMsg = page.locator("span:has-text('Settings saved successfully!')");
    await expect(statusMsg).toBeVisible();
  });
});
