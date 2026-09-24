'use strict';

/**
 * Server logger.
 *
 * Thin console-compatible facade over the pino instance in
 * src/shared/utils/logger.js so that every call site in the codebase writes
 * structured logs (JSON in production, pretty-printed in development).
 *
 * Call sites may keep using console-style arguments:
 *   logger.info('Server started on port', 8080)
 *   logger.error('Save failed', err)
 *   logger.debug('Payload', { id, count })
 *
 * Strings and primitives are joined into the message. Errors are attached as
 * `err` and other objects as `data`, so they render as structured fields.
 */

const pino = require('../src/shared/utils/logger');

function toPinoArgs(args) {
  const parts = [];
  const merge = {};
  let extras = 0;

  for (const arg of args) {
    if (arg instanceof Error) {
      merge.err = arg;
    } else if (arg !== null && typeof arg === 'object') {
      if (extras === 0) merge.data = arg;
      else merge[`data${extras}`] = arg;
      extras += 1;
    } else if (arg !== undefined) {
      parts.push(String(arg));
    }
  }

  return [merge, parts.join(' ')];
}

function level(name) {
  return (...args) => {
    const [merge, msg] = toPinoArgs(args);
    pino[name](merge, msg);
  };
}

const logger = {
  error: level('error'),
  warn: level('warn'),
  info: level('info'),
  debug: level('debug'),
  success: level('info'),

  // Domain-tagged debug channels kept for backwards compatibility.
  socket: level('debug'),
  db: level('debug'),
  auth: level('debug'),
  encryption: level('debug'),

  /** Underlying pino instance for callers that want native pino calls. */
  pino,
  child: (bindings) => pino.child(bindings),
};

module.exports = logger;
