// client/src/utils/apiHelpers.js

/**
 * API helper utilities to standardize error handling and response processing
 * Eliminates 100+ duplicate error handling blocks
 */

/**
 * Extract user-friendly error message from API error
 * @param {Error} error - Error object from API call
 * @returns {string} User-friendly error message
 */
export const getErrorMessage = (error) => {
    // Check for response error message
    if (error.response?.data?.message) {
        return error.response.data.message;
    }

    // Check for error message
    if (error.message) {
        return error.message;
    }

    // Network error
    if (error.request) {
        return 'Network error. Please check your connection.';
    }

    // Default fallback
    return 'An unexpected error occurred';
};

/**
 * Handle API errors consistently
 * @param {Error} error - Error object from API call
 * @param {Object} options - Options for error handling
 * @param {boolean} options.showAlert - Whether to show alert (default: false)
 * @param {Function} options.onError - Custom error handler callback
 * @param {string} options.context - Context for logging
 * @returns {string} Error message
 */
export const handleApiError = (error, options = {}) => {
    const {
        showAlert = false,
        onError,
        context = 'API Error'
    } = options;

    const message = getErrorMessage(error);

    // Log error with context
    console.error(`${context}:`, error);

    // Show alert if requested
    if (showAlert) {
        alert(message);
    }

    // Call custom error handler if provided
    if (onError) {
        onError(message, error);
    }

    return message;
};

/**
 * Wrapper for API calls with built-in error handling
 * @param {Function} apiCall - Async API function to call
 * @param {Object} options - Error handling options
 * @returns {Promise} Result of API call
 * 
 * @example
 * const data = await withErrorHandling(
 *   () => api.get('/users'),
 *   { context: 'Fetch Users', showAlert: true }
 * );
 */
export const withErrorHandling = async (apiCall, options = {}) => {
    try {
        const response = await apiCall();
        return response.data || response;
    } catch (error) {
        handleApiError(error, options);
        throw error;
    }
};

/**
 * Check if error is a 401 Unauthorized error
 * @param {Error} error - Error object
 * @returns {boolean} True if 401 error
 */
export const isUnauthorizedError = (error) => {
    return error.response?.status === 401;
};

/**
 * Check if error is a network error
 * @param {Error} error - Error object
 * @returns {boolean} True if network error
 */
export const isNetworkError = (error) => {
    return !error.response && error.request;
};

/**
 * Format validation errors from API
 * @param {Error} error - Error object with validation errors
 * @returns {Object} Formatted validation errors by field
 */
export const formatValidationErrors = (error) => {
    const validationErrors = error.response?.data?.errors || {};

    // Convert array of errors to object keyed by field
    if (Array.isArray(validationErrors)) {
        return validationErrors.reduce((acc, err) => {
            acc[err.field] = err.message;
            return acc;
        }, {});
    }

    return validationErrors;
};
