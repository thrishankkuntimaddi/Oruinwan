/**
 * Cookie Helper
 * Centralized cookie management for consistent configuration
 */

/**
 * Set refresh token cookie with production-safe settings
 * @param {Response} res - Express response object
 * @param {string} token - JWT refresh token
 * @param {Object} options - Configuration options
 * @param {number} options.days - Cookie lifetime in days (default: 7)
 * @param {Object} options.custom - Custom cookie options to override defaults
 */
function setRefreshTokenCookie(res, token, options = {}) {
    const days = options.days || 7;
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('jwt', token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        path: '/',
        maxAge: days * 24 * 60 * 60 * 1000,
        ...options.custom // Allow override if needed
    });
}

/**
 * Clear refresh token cookie
 * @param {Response} res - Express response object
 */
function clearRefreshTokenCookie(res) {
    const isProduction = process.env.NODE_ENV === 'production';

    res.clearCookie('jwt', {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        path: '/'
    });
}

module.exports = {
    setRefreshTokenCookie,
    clearRefreshTokenCookie
};
