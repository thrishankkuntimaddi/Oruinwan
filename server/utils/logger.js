const isDevelopment = process.env.NODE_ENV !== 'production';

const logger = {
    
    error: (...args) => {
        console.error(...args);
    },

    
    warn: (...args) => {
        console.warn(...args);
    },

    
    info: (...args) => {
        console.log(...args);
    },

    
    debug: (...args) => {
        if (isDevelopment) {
            console.log(...args);
        }
    },

    
    success: (...args) => {
        console.log(...args);
    },

    
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
