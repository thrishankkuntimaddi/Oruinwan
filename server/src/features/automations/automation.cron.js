/**
 * automation.cron.js
 *
 * Cron runner for scheduled automations.
 * Uses setInterval (same pattern as notifications.cron.js).
 *
 * Runs every minute to check if any scheduled automations are due.
 * Each automation's schedule.expression (e.g. '30m', '1h', '24h') determines
 * the gap required between runs — tracked via lastRunAt.
 */

const logger = require('../../../utils/logger');
const { runScheduledAutomations } = require('./automation.service');

const CRON_INTERVAL_MS = 60_000; // Check every minute

function startAutomationCron(io) {
    logger.info('[AutomationCron] Starting scheduled automation runner (checks every 60s)...');

    // Run immediately at startup (after short delay for DB to stabilize)
    setTimeout(() => {
        runScheduledAutomations(io).catch(err =>
            logger.error('[AutomationCron] Startup run error:', err.message)
        );
    }, 15_000); // 15s after boot

    // Then every minute
    setInterval(() => {
        runScheduledAutomations(io).catch(err =>
            logger.error('[AutomationCron] Interval run error:', err.message)
        );
    }, CRON_INTERVAL_MS);

    logger.info('[AutomationCron] Scheduled automation runner active ✔');
}

module.exports = { startAutomationCron };
