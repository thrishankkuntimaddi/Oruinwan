'use strict';

/**
 * One row per user who connected Google Drive backup. Holds the sealed refresh token
 * (never the token itself), the id of the single backup file in their appDataFolder and
 * the status shown in Settings → Backup.
 */

const mongoose = require('mongoose');

const driveBackupSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    googleEmail: { type: String, default: null },
    refreshTokenSealed: { type: String, default: null },
    connectedAt: { type: Date, default: null },
    autoBackup: { type: Boolean, default: true },

    fileId: { type: String, default: null },
    lastBackupAt: { type: Date, default: null },
    lastBackupSize: { type: Number, default: 0 },
    lastCounts: { type: mongoose.Schema.Types.Mixed, default: null },

    // idle | running | ok | error | reauth (Google access was revoked: connect again)
    status: { type: String, default: 'idle' },
    lastError: { type: String, default: null },
    lastAttemptAt: { type: Date, default: null },
    // Lease so two instances (or a manual run and the job) never back up the same user at once.
    runningUntil: { type: Date, default: null },
    // Set when significant data changes; the job backs up at most once an hour after it.
    dirtyAt: { type: Date, default: null },
    lastRestoreAt: { type: Date, default: null },
    // Automatic backups wait for the person: the Drive already held a backup when they
    // connected, or the account looks emptied. A manual backup or a restore clears it.
    hold: { type: String, default: null }, // null | 'existing-backup' | 'account-empty'
}, { timestamps: true });

driveBackupSchema.index({ autoBackup: 1, status: 1, lastBackupAt: 1 });

module.exports = mongoose.models.DriveBackup || mongoose.model('DriveBackup', driveBackupSchema);
