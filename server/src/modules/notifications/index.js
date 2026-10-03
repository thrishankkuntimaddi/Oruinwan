'use strict';

/** Notifications module: in-app notifications, preferences, email digests and the delivery cron. */
module.exports = {
    name: 'notifications',
    register({ app }) {
        app.use('/api/notifications', require('./notifications.routes'));
    },
    start({ io, jobs = true }) {
        if (jobs) require('./notifications.cron').startNotificationsCron(io);
    },
};
