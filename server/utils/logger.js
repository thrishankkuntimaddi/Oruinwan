// server/utils/logger.js
/**
 * Simple production-safe logger
 * Logs to console only in development, silent in production unless it's an error
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

const logger = {
    // Always log errors, even in production
    error: (...args) => {
        console.error(...args);
    },

    // Log warnings in development and production
    warn: (...args) => {
        console.warn(...args);
    },

    // Log info only in development
    info: (...args) => {
        if (isDevelopment) {
            console.log(...args);
        }
    },

    // Log debug only in development
    debug: (...args) => {
        if (isDevelopment) {
            console.log(...args);
        }
    },

    // Success messages (with emoji) - development only
    success: (...args) => {
        if (isDevelopment) {
            console.log(...args);
        }
    },
};

module.exports = logger;
