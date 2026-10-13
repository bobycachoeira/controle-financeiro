import { defineConfig, devices } from "@playwright/test";

// Porta do backend de teste (PocketBase efêmero, subido pela fixture).
const API_URL = "http://127.0.0.1:8091/api";
const APP_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5174";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: APP_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm exec vite --port 5174 --strictPort",
    url: "http://localhost:5174",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { VITE_API_URL: API_URL },
  },
});
