/**
 * Application Constants
 * Centralized constant definitions for maintainability
 */

/** User Roles */
const ROLES = {
    OWNER: 'owner',
    ADMIN: 'admin',
    MANAGER: 'manager',
    MEMBER: 'member'
};

/** Time Constants (in milliseconds) */
const TIME = {
    ONE_SECOND: 1000,
    ONE_MINUTE: 60 * 1000,
    FIVE_MINUTES: 5 * 60 * 1000,
    FIFTEEN_MINUTES: 15 * 60 * 1000,
    ONE_HOUR: 60 * 60 * 1000,
    ONE_DAY: 24 * 60 * 60 * 1000,
    ONE_WEEK: 7 * 24 * 60 * 60 * 1000,
    THIRTY_DAYS: 30 * 24 * 60 * 60 * 1000
};

/** HTTP Status Codes */
const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503
};

/** Error Messages */
const ERROR_MESSAGES = {
    UNAUTHORIZED: 'Authentication required',
    FORBIDDEN: 'Insufficient permissions',
    NOT_FOUND: 'Resource not found',
    INVALID_INPUT: 'Invalid input provided',
    SERVER_ERROR: 'Internal server error',
    RATE_LIMIT: 'Too many requests, please try again later',
    VERSION_ERROR: 'Document was modified by another process, please retry'
};

module.exports = {
    ROLES,
    TIME,
    HTTP_STATUS,
    ERROR_MESSAGES
};
