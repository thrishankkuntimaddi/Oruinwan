'use strict';

/**
 * Which store holds tasks, projects, sprints and milestones.
 *   TASKS_STORE=pg     PostgreSQL (db/migrations/0005_tasks.sql) — needs DATABASE_URL
 *   anything else      MongoDB (models/Task.js and friends), today's default
 */

const { isPostgresEnabled } = require('../../shared/postgres');

function tasksStore(env = process.env) {
    return env.TASKS_STORE === 'pg' && isPostgresEnabled(env) ? 'pg' : 'mongo';
}

/** Thrown by service functions not yet ported to the PostgreSQL store. */
function notOnPgYet() {
    return Object.assign(new Error('Not available on the PostgreSQL task store yet'), { statusCode: 501 });
}

module.exports = { tasksStore, notOnPgYet };
