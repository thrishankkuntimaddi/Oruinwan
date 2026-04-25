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
        console.log('🍪 [COOKIE] Setting refresh token:', {
            secure: cookieOptions.secure,
            sameSite: cookieOptions.sameSite,
            maxAge: `${days} days (${maxAgeMs}ms)`,
            expiresAt: new Date(Date.now() + maxAgeMs).toISOString(),
            httpsRequired: cookieOptions.secure && cookieOptions.sameSite === 'none'
        });

        
        if (cookieOptions.sameSite === 'none' && !cookieOptions.secure) {
            console.error('⚠️ [COOKIE ERROR] sameSite=none requires secure=true (HTTPS)');
            console.error('⚠️ Cookies will be REJECTED by browsers!');
        }
    }

    res.cookie('jwt', token, cookieOptions);

    
    console.log(`✅ [COOKIE] Refresh token cookie set (expires: ${new Date(Date.now() + maxAgeMs).toLocaleString()})`);
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

    console.log('🗑️ [COOKIE] Refresh token cookie cleared');
}

module.exports = {
    setRefreshTokenCookie,
    clearRefreshTokenCookie
};
