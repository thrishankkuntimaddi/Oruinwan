export const getErrorMessage = (error) => {
    
    if (error.response?.data?.message) {
        return error.response.data.message;
    }

    
    if (error.message) {
        return error.message;
    }

    
    if (error.request) {
        return 'Network error. Please check your connection.';
    }

    
    return 'An unexpected error occurred';
};

export const handleApiError = (error, options = {}) => {
    const {
        showAlert = false,
        onError,
        context = 'API Error'
    } = options;

    const message = getErrorMessage(error);

    
    console.error(`${context}:`, error);

    
    if (showAlert) {
        alert(message);
    }

    
    if (onError) {
        onError(message, error);
    }

    return message;
};

export const withErrorHandling = async (apiCall, options = {}) => {
    try {
        const response = await apiCall();
        return response.data || response;
    } catch (error) {
        handleApiError(error, options);
        throw error;
    }
};

export const isUnauthorizedError = (error) => {
    return error.response?.status === 401;
};

export const isNetworkError = (error) => {
    return !error.response && error.request;
};

export const formatValidationErrors = (error) => {
    const validationErrors = error.response?.data?.errors || {};

    
    if (Array.isArray(validationErrors)) {
        return validationErrors.reduce((acc, err) => {
            acc[err.field] = err.message;
            return acc;
        }, {});
    }

    return validationErrors;
};
