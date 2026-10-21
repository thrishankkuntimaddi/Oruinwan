'use strict';

/**
 * Automatic Google Drive backups: every 15 minutes, back up the people who are due
 * (daily, or an hour after a significant change). One instance per tick (scheduler lock);
 * per-user claims and leases in driveBackup.service.js make each backup at-most-once.
 */

const { scheduleJob } = require('../../shared/jobs/scheduler');

function startDriveBackupCron() {
    return scheduleJob({
        name: 'drive-backup',
        intervalMs: 15 * 60 * 1000,
        initialDelayMs: 3 * 60 * 1000,
        run: () => require('./driveBackup.service').runDueBackups(),
    });
}

module.exports = { startDriveBackupCron };
