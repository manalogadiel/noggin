import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3200";
const port = new URL(baseURL).port || "3200";

function loadWebServerEnv(): Record<string, string> {
  const webServerEnv: Record<string, string> = {
    LLM_PROVIDER: "fake",
    DEV_AUTO_LOGIN: "0",
  };

  if (!existsSync(".env.test")) {
    return webServerEnv;
  }

  const parsed = parseEnv(readFileSync(".env.test", "utf8"));
  const apiUrl = parsed.API_URL || parsed.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    parsed.ANON_KEY ||
    parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    parsed.PUBLISHABLE_KEY;
  const serviceKey =
    parsed.SERVICE_ROLE_KEY ||
    parsed.SUPABASE_SERVICE_ROLE_KEY ||
    parsed.SECRET_KEY;

  if (apiUrl) {
    webServerEnv.NEXT_PUBLIC_SUPABASE_URL = apiUrl;
  }
  if (anonKey) {
    webServerEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY = anonKey;
  }
  if (serviceKey) {
    webServerEnv.SUPABASE_SERVICE_ROLE_KEY = serviceKey;
  }

  return webServerEnv;
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run dev -- -p ${port}`,
    url: baseURL,
    env: loadWebServerEnv(),
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
