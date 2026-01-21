// server/utils/deviceParser.js

const UAParser = require('ua-parser-js');

/**
 * Parse device information from user-agent string
 * @param {string} userAgent - The user-agent string from request headers
 * @returns {Object} Parsed device information
 */
function parseDeviceInfo(userAgent) {
    if (!userAgent) {
        return {
            browser: 'Unknown',
            browserVersion: '',
            os: 'Unknown',
            osVersion: '',
            device: 'Unknown',
            deviceType: 'desktop',
            formattedString: 'Unknown Device'
        };
    }

    const parser = new UAParser(userAgent);
    const result = parser.getResult();

    const browser = result.browser.name || 'Unknown Browser';
    const browserVersion = result.browser.version || '';
    const os = result.os.name || 'Unknown OS';
    const osVersion = result.os.version || '';
    const device = result.device.model || result.device.vendor || null;
    const deviceType = result.device.type || 'desktop';

    // Format a human-readable string
    let formattedString = '';

    if (device) {
        formattedString = `${device} (${os}${osVersion ? ' ' + osVersion : ''})`;
    } else {
        formattedString = `${browser}${browserVersion ? ' ' + browserVersion : ''} on ${os}${osVersion ? ' ' + osVersion : ''}`;
    }

    return {
        browser,
        browserVersion,
        os,
        osVersion,
        device,
        deviceType,
        formattedString
    };
}

/**
 * Get IP address from request, accounting for proxies and load balancers
 * @param {Object} req - Express request object
 * @returns {string} IP address
 */
function getClientIP(req) {
    // Check common proxy headers
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        // x-forwarded-for can contain multiple IPs, take the first one
        const ips = forwarded.split(',');
        return ips[0].trim();
    }

    // Check other common headers
    const realIP = req.headers['x-real-ip'];
    if (realIP) {
        return realIP;
    }

    // Fallback to connection remote address
    return req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        req.connection?.socket?.remoteAddress ||
        'Unknown';
}

/**
 * Extract location from IP (basic implementation)
 * For production, consider using a geolocation API like MaxMind or ipapi.co
 * @param {string} ipAddress - The IP address
 * @returns {string} Location string or null
 */
function getLocationFromIP(ipAddress) {
    // Basic implementation - returns null
    // In production, you would integrate with a geolocation service
    // Example: const response = await axios.get(`https://ipapi.co/${ipAddress}/json/`);
    return null;
}

module.exports = {
    parseDeviceInfo,
    getClientIP,
    getLocationFromIP
};
