const isDevelopment = import.meta.env.MODE === 'development';

const LogLevel = {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR'
};

function getTimestamp() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour12: false });
}

function log(level, emoji, message, ...args) {
    if (!isDevelopment) return;

    const timestamp = getTimestamp();
    const prefix = `${emoji} [${timestamp}] [${level}]`;

    console.log(`${prefix} ${message}`, ...args);
}

const logger = {
    debug: (message, ...args) => log(LogLevel.DEBUG, '🔍', message, ...args),
    info: (message, ...args) => log(LogLevel.INFO, 'ℹ️', message, ...args),
    warn: (message, ...args) => log(LogLevel.WARN, '⚠️', message, ...args),
    error: (message, ...args) => log(LogLevel.ERROR, '❌', message, ...args),

    
    socket: (message, ...args) => log(LogLevel.DEBUG, '📡', message, ...args),
    crypto: (message, ...args) => log(LogLevel.DEBUG, '🔐', message, ...args),
    message: (message, ...args) => log(LogLevel.DEBUG, '📨', message, ...args),
    api: (message, ...args) => log(LogLevel.DEBUG, '🌐', message, ...args),

    
    group: (label) => isDevelopment && console.group(`📂 ${label}`),
    groupEnd: () => isDevelopment && console.groupEnd(),

    
    table: (data) => isDevelopment && console.table(data)
};

export default logger;
