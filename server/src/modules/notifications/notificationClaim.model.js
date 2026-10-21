'use strict';

/**
 * One-shot claims for background notification jobs: "this meeting reminder was
 * sent", "this user got today's digest email". Inserting the claim key is the
 * atomic test-and-set (unique index), so concurrent instances or overlapping
 * runs never send the same thing twice. Claims expire after 35 days.
 */

const mongoose = require('mongoose');

const notificationClaimSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now, expires: 35 * 24 * 60 * 60 },
});

const NotificationClaim = mongoose.models.NotificationClaim
    || mongoose.model('NotificationClaim', notificationClaimSchema);

/** true when this caller is the first to claim `key`. */
async function claim(key) {
    try {
        await NotificationClaim.create({ key: String(key) });
        return true;
    } catch (err) {
        if (err && err.code === 11000) return false;
        throw err;
    }
}

module.exports = { NotificationClaim, claim };
