'use strict';

/**
 * Messages module: channel/DM messages, DM actions, bookmarks and message reminders.
 * Routes are required inside register() so importing the module has no side effects.
 */
module.exports = {
    name: 'messages',
    register({ app, requireAuth }) {
        app.use('/api/v2/messages', require('./messages.routes'));
        app.use('/api/v2/dm', require('./dmActions.routes'));
        app.use('/api/messages', requireAuth, require('./bookmark.routes'));
    },
};
