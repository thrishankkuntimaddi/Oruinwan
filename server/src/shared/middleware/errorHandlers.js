const logger = require('../../../utils/logger');
const isProduction = process.env.NODE_ENV === 'production';

function notFoundHandler(req, res) {
  if (!isProduction) {
    
    logger.info('❌ [404] Route not found:', {
      method: req.method,
      path: req.path,
      originalUrl: req.originalUrl,
      headers: req.headers['authorization'] ? 'Has Auth' : 'No Auth'
    });
    return res.status(404).json({
      error: 'Not Found',
      message: `Cannot ${req.method} ${req.path}`,
      suggestion: 'Check the API documentation for available endpoints'
    });
  }
  
  res.status(404).json({ error: 'Not Found' });
}

function globalErrorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = Number(err.statusCode || err.status || 500);
  if (!Number.isInteger(statusCode) || statusCode < 400 || statusCode > 599) statusCode = 500;

  logger.error({
    err,
    status: statusCode,
    path: req.path,
    method: req.method,
    user: req.user?.sub,
  }, 'Global error handler');

  const isServerError = statusCode >= 500;
  // In production only expose messages for client errors (4xx); 5xx gets a generic message.
  const hideDetails = isProduction && isServerError;

  const errorResponse = {
    error: isServerError ? 'Internal Server Error' : (err.name || 'Error'),
    message: hideDetails
      ? 'An unexpected error occurred. Please try again later.'
      : (err.message || 'Request failed'),
  };

  if (!hideDetails && err.code !== undefined && err.code !== null) {
    errorResponse.code = err.code;
  }

  if (!isProduction) {
    errorResponse.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
}

module.exports = { notFoundHandler, globalErrorHandler };
