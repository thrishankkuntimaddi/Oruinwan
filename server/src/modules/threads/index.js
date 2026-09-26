'use strict';

/** Threads module: replies to a message (v1 routes and the v2 API). */
module.exports = {
    name: 'threads',
    register({ app, requireAuth }) {
        // v1 first: it has always been mounted before /api/threads/v2.
        app.use('/api/threads', require('./threads.routes'));
        app.use('/api/threads/v2', requireAuth, require('./threadsV2.routes'));
    },
};
