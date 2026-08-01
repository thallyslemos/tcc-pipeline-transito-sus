import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "uv run uvicorn backend.app:app --host 127.0.0.1 --port 8000",
      cwd: path.resolve(process.cwd(), ".."),
      url: "http://localhost:8000/",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "npm run dev -- --hostname 127.0.0.1 --port 3000",
      cwd: process.cwd(),
      url: "http://localhost:3000/",
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_API_URL: "http://localhost:8000",
      },
    },
  ],
});
