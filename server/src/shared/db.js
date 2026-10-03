'use strict';

/**
 * MongoDB connection for the server process.
 *
 *   MONGO_URI               connection string (an Atlas replica set in production)
 *   MONGO_POOL_SIZE         max sockets per process (default 20; raise on big API nodes)
 *   MONGO_MIN_POOL_SIZE     warm connections kept open (default 0)
 *   MONGO_AUTO_INDEX        "false" to stop every boot from running ensureIndexes on 45
 *                           collections; then run `node scripts/syncIndexes.js` on deploy
 *   MONGO_READ_REPLICAS     "true" to send heavy list/report reads to secondaries
 *                           (see `replicaRead`); needs a replica set
 */

const mongoose = require('mongoose');
const logger = require('../../utils/logger');
const { role } = require('./processRole');

const int = (v, d) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : d);

function connectionOptions(env = process.env) {
    return {
        maxPoolSize: int(env.MONGO_POOL_SIZE, 20),
        minPoolSize: int(env.MONGO_MIN_POOL_SIZE, 0),
        serverSelectionTimeoutMS: int(env.MONGO_SERVER_SELECTION_TIMEOUT_MS, 10_000),
        socketTimeoutMS: int(env.MONGO_SOCKET_TIMEOUT_MS, 45_000),
        heartbeatFrequencyMS: 10_000,
        autoIndex: env.MONGO_AUTO_INDEX !== 'false',
        appName: `oruinwan-${role}`,
        compressors: ['zlib'],
    };
}

function readReplicasEnabled(env = process.env) {
    return env.MONGO_READ_REPLICAS === 'true';
}

/**
 * Route a read-only Mongoose query to a secondary when MONGO_READ_REPLICAS is on.
 * Use only for lists and reports where a few hundred ms of lag is fine
 * (audit logs, analytics, AI knowledge rows), never for anything the user
 * just wrote and expects to read back.
 */
function replicaRead(query, env = process.env) {
    if (readReplicasEnabled(env) && query && typeof query.read === 'function') return query.read('secondaryPreferred');
    return query;
}

async function connectDatabase(uri = process.env.MONGO_URI, env = process.env) {
    const opts = connectionOptions(env);
    mongoose.connection.on('disconnected', () => logger.warn('⚠️  [MONGO] disconnected; the driver will keep retrying'));
    mongoose.connection.on('reconnected', () => logger.info('✅ [MONGO] reconnected'));
    await mongoose.connect(uri, opts);
    logger.info(`[MONGO] pool max ${opts.maxPoolSize}, autoIndex ${opts.autoIndex ? 'on' : 'off'}, replica reads ${readReplicasEnabled(env) ? 'on' : 'off'}`);
    return mongoose.connection;
}

module.exports = { connectDatabase, connectionOptions, replicaRead, readReplicasEnabled };
