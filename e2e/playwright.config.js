// @ts-check
const path = require('path');
const { defineConfig, devices } = require('@playwright/test');
const { E2E } = require('./scripts/config');

const isCI = !!process.env.CI;

module.exports = defineConfig({
  testDir: './tests',
  // The flows share one seeded database, so they run in order in one worker.
  fullyParallel: false,
  workers: 1,
  retries: isCI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  forbidOnly: isCI,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: E2E.webUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Video needs Playwright's ffmpeg, which CI installs with the browser.
    video: isCI ? 'retain-on-failure' : 'off',
    // Locally, use the installed Chrome; CI installs Playwright's Chromium.
    ...(isCI ? {} : { channel: 'chrome' }),
    // Huddles need a microphone: grant it and feed a synthetic audio track.
    permissions: ['microphone'],
    launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], ...(isCI ? {} : { channel: 'chrome' }) } }],
  webServer: [
    {
      command: 'node scripts/start-stack.js',
      url: `${E2E.apiUrl}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: `npx vite --port ${E2E.webPort} --strictPort`,
      cwd: path.join(__dirname, '..', 'client'),
      url: E2E.webUrl,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        VITE_BACKEND_URL: E2E.apiUrl,
        VITE_API_URL: `${E2E.apiUrl}/api`,
        VITE_GOOGLE_CLIENT_ID: 'e2e-google-client-id',
      },
    },
  ],
});
