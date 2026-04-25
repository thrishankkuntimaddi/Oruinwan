const UAParser = require('ua-parser-js');

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

function getClientIP(req) {
    
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        
        const ips = forwarded.split(',');
        return ips[0].trim();
    }

    
    const realIP = req.headers['x-real-ip'];
    if (realIP) {
        return realIP;
    }

    
    return req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        req.connection?.socket?.remoteAddress ||
        'Unknown';
}

function getLocationFromIP(ipAddress) {
    
    
    
    return null;
}

module.exports = {
    parseDeviceInfo,
    getClientIP,
    getLocationFromIP
};
