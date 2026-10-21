'use strict';

/**
 * The process-wide collab registry plus the hooks REST code calls:
 *
 *   bindIO(io)                                  emit through this Socket.IO server (local sockets only;
 *                                               peers relay to theirs via collab.replication)
 *   contentChanged(docType, docId, value, opts) a REST write changed the owning record's content
 *   documentDeleted(docType, docId)             the owning record is gone
 *
 * Hooks never throw: a failure is logged and the REST write still succeeds.
 */

const logger = require('../../../utils/logger');
const { CollabRegistry } = require('./collab.registry');

const registry = new CollabRegistry();

function bindIO(io) {
    if (!io || registry._io === io) return;
    registry._io = io;
    registry.emit = (room, event, payload, exceptSocketId) => {
        let target = (io.local || io).to(room);
        if (exceptSocketId && target.except) target = target.except(exceptSocketId);
        target.emit(event, payload);
    };
}

/** Only with a live database (unit tests of REST services never reach MongoDB). */
const dbReady = () => require('mongoose').connection.readyState === 1;

async function contentChanged(docType, docId, value, opts = {}) {
    if (!dbReady() && !registry.get(docType, String(docId))) return;
    try {
        await registry.externalChange(docType, docId, value, opts);
    } catch (err) {
        logger.warn(`[COLLAB] could not apply ${docType}:${docId} REST change to the live document: ${err.message}`);
    }
}

async function documentDeleted(docType, docId) {
    if (!dbReady() && !registry.get(docType, String(docId))) return;
    try {
        await registry.forget(docType, docId);
    } catch (err) {
        logger.warn(`[COLLAB] could not drop ${docType}:${docId}: ${err.message}`);
    }
}

module.exports = { registry, bindIO, contentChanged, documentDeleted };
