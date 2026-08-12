import { test, expect, devices } from "@playwright/test";

test.use({ ...devices["Pixel 5"] });

const BASE = process.env.PW_BASE_URL || "http://localhost:8080";

test("Reflection page shows the current paper prompt controls", async ({ page }) => {
  // Wait for hydration/assets so controls are interactive in headless runs.
  await page.goto(`${BASE}/reflect`, { waitUntil: "networkidle" });

  await expect(page.getByText("A QUESTION, A QUIET THOUGHT")).toBeVisible();
  await expect(page.locator("textarea").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Send/i })).toBeDisabled();
  await expect(page.getByLabel("AI voice")).toBeVisible();
});

test("BuddhaBot reflection flow returns an answer", async ({ page }) => {
  test.setTimeout(180_000);

  page.on("console", (msg) => console.log(`BROWSER[${msg.type()}] ${msg.text()}`));
  page.on("pageerror", (err) => console.log(`BROWSER_ERROR ${err.message}`));

  // Wait for hydration/assets so controls are interactive in headless runs.
  await page.goto(`${BASE}/reflect`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    localStorage.setItem(
      "dama:readingProgress",
      JSON.stringify({ "11.16": { readAtMs: Date.now() } }),
    );
  });

  const textarea = page.locator("textarea").first();
  await textarea.fill("Today I felt scattered and impatient. I want to be kinder.");
  await expect(textarea).toHaveValue(/kinder/);

  const askBtn = page.getByRole("button", { name: /Send/i });
  await expect(askBtn).toBeEnabled({ timeout: 15_000 });
  await askBtn.click();

  await expect(page).toHaveURL(/\/reflect\/(thinking|answer)/);
  const stored = await page.evaluate(() => ({
    reflection: localStorage.getItem("dama:reflection"),
    mode: localStorage.getItem("dama:reflectionMode"),
  }));
  console.log("localStorage", stored);
  // Either we get a response or we land in the error state and choose offline.
  const answerRe = /\/reflect\/answer/;
  const errorButton = page.getByRole("button", { name: "Continue with offline text" });

  await Promise.race([
    // In-app navigation is client-side; wait for the URL change without requiring a full page load.
    expect(page).toHaveURL(answerRe, { timeout: 150_000 }),
    errorButton.waitFor({ state: "visible", timeout: 150_000 }),
  ]);

  if (!page.url().match(answerRe)) {
    await errorButton.click();
    await expect(page).toHaveURL(answerRe, { timeout: 30_000 });
  }

  await expect(page.getByText(/Explanation \((Buddha Bot|offline)\)/)).toBeVisible();
  const text = await page.locator("section").nth(0).textContent();
  expect((text || "").length).toBeGreaterThan(50);
});
