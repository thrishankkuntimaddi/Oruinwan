const logger = require('../../../utils/logger');
const { runScheduledAutomations } = require('./automation.service');

const CRON_INTERVAL_MS = 60_000; 

function startAutomationCron(io) {
    logger.info('[AutomationCron] Starting scheduled automation runner (checks every 60s)...');

    
    setTimeout(() => {
        runScheduledAutomations(io).catch(err =>
            logger.error('[AutomationCron] Startup run error:', err.message)
        );
    }, 15_000); 

    
    setInterval(() => {
        runScheduledAutomations(io).catch(err =>
            logger.error('[AutomationCron] Interval run error:', err.message)
        );
    }, CRON_INTERVAL_MS);

    logger.info('[AutomationCron] Scheduled automation runner active ✔');
}

module.exports = { startAutomationCron };
