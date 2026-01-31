import React from 'react';
import { Shield } from 'lucide-react';

/**
 * ErrorState - Error display with retry button
 * Pure presentational component - delegates retry action to parent via props
 * 
 * @param {string} error - Error message to display
 * @param {function} onRetry - Callback when user clicks "Try Again"
 */
const ErrorState = ({ error, onRetry }) => {
    return (
        <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 text-red-600 rounded-full mb-4">
                <Shield size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Something went wrong</h3>
            <p className="text-slate-500 mb-6">{error}</p>
            <button
                onClick={onRetry}
                className="px-6 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-colors"
            >
                Try Again
            </button>
        </div>
    );
};

export default ErrorState;
