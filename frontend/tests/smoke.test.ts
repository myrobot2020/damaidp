import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:8080";

test.describe("DAMA Smoke Tests", () => {
  test("home page loads without 500 error", async ({ page }) => {
    await page.goto(BASE_URL);
    // Check that we don't see the "Something went wrong" error component
    const errorText = page.locator("text=Something went wrong");
    await expect(errorText).not.toBeVisible();

    // Check for core brand element
    await expect(page.locator("text=DAMA")).toBeVisible();
  });

  test("sutta page loads (AN 5.4.40)", async ({ page }) => {
    await page.goto(`${BASE_URL}/sutta/AN 5.4.40`);
    await expect(page.locator("text=Something went wrong")).not.toBeVisible();

    // Check for sutta title
    await expect(page.locator("text=Sālandana Sutta")).toBeVisible();

    // Check that audio player exists
    const playButton = page.locator('button[aria-label="Play"]');
    await expect(playButton).toBeVisible();
  });

  test("browse page loads", async ({ page }) => {
    await page.goto(`${BASE_URL}/browse`);
    await expect(page.locator("text=Something went wrong")).not.toBeVisible();
    await expect(page.locator("text=Search")).toBeVisible();
  });

  test("tree page loads", async ({ page }) => {
    await page.goto(`${BASE_URL}/tree`);
    await expect(page.locator("text=Something went wrong")).not.toBeVisible();
    await expect(page.locator("text=Leaves")).toBeVisible();
  });

  test("profile page loads", async ({ page }) => {
    await page.goto(`${BASE_URL}/profile`);
    await expect(page.locator("text=Something went wrong")).not.toBeVisible();
    await expect(page.locator("text=Theme")).toBeVisible();
  });
});
