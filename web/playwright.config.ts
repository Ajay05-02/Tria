import path from "node:path"
import { defineConfig, devices } from "@playwright/test"

// End-to-end tests drive the real app in a real browser. They start the FastAPI server themselves (port 7861, so
// they never clash with a dev server on 7860) and run on a desktop and a phone-sized screen.
// Locally they use the Chrome that is already installed; in CI, Playwright's own Chromium.
const channel = process.env.CI ? undefined : "chrome"

// CI has no graphics card, so the 3D heart is drawn in software, which is many times slower. Set E2E_SOFTWARE_GL=1 to
// run that way on your own machine.
const software = !!process.env.CI || !!process.env.E2E_SOFTWARE_GL

export default defineConfig({
  testDir: "./e2e",
  // generous: a few pages drawing the 3D heart at once on one machine slow every test down
  timeout: 120_000,
  expect: { timeout: software ? 30_000 : 8_000 },
  fullyParallel: true,
  workers: software ? 2 : 4,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: "http://127.0.0.1:7861",
    trace: "retain-on-failure",
    launchOptions: { args: software ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : [] },
  },
  webServer: {
    command: `${process.env.PYTHON ?? path.resolve(process.cwd(), "../.venv/bin/python")} -m uvicorn app.main:app --host 127.0.0.1 --port 7861`,
    cwd: "..",
    url: "http://127.0.0.1:7861/api/meta",
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel, viewport: { width: 1280, height: 800 } } },
    { name: "phone", use: { ...devices["Pixel 7"], channel } },
  ],
})
