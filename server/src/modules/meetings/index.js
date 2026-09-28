'use strict';

/**
 * Meetings module (socket side only for now). The HTTP routes still live in
 * src/features/meetings and are mounted from server.js (/api/v2/meetings,
 * /api/scheduled-meetings); this entry attaches the live-meeting socket handlers.
 */
module.exports = {
    name: 'meetings',
    register() { /* HTTP routes mounted in server.js */ },
    registerSocket(io, socket) {
        require('../../features/meetings/meetings.socket')(io, socket);
    },
};
