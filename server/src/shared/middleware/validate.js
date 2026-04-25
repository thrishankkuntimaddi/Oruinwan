const { validationResult } = require('express-validator');

function validate(req, res, next) {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation Error',
            details: errors.array().map(err => ({
                field: err.param,
                message: err.msg,
                value: err.value
            }))
        });
    }

    next();
}

function sanitizeInput(req, res, next) {
    const sanitize = (obj) => {
        if (typeof obj !== 'object' || obj === null) {
            return obj;
        }

        
        if (Array.isArray(obj)) {
            return obj.map(item => sanitize(item));
        }

        
        const sanitized = {};
        Object.keys(obj).forEach(key => {
            if (key.startsWith('$')) {
                
                return;
            }

            if (typeof obj[key] === 'object' && obj[key] !== null) {
                sanitized[key] = sanitize(obj[key]);
            } else {
                sanitized[key] = obj[key];
            }
        });

        return sanitized;
    };

    
    if (req.body) {
        req.body = sanitize(req.body);
    }

    if (req.query) {
        req.query = sanitize(req.query);
    }

    if (req.params) {
        req.params = sanitize(req.params);
    }

    next();
}

const operationTimestamps = new Map();

function operationRateLimit(operation, maxPerMinute = 10) {
    return (req, res, next) => {
        const userId = req.user?.sub || req.ip;
        const key = `${userId}:${operation}`;
        const now = Date.now();
        const windowStart = now - 60000; 

        if (!operationTimestamps.has(key)) {
            operationTimestamps.set(key, []);
        }

        const timestamps = operationTimestamps.get(key);

        
        const recentTimestamps = timestamps.filter(ts => ts > windowStart);

        if (recentTimestamps.length >= maxPerMinute) {
            return res.status(429).json({
                error: 'Too Many Requests',
                message: `Rate limit exceeded for ${operation}. Max ${maxPerMinute} per minute.`,
                retryAfter: Math.ceil((recentTimestamps[0] - windowStart) / 1000)
            });
        }

        recentTimestamps.push(now);
        operationTimestamps.set(key, recentTimestamps);

        
        if (Math.random() < 0.01) { 
            const allKeys = Array.from(operationTimestamps.keys());
            allKeys.forEach(k => {
                const ts = operationTimestamps.get(k) || [];
                const recent = ts.filter(t => t > windowStart);
                if (recent.length === 0) {
                    operationTimestamps.delete(k);
                } else {
                    operationTimestamps.set(k, recent);
                }
            });
        }

        next();
    };
}

module.exports = {
    validate,
    sanitizeInput,
    operationRateLimit
};
