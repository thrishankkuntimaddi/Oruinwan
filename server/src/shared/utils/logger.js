'use strict';

const pino = require('pino');

const isDev = (process.env.NODE_ENV || 'development') !== 'production';

// In development, pretty-print through a *synchronous* stream. A worker-thread
// transport can drop the final lines when the process exits immediately after
// logging (fatal env validation, uncaught exceptions), which is exactly when
// those lines matter most. Production writes JSON to stdout (sync by default).
const destination = isDev
  ? require('pino-pretty')({
      colorize: true,
      translateTime: 'SYS:HH:MM:ss',
      ignore: 'pid,hostname',
      messageFormat: '{msg}',
      sync: true,
    })
  : undefined;

const logger = pino(
  {
    level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
    
    timestamp: pino.stdTimeFunctions.isoTime,
    
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
    },
    
    base: isDev ? undefined : { service: 'chttrix-server', env: process.env.NODE_ENV },
  },
  destination
);

module.exports = logger;
