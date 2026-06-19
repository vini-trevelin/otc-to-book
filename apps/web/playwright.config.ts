import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry"
  },
  webServer: [
    {
      command:
        "cd ../api && PYTHONPATH=src uv run uvicorn otc_to_book.api.main:app --host 127.0.0.1 --port 8000",
      reuseExistingServer: true,
      timeout: 120_000,
      url: "http://127.0.0.1:8000/health"
    },
    {
      command: "pnpm dev --hostname 127.0.0.1 --port 3000",
      reuseExistingServer: true,
      timeout: 120_000,
      url: "http://127.0.0.1:3000"
    }
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
