'use strict';

/**
 * Logger for the AI subsystem. Uses the server's structured logger when it is
 * available and falls back to the console so the package stays framework-free.
 */
let logger;
try {
  logger = require('../../server/utils/logger');
} catch {
  logger = {
    info: (...a) => console.log(...a),
    warn: (...a) => console.warn(...a),
    error: (...a) => console.error(...a),
    debug: () => {},
  };
}

module.exports = logger;
