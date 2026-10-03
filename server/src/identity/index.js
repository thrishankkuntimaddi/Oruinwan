'use strict';

/**
 * Identity lives in PostgreSQL (migration 0006_identity): companies, users,
 * workspaces and memberships, departments, teams, role permissions, E2EE keys
 * and sessions. This was a clean cutover — there is no MongoDB fallback.
 * `identityStore()` is kept for the health check and reports 'pg' whenever
 * DATABASE_URL is set. Rules for callers: src/identity/README.md.
 */

const { isPostgresEnabled } = require('../shared/postgres');

function identityStore(env = process.env) {
    return isPostgresEnabled(env) ? 'pg' : 'unconfigured';
}

const usePg = (env) => identityStore(env) === 'pg';

module.exports = {
    identityStore,
    usePg,
    users: require('./users.repo'),
    companies: require('./companies.repo'),
    workspaces: require('./workspaces.repo'),
    ...require('./orgs.repo'),        // departments, teams, rolePermissions, workspacePermissions
    ...require('./keys.repo'),        // identityKeys, cryptoState, conversationKeys
    ...require('./sessions.repo'),    // deviceSessions, loginSessions
    newId: require('./sql').newId,
};
