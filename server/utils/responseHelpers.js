// server/utils/responseHelpers.js

/**
 * Standardized HTTP response helpers to eliminate duplicate error handling
 * across controllers
 */

/**
 * Handle errors with consistent logging and response format
 * @param {Object} res - Express response object
 * @param {Error} err - Error object
 * @param {String} context - Context for logging (e.g., "LOGIN ERROR")
 * @param {String} message - User-facing error message (default: "Server error")
 * @param {Number} statusCode - HTTP status code (default: 500)
 */
exports.handleError = (res, err, context = "ERROR", message = "Server error", statusCode = 500) => {
  console.error(`${context}:`, err);
  return res.status(statusCode).json({ message });
};

/**
 * Send success response
 * @param {Object} res - Express response object
 * @param {Object} data - Response data
 * @param {String} message - Success message (optional)
 * @param {Number} statusCode - HTTP status code (default: 200)
 */
exports.success = (res, data, message = null, statusCode = 200) => {
  const response = message ? { message, ...data } : data;
  return res.status(statusCode).json(response);
};

/**
 * Send 404 Not Found response
 * @param {Object} res - Express response object
 * @param {String} resource - Resource name (e.g., "Channel", "User")
 */
exports.notFound = (res, resource = "Resource") => {
  return res.status(404).json({ message: `${resource} not found` });
};

/**
 * Send 403 Forbidden response
 * @param {Object} res - Express response object
 * @param {String} message - Forbidden message
 */
exports.forbidden = (res, message = "Access denied") => {
  return res.status(403).json({ message });
};

/**
 * Send 400 Bad Request response
 * @param {Object} res - Express response object
 * @param {String} message - Error message
 */
exports.badRequest = (res, message = "Bad request") => {
  return res.status(400).json({ message });
};

/**
 * Send 401 Unauthorized response
 * @param {Object} res - Express response object
 * @param {String} message - Unauthorized message
 */
exports.unauthorized = (res, message = "Unauthorized") => {
  return res.status(401).json({ message });
};

/**
 * Send 409 Conflict response
 * @param {Object} res - Express response object
 * @param {String} message - Conflict message
 */
exports.conflict = (res, message = "Resource already exists") => {
  return res.status(409).json({ message });
};
