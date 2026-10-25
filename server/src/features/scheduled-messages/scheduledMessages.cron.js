'use strict';

const logger = require('../../../utils/logger');
const { scheduleJob } = require('../../shared/jobs/scheduler');
const { sendDue } = require('./scheduledMessages.service');

/** Sends due scheduled messages; one instance per tick fleet-wide (shared/jobs/scheduler.js). */
function startScheduledMessagesCron(io) {
    const stop = scheduleJob({ name: 'scheduled-messages', intervalMs: 30 * 1000, run: () => sendDue(io) });
    logger.info('✅ [SCHEDULED] Cron started (30s interval)');
    return stop;
}

module.exports = { startScheduledMessagesCron };
