// server/middleware/errorHandlers.js
// 404 + Global error handler middleware
// Extracted from server.js (Phase 4 cleanup)

const logger = require('../utils/logger');
const isProduction = process.env.NODE_ENV === 'production';

/**
 * 404 handler — catches routes that don't exist.
 * S-15 SECURITY FIX: In production, do NOT echo back method/path.
 * Path reflection acts as a route-enumeration oracle for attackers.
 */
function notFoundHandler(req, res) {
  if (!isProduction) {
    // Dev: verbose 404 for debugging convenience
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
  // Production: generic response, no path/method reflected
  res.status(404).json({ error: 'Not Found' });
}

/**
 * Global error handler — catches all unhandled errors.
 * Must be registered AFTER all routes.
 */
// eslint-disable-next-line no-unused-vars
function globalErrorHandler(err, req, res, next) {
  // Log error with context for debugging
  logger.error('Global error handler:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    user: req.user?.sub,
    // ⚠️ SECURITY: Never log req.body - may contain passwords or tokens
    timestamp: new Date().toISOString()
  });

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  // Construct error response
  const errorResponse = {
    error: statusCode === 500 ? 'Internal Server Error' : (err.name || 'Error'),
    message: isProduction && statusCode === 500
      ? 'An unexpected error occurred. Please try again later.'
      : err.message
  };

  // Add stack trace in development only
  if (!isProduction) {
    errorResponse.stack = err.stack;
    // NOTE: err.details may expose internals - omit sensitive fields in non-prod too
  }

  res.status(statusCode).json(errorResponse);
}

module.exports = { notFoundHandler, globalErrorHandler };
