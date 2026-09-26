'use strict';

/**
 * One place for the E2E stack's ports, URLs, secrets and seeded accounts.
 * The secrets are test-only values; the database is dropped on every run.
 */

const apiPort = Number(process.env.E2E_API_PORT || 8095);
const webPort = Number(process.env.E2E_WEB_PORT || 3095);

const E2E = {
  apiPort,
  webPort,
  apiUrl: `http://localhost:${apiPort}`,
  webUrl: `http://localhost:${webPort}`,
  mongoUri: process.env.E2E_MONGO_URI || 'mongodb://127.0.0.1:27017/chttrix_e2e',
  accessTokenSecret: 'e2e-access-token-secret-not-for-production',
  refreshTokenSecret: 'e2e-refresh-token-secret-not-for-production',
  serverKek: 'e2e0'.repeat(16),
  password: 'E2e-Passw0rd!',
  workspaceName: 'E2E Workspace',
  users: {
    alice: { username: 'alice', email: 'alice@e2e.oruinwan.test' },
    // A tiny inline image stands in for an uploaded photo (no network needed).
    bob: {
      username: 'bob',
      email: 'bob@e2e.oruinwan.test',
      profilePicture: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxIDEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiMzYjgyZjYiLz48L3N2Zz4=',
    },
    // Not a member of the seeded workspace: used for access-control checks.
    carol: { username: 'carol', email: 'carol@e2e.oruinwan.test' },
  },
};

module.exports = { E2E };
