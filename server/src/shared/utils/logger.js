/**
 * Canonical Logger — Chttrix Backend
 *
 * Single source of truth for all server-side logging.
 * Uses Pino for high-performance, structured, production-friendly output.
 *
 * Usage:
 *   const logger = require('../shared/utils/logger');  // adjust path
 *   logger.info('Server started');
 *   logger.warn({ userId }, 'Token expired');
 *   logger.error({ err }, 'Database write failed');
 *
 * Log Levels (precedence low → high):
 *   trace | debug | info | warn | error | fatal
 *
 * Environment behaviour:
 *   - development  → pretty-printed, colorized, human-readable
 *   - production   → structured JSON (fast, parseable by log aggregators)
 *
 * Redis / future swap:
 *   If you ever want to stream logs to an external sink, replace the
 *   transport config below — the rest of the codebase stays unchanged.
 *
 * @module shared/utils/logger
 */

'use strict';

const pino = require('pino');

const isDev = (process.env.NODE_ENV || 'development') !== 'production';

const transport = isDev
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:HH:MM:ss',
        ignore: 'pid,hostname',
        messageFormat: '{msg}',
      },
    }
  : undefined; // production → raw JSON to stdout (piped to log aggregator)

const logger = pino(
  {
    level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
    // Always include timestamp
    timestamp: pino.stdTimeFunctions.isoTime,
    // Serialise error objects cleanly
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
    },
    // Base fields added to every log line in production
    base: isDev ? undefined : { service: 'chttrix-server', env: process.env.NODE_ENV },
  },
  transport ? pino.transport(transport) : undefined
);

module.exports = logger;
