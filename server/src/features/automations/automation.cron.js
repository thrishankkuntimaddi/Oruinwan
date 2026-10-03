const logger = require('../../../utils/logger');
const { runScheduledAutomations } = require('./automation.service');
const { scheduleJob } = require('../../shared/jobs/scheduler');

const CRON_INTERVAL_MS = 60_000;

/** Scheduled automations: one run per minute across all instances. */
function startAutomationCron(io) {
    logger.info('[AutomationCron] Starting scheduled automation runner (checks every 60s)...');
    return scheduleJob({
        name: 'automations',
        intervalMs: CRON_INTERVAL_MS,
        initialDelayMs: 15_000,
        run: () => runScheduledAutomations(io),
    });
}

module.exports = { startAutomationCron };
