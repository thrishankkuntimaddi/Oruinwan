const logger = require('../../../utils/logger');
const isProduction = process.env.NODE_ENV === 'production';

function notFoundHandler(req, res) {
  if (!isProduction) {
    
    console.log('❌ [404] Route not found:', {
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
  
  logger.error('Global error handler:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    user: req.user?.sub,
    
    timestamp: new Date().toISOString()
  });

  
  const statusCode = err.statusCode || err.status || 500;

  
  const errorResponse = {
    error: statusCode === 500 ? 'Internal Server Error' : (err.name || 'Error'),
    message: isProduction && statusCode === 500
      ? 'An unexpected error occurred. Please try again later.'
      : err.message
  };

  
  if (!isProduction) {
    errorResponse.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
}

module.exports = { notFoundHandler, globalErrorHandler };
