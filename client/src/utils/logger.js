/**
 * Centralized logging utility
 * Provides consistent logging across the application
 * Logs are only enabled in development mode
 */

const isDevelopment = process.env.NODE_ENV === 'development';

// Log levels
const LogLevel = {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR'
};

/**
 * Format timestamp for logs
 */
function getTimestamp() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour12: false });
}

/**
 * Core logging function
 */
function log(level, emoji, message, ...args) {
    if (!isDevelopment) return;

    const timestamp = getTimestamp();
    const prefix = `${emoji} [${timestamp}] [${level}]`;

    console.log(`${prefix} ${message}`, ...args);
}

/**
 * Logger object with different log levels
 */
const logger = {
    debug: (message, ...args) => log(LogLevel.DEBUG, '🔍', message, ...args),
    info: (message, ...args) => log(LogLevel.INFO, 'ℹ️', message, ...args),
    warn: (message, ...args) => log(LogLevel.WARN, '⚠️', message, ...args),
    error: (message, ...args) => log(LogLevel.ERROR, '❌', message, ...args),

    // Specialized loggers for specific domains
    socket: (message, ...args) => log(LogLevel.DEBUG, '📡', message, ...args),
    crypto: (message, ...args) => log(LogLevel.DEBUG, '🔐', message, ...args),
    message: (message, ...args) => log(LogLevel.DEBUG, '📨', message, ...args),
    api: (message, ...args) => log(LogLevel.DEBUG, '🌐', message, ...args),

    // Group logging for better organization
    group: (label) => isDevelopment && console.group(`📂 ${label}`),
    groupEnd: () => isDevelopment && console.groupEnd(),

    // Table logging for structured data
    table: (data) => isDevelopment && console.table(data)
};

export default logger;
