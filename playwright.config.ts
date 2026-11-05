import { defineConfig, devices } from "@playwright/test";

/**
 * Offline specs run without Supabase (the site shows its "not connected"
 * states). The full journey in e2e/full-flow.spec.ts runs only when
 * E2E_SUPABASE=1 and real keys are in .env.local.
 *
 * Uses the installed Chrome by default (PW_CHANNEL=chromium to use
 * Playwright's own browser after `npx playwright install chromium`).
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const live = process.env.E2E_SUPABASE === "1";
const channel = process.env.PW_CHANNEL ?? "chrome";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    ...(channel === "chromium" ? {} : { channel }),
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], ...(channel === "chromium" ? {} : { channel }) } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `npx next dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 180_000,
    env: live
      ? {}
      : {
          // Force the unconfigured state for offline specs.
          NEXT_PUBLIC_SUPABASE_URL: "",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
          SUPABASE_SERVICE_ROLE_KEY: "",
          OPENROUTER_API_KEY: "",
          ALLOWED_EMAIL_DOMAINS: "srmist.edu.in",
          CRON_SECRET: "e2e-secret",
        },
  },
});
