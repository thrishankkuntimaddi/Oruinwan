'use strict';

/**
 * Logger for the AI subsystem. Inside the server process it reuses the
 * server's structured logger; as its own process (AI_STANDALONE=1, see
 * ai/server.js) or when the server package is absent it logs to the console,
 * so the package never needs anything from server/ at runtime.
 */
const consoleLogger = {
  info: (...a) => console.log(...a),
  warn: (...a) => console.warn(...a),
  error: (...a) => console.error(...a),
  debug: (...a) => { if (process.env.AI_DEBUG === '1') console.log(...a); },
};

let logger = consoleLogger;
if (process.env.AI_STANDALONE !== '1') {
  try {
    logger = require('../../server/utils/logger');
  } catch {
    logger = consoleLogger;
  }
}

module.exports = logger;
