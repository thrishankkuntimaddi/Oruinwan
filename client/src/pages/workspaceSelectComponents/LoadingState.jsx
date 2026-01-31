import React from 'react';

/**
 * LoadingState - Loading spinner component
 * Pure presentational component - no state or logic
 */
const LoadingState = () => {
    return (
        <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );
};

export default LoadingState;
