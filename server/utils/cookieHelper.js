/**
 * Cookie Helper
 * Centralized cookie management for consistent configuration
 * 
 * PRODUCTION REQUIREMENTS:
 * - Backend MUST use HTTPS for secure cookies
 * - CORS must be configured to allow credentials
 * - Frontend domain must be whitelisted in CORS
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
    const maxAgeMs = days * 24 * 60 * 60 * 1000;

    const cookieOptions = {
        httpOnly: true,
        secure: isProduction, // REQUIRES HTTPS in production
        sameSite: isProduction ? 'none' : 'lax', // 'none' REQUIRES secure=true
        path: '/',
        maxAge: maxAgeMs,
        ...options.custom // Allow override if needed
    };

    // 🔍 PRODUCTION DEBUGGING: Log cookie configuration
    if (isProduction) {
        console.log('🍪 [COOKIE] Setting refresh token:', {
            secure: cookieOptions.secure,
            sameSite: cookieOptions.sameSite,
            maxAge: `${days} days (${maxAgeMs}ms)`,
            expiresAt: new Date(Date.now() + maxAgeMs).toISOString(),
            httpsRequired: cookieOptions.secure && cookieOptions.sameSite === 'none'
        });

        // ⚠️ WARNING: Detect potential misconfiguration
        if (cookieOptions.sameSite === 'none' && !cookieOptions.secure) {
            console.error('⚠️ [COOKIE ERROR] sameSite=none requires secure=true (HTTPS)');
            console.error('⚠️ Cookies will be REJECTED by browsers!');
        }
    }

    res.cookie('jwt', token, cookieOptions);

    // 🔍 Log successful cookie set
    console.log(`✅ [COOKIE] Refresh token cookie set (expires: ${new Date(Date.now() + maxAgeMs).toLocaleString()})`);
}

/**
 * Clear refresh token cookie
 * @param {Response} res - Express response object
 */
function clearRefreshTokenCookie(res) {
    const isProduction = process.env.NODE_ENV === 'production';

    const clearOptions = {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        path: '/'
    };

    res.clearCookie('jwt', clearOptions);

    console.log('🗑️ [COOKIE] Refresh token cookie cleared');
}

module.exports = {
    setRefreshTokenCookie,
    clearRefreshTokenCookie
};
