'use strict';

/**
 * What this process serves. One codebase, several shapes:
 *
 *   PROCESS_ROLE=all       (default) HTTP API + Socket.IO + background jobs — today's single server
 *   PROCESS_ROLE=api       HTTP API only; socket connections are refused, no jobs
 *   PROCESS_ROLE=realtime  Socket.IO (and the HTTP API, so a misrouted request still works); no jobs
 *   PROCESS_ROLE=worker    background jobs only; HTTP serves /api/health, sockets are refused
 *   PROCESS_ROLE=storage   file upload/download only (/api/v2/uploads, /api/upload); sits next to
 *                          the object store and takes the large request bodies off the API nodes
 *
 * Any role other than "all" needs REDIS_URL so that events emitted by one
 * process (a reminder from a worker, a message from an API node) reach the
 * sockets held by another through the Socket.IO Redis adapter.
 */

const ROLES = ['all', 'api', 'realtime', 'worker', 'storage'];

function resolveRole(env = process.env) {
    const raw = String(env.PROCESS_ROLE || 'all').trim().toLowerCase();
    return ROLES.includes(raw) ? raw : 'all';
}

function capabilities(role) {
    switch (role) {
        case 'api': return { http: true, sockets: false, jobs: false, storage: true };
        case 'realtime': return { http: true, sockets: true, jobs: false, storage: true };
        case 'worker': return { http: false, sockets: false, jobs: true };
        case 'storage': return { http: false, sockets: false, jobs: false, storage: true };
        default: return { http: true, sockets: true, jobs: true, storage: true };
    }
}

const role = resolveRole();
const serves = capabilities(role);

/** Problems with the chosen role and environment, for a loud log line at boot. */
function roleWarnings(env = process.env, r = role) {
    const out = [];
    if (r !== 'all' && !env.REDIS_URL) {
        out.push(`PROCESS_ROLE=${r} needs REDIS_URL so processes can reach each other's sockets; events will not leave this process.`);
    }
    return out;
}

module.exports = { ROLES, role, serves, resolveRole, capabilities, roleWarnings };
