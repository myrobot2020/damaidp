import { defineConfig } from "@playwright/test";

export default defineConfig({
  // Keep Playwright e2e tests separate from Vitest unit tests under `src/**/__tests__`.
  testDir: "./tests",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    // The audit test targets production; keep tracing off by default.
    trace: "off",
  },
});

