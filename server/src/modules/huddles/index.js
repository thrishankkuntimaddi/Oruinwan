'use strict';

/** Huddles module: voice-call signaling over Socket.IO plus the ICE/TURN config endpoint. */
module.exports = {
    name: 'huddles',
    register({ app }) {
        app.use('/api/v2/huddles', require('./huddles.routes'));
    },
    registerSocket(io, socket) {
        require('./huddles.socket')(io, socket);
    },
    /** With REDIS_URL, share live-huddle state with the other server instances. */
    start() {
        const { registry } = require('./huddleRegistry');
        require('./huddleReplication').attachHuddleReplication(registry)
            .catch((err) => require('../../../utils/logger').warn(`[HUDDLES] replication not attached: ${err.message}`));
    },
};
