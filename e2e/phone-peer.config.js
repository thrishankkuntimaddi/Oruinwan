// Manual: the web peer for testing calls from the Android emulator. Reuses an API already running
// on E2E_API_PORT (node scripts/start-stack.js) and starts only the web app.
const path = require('path');
const base = require('./playwright.config');
const { E2E } = require('./scripts/config');

module.exports = {
  ...base,
  testMatch: /zz-phone-peer\.manual\.js/,
  timeout: 240_000,
  webServer: [
    {
      command: `npx vite --port ${E2E.webPort} --strictPort`,
      cwd: path.join(__dirname, '..', 'client'),
      url: E2E.webUrl,
      reuseExistingServer: true,
      timeout: 120_000,
      env: { VITE_BACKEND_URL: E2E.apiUrl, VITE_API_URL: `${E2E.apiUrl}/api`, VITE_GOOGLE_CLIENT_ID: 'e2e-google-client-id' },
    },
  ],
};
