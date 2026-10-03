'use strict';

/**
 * PostgreSQL for the E2E stack. Identity (users, companies, workspaces,
 * memberships, keys, sessions) lives in PostgreSQL, so every run needs its own
 * throwaway database next to the MongoDB one.
 *
 * `usePostgres()` points this process at the E2E database before any server
 * module opens a pool. `resetDatabase()` drops and recreates it, then applies
 * server/db/migrations. Both refuse a database whose name does not end in "_e2e".
 */

const path = require('path');
const { E2E } = require('./config');

const serverDir = path.join(__dirname, '..', '..', 'server');
const fromServer = (mod) => require(require.resolve(mod, { paths: [serverDir] }));

function e2eDatabaseName(databaseUrl = E2E.databaseUrl) {
  const name = decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
  if (!/_e2e$/.test(name)) {
    throw new Error(`Refusing to use ${databaseUrl}: E2E database names must end in "_e2e".`);
  }
  return name;
}

/** Point the server's PostgreSQL module at the E2E database. Call before requiring server code. */
function usePostgres(databaseUrl = E2E.databaseUrl) {
  e2eDatabaseName(databaseUrl);
  process.env.DATABASE_URL = databaseUrl;
}

/** Drop and recreate the E2E database, then run the server's migrations against it. */
async function resetDatabase(databaseUrl = E2E.databaseUrl) {
  const name = e2eDatabaseName(databaseUrl);
  const { Client } = fromServer('pg');

  // Connect to the maintenance database on the same server to drop/create the E2E one.
  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = '/postgres';
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const quoted = `"${name.replace(/"/g, '""')}"`;
    await admin.query(`DROP DATABASE IF EXISTS ${quoted} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${quoted}`);
  } finally {
    await admin.end();
  }

  usePostgres(databaseUrl);
  const { runMigrations } = require(path.join(serverDir, 'src', 'shared', 'migrations'));
  await runMigrations();
}

/** Close the server-module pool this process opened, so scripts can exit. */
async function closePostgres() {
  const { closePostgres: close } = require(path.join(serverDir, 'src', 'shared', 'postgres'));
  await close();
}

module.exports = { usePostgres, resetDatabase, closePostgres, e2eDatabaseName };
