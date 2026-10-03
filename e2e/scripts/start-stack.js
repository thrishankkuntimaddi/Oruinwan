#!/usr/bin/env node
'use strict';

/**
 * Starts the API server for the browser tests against a throwaway database.
 *
 *   1. Drops and re-seeds the E2E databases, MongoDB and PostgreSQL (never the
 *      dev/prod ones: both must name a database ending in "_e2e").
 *   2. Spawns server/server.js with a fixed, self-contained environment so the
 *      run does not depend on server/.env and cannot send email or reach Redis.
 *
 * Playwright's webServer runs this and waits for /api/health.
 */

const path = require('path');
const { spawn } = require('child_process');
const { E2E } = require('./config');
const { seed } = require('./seed');
const { e2eDatabaseName } = require('./pg');

async function main() {
  const dbName = new URL(E2E.mongoUri).pathname.slice(1);
  if (!dbName.endsWith('_e2e')) {
    throw new Error(`Refusing to wipe ${E2E.mongoUri}: E2E database names must end in "_e2e".`);
  }

  e2eDatabaseName(E2E.databaseUrl);

  await seed(E2E.mongoUri, E2E.databaseUrl);

  const serverDir = path.join(__dirname, '..', '..', 'server');
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NODE_ENV: 'test',
    PORT: String(E2E.apiPort),
    MONGO_URI: E2E.mongoUri,
    DATABASE_URL: E2E.databaseUrl,
    // Pin store choices so a developer's server/.env cannot change what the tests exercise.
    TASKS_STORE: 'pg',
    PROCESS_ROLE: 'all',
    FRONTEND_URL: E2E.webUrl,
    BACKEND_URL: E2E.apiUrl,
    ACCESS_TOKEN_SECRET: E2E.accessTokenSecret,
    REFRESH_TOKEN_SECRET: E2E.refreshTokenSecret,
    GOOGLE_CLIENT_ID: 'e2e-google-client-id',
    SERVER_KEK: E2E.serverKek,
    // Own 32-byte key-encryption key: never inherit CRYPTO_KEK_* from server/.env.
    CRYPTO_KEK_ACTIVE_VERSION: '1',
    CRYPTO_KEK_V1: 'e2e1'.repeat(16),
    SERVER_CRYPTO_KEK: '',
    LOG_LEVEL: process.env.E2E_SERVER_LOG_LEVEL || 'warn',
    // Defined-but-empty values stop dotenv from loading real ones from server/.env.
    BREVO_API_KEY: '',
    SMTP_HOST: '',
    SMTP_FALLBACK_HOST: '',
    REDIS_URL: '',
    GEMINI_API_KEY: '',
    FEATURES_ENABLED: '',
    STORAGE_DRIVER: 'local',
    LOCAL_UPLOAD_DIR: path.join(__dirname, '..', '.auth', 'uploads'),
  };

  // Blank every other key in a developer's server/.env, so dotenv cannot fill
  // gaps from it and a local run behaves exactly like CI (where there is no .env).
  const fs = require('fs');
  const devEnvPath = path.join(serverDir, '.env');
  if (fs.existsSync(devEnvPath)) {
    for (const line of fs.readFileSync(devEnvPath, 'utf8').split(/\r?\n/)) {
      const key = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1];
      if (key && !(key in env)) env[key] = '';
    }
  }

  const child = spawn(process.execPath, ['server.js'], { cwd: serverDir, env, stdio: 'inherit' });
  const stop = (signal) => { if (!child.killed) child.kill(signal); };
  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGTERM', () => stop('SIGTERM'));
  child.on('exit', (code) => process.exit(code ?? 0));
}

main().catch((err) => {
  console.error('[e2e] Failed to start the stack:', err);
  process.exit(1);
});
