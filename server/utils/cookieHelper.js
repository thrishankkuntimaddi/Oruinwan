const logger = require('./logger');
function setRefreshTokenCookie(res, token, options = {}) {
    const days = options.days || 7;
    const isProduction = process.env.NODE_ENV === 'production';
    const maxAgeMs = days * 24 * 60 * 60 * 1000;

    const cookieOptions = {
        httpOnly: true,
        secure: isProduction, 
        sameSite: isProduction ? 'none' : 'lax', 
        path: '/',
        maxAge: maxAgeMs,
        ...options.custom 
    };

    
    if (isProduction) {
        logger.info('🍪 [COOKIE] Setting refresh token:', {
            secure: cookieOptions.secure,
            sameSite: cookieOptions.sameSite,
            maxAge: `${days} days (${maxAgeMs}ms)`,
            expiresAt: new Date(Date.now() + maxAgeMs).toISOString(),
            httpsRequired: cookieOptions.secure && cookieOptions.sameSite === 'none'
        });

        
        if (cookieOptions.sameSite === 'none' && !cookieOptions.secure) {
            logger.error('⚠️ [COOKIE ERROR] sameSite=none requires secure=true (HTTPS)');
            logger.error('⚠️ Cookies will be REJECTED by browsers!');
        }
    }

    res.cookie('jwt', token, cookieOptions);

    
    logger.info(`✅ [COOKIE] Refresh token cookie set (expires: ${new Date(Date.now() + maxAgeMs).toLocaleString()})`);
}

function clearRefreshTokenCookie(res) {
    const isProduction = process.env.NODE_ENV === 'production';

    const clearOptions = {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        path: '/'
    };

    res.clearCookie('jwt', clearOptions);

    logger.info('🗑️ [COOKIE] Refresh token cookie cleared');
}

// App clients cannot use the httpOnly `jwt` cookie (their origin is never the server's): the
// Android and iOS apps and the desktop app (desktop/) identify themselves with the
// `x-client-platform` header and exchange the refresh token in the JSON body instead.
// Web clients must use the cookie only.
const NATIVE_PLATFORMS = new Set(['ios', 'android', 'desktop']);

function isNativeClient(req) {
    const raw = (req && req.headers && req.headers['x-client-platform']) || '';
    return NATIVE_PLATFORMS.has(String(raw).trim().toLowerCase());
}

function getRefreshTokenFromRequest(req) {
    if (isNativeClient(req)) {
        const bodyToken = req.body && typeof req.body.refreshToken === 'string' ? req.body.refreshToken : null;
        return bodyToken || req.cookies?.jwt || null;
    }
    return req.cookies?.jwt || null;
}

module.exports = {
    setRefreshTokenCookie,
    clearRefreshTokenCookie,
    isNativeClient,
    getRefreshTokenFromRequest
};
