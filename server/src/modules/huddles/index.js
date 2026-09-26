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
};
