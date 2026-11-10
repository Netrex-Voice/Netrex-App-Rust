// @ts-check
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "e2e/tests",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1, // tek emülatör verisini paylaşıyoruz
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e/.output/report" }]],
  outputDir: "e2e/.output/results",
  use: {
    baseURL: "http://127.0.0.1:3200",
    channel: "msedge", // sistemdeki Edge (ayrı tarayıcı indirmez)
    headless: true,
    viewport: { width: 1400, height: 900 },
    permissions: ["microphone", "camera"],
    launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node e2e/stack.mjs",
    url: "http://127.0.0.1:3999",
    timeout: 360_000,
    reuseExistingServer: true,
  },
});
