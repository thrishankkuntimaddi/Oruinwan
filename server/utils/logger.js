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

    // Log info in all environments (important for startup logs)
    info: (...args) => {
        console.log(...args);
    },

    // Log debug only in development
    debug: (...args) => {
        if (isDevelopment) {
            console.log(...args);
        }
    },

    // Success messages (always show - important for startup confirmation)
    success: (...args) => {
        console.log(...args);
    },

    // Domain-specific loggers (all debug level)
    socket: (...args) => {
        if (isDevelopment) {
            console.log(...args);
        }
    },

    db: (...args) => {
        if (isDevelopment) {
            console.log(...args);
        }
    },

    auth: (...args) => {
        if (isDevelopment) {
            console.log(...args);
        }
    },

    encryption: (...args) => {
        if (isDevelopment) {
            console.log(...args);
        }
    }
};

module.exports = logger;

