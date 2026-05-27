import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.NEXORA_E2E_PORT ?? 3000);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: `next dev --port ${port}`,
    url: baseURL,
    reuseExistingServer: true,
  },
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
});
