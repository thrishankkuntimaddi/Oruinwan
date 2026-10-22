// @ts-check
// The desktop app itself (Electron), against a throwaway local stack: `npm run test:e2e`
// from desktop/ (see README). Build the app for that stack first:
//   VITE_SERVER_URL=http://localhost:8103 node scripts/bundle-app.mjs
const path = require('path');

// The E2E stack's ports and databases for this run (read by e2e/scripts/config.js).
process.env.E2E_API_PORT = process.env.E2E_API_PORT || '8103';
process.env.E2E_WEB_PORT = process.env.E2E_WEB_PORT || '3103';  // unused: both people use the app
process.env.E2E_MONGO_URI = process.env.E2E_MONGO_URI || 'mongodb://127.0.0.1:27017/oruinwan_desktop_e2e';
process.env.E2E_DATABASE_URL = process.env.E2E_DATABASE_URL || 'postgres://oruinwan:oruinwan-dev@127.0.0.1:5432/oruinwan_desktop_e2e';

const { defineConfig } = require('@playwright/test');
const { E2E } = require('../../e2e/scripts/config');

module.exports = defineConfig({
  testDir: __dirname,
  fullyParallel: false,
  workers: 1,
  timeout: 300_000,
  expect: { timeout: 30_000 },
  reporter: [['list']],
  use: { trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'node scripts/start-stack.js',
      cwd: path.join(__dirname, '..', '..', 'e2e'),
      url: `${E2E.apiUrl}/api/health`,
      reuseExistingServer: false,
      timeout: 300_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
