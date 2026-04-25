import React from 'react';

const ErrorDisplay = ({ error }) => {
    if (!error) return null;

    return (
        <div
            style={{
                position: 'absolute',
                bottom: '5rem',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'var(--error-color)',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                fontSize: '0.875rem'
            }}
        >
            {error}
        </div>
    );
};

export default ErrorDisplay;
