'use strict';

/**
 * Daily: each Pro subscription's quantity follows the workspace's member count, from the next
 * charge on (billing.service.syncAllSeats). Does nothing until Razorpay is set up.
 */

const { scheduleJob } = require('../../shared/jobs/scheduler');

function startBillingSeatSyncCron() {
    return scheduleJob({
        name: 'billing-seat-sync',
        intervalMs: 24 * 60 * 60 * 1000,
        initialDelayMs: 10 * 60 * 1000,
        run: () => require('./billing.service').syncAllSeats(),
    });
}

module.exports = { startBillingSeatSyncCron };
