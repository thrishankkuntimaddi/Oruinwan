export const sendSuccess = (res, data = {}, statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        ...data
    });
};

export const sendError = (res, error, statusCode = 500) => {
    const message = typeof error === 'string' ? error : error.message;
    return res.status(statusCode).json({
        success: false,
        error: message
    });
};

export const sendValidationError = (res, errors) => {
    return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors
    });
};

export const sendNotFound = (res, resource = 'Resource') => {
    return res.status(404).json({
        success: false,
        error: `${resource} not found`
    });
};

export const sendUnauthorized = (res, message = 'Unauthorized') => {
    return res.status(401).json({
        success: false,
        error: message
    });
};

export const sendForbidden = (res, message = 'Forbidden') => {
    return res.status(403).json({
        success: false,
        error: message
    });
};
