import React from 'react';

/**
 * LoadingState - Loading spinner component
 * Pure presentational component - no state or logic
 */
const LoadingState = () => {
    return (
        <div className="animate-pulse px-6 py-4 space-y-3">
            {[1,2,3].map(i => (
                <div key={i} className="flex items-center gap-4 bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="w-12 h-12 rounded-2xl bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                        <div className="h-3.5 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                        <div className="h-2.5 w-48 bg-gray-100 dark:bg-gray-700/50 rounded" />
                    </div>
                    <div className="h-8 w-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl" />
                </div>
            ))}
        </div>
    );
};

export default LoadingState;
