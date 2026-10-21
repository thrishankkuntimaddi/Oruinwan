'use strict';

/**
 * Collab module: realtime collaborative editing (Yjs CRDT over Socket.IO) for
 * notes, knowledge pages and meeting whiteboards. No HTTP routes of its own:
 * documents are created, listed and deleted through their existing APIs.
 * Protocol: docs/api/collab.md.
 */
module.exports = {
    name: 'collab',
    register() {},
    registerSocket(io, socket) {
        require('./collab.socket')(io, socket);
    },
    /** With REDIS_URL, share live documents with the other server instances. */
    start() {
        const { registry } = require('./collab.service');
        require('./collab.replication').attachCollabReplication(registry)
            .catch((err) => require('../../../utils/logger').warn(`[COLLAB] replication not attached: ${err.message}`));
    },
};
