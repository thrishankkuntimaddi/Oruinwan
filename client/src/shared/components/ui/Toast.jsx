import React, { useEffect, useState, useCallback } from 'react';

const Toast = ({ message, type = 'success', onClose, duration = 3000 }) => {
    const [progress, setProgress] = useState(100);
    const [isExiting, setIsExiting] = useState(false);

    const handleClose = useCallback(() => {
        setIsExiting(true);
        setTimeout(onClose, 300); // Wait for exit animation
    }, [onClose]);

    useEffect(() => {
        const interval = 10;
        const steps = duration / interval;
        const decrement = 100 / steps;

        const timer = setInterval(() => {
            setProgress((prev) => {
                if (prev <= 0) return 0;
                return prev - decrement;
            });
        }, interval);

        const closeTimer = setTimeout(() => {
            handleClose();
        }, duration);

        return () => {
            clearInterval(timer);
            clearTimeout(closeTimer);
        };
    }, [duration, handleClose]);

    const getStyles = () => {
        switch (type) {
            case 'error': return 'border-red-500';
            case 'info': return 'border-blue-500';
            default: return 'border-green-500';
        }
    };

    const getIcon = () => {
        switch (type) {
            case 'error':
                return (
                    <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                        <span className="text-red-600 text-sm font-bold">!</span>
                    </div>
                );
            case 'info':
                return (
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-600 text-sm font-bold">i</span>
                    </div>
                );
            default:
                return (
                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                        <span className="text-green-600 text-sm font-bold">✓</span>
                    </div>
                );
        }
    };

    const getTitle = () => {
        switch (type) {
            case 'error': return 'Error';
            case 'info': return 'Info';
            default: return 'Success';
        }
    };

    const getTitleColor = () => {
        switch (type) {
            case 'error': return 'text-red-800';
            case 'info': return 'text-blue-800';
            default: return 'text-green-800';
        }
    };

    const getProgressColor = () => {
        switch (type) {
            case 'error': return 'bg-red-500';
            case 'info': return 'bg-blue-500';
            default: return 'bg-green-500';
        }
    };

    return (
        <div
            className={`relative flex items-center w-80 p-4 rounded-lg shadow-xl bg-white border-l-4 overflow-hidden transition-all duration-300 transform z-[9999]
        ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
        ${getStyles()}
      `}
        >
            {/* Icon */}
            <div className="mr-3 flex-shrink-0">
                {getIcon()}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <h4 className={`font-semibold text-sm ${getTitleColor()}`}>
                    {getTitle()}
                </h4>
                <p className="text-gray-600 text-xs mt-0.5 truncate">{message}</p>
            </div>

            {/* Close Button */}
            <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 ml-3 focus:outline-none"
            >
                ✕
            </button>

            {/* Progress Bar */}
            <div className="absolute bottom-0 left-0 h-1 bg-gray-100 w-full">
                <div
                    className={`h-full transition-all ease-linear ${getProgressColor()}`}
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
};

export default Toast;
