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
  transport ? pino.transport(transport) : undefined
);

module.exports = logger;
