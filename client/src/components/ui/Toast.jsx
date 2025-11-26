import React, { useEffect, useState, useCallback } from 'react';

const Toast = ({ message, type = 'success', onClose, duration = 150 }) => {
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

    return (
        <div
            className={`relative flex items-center w-80 p-4 rounded-lg shadow-xl bg-white border-l-4 overflow-hidden transition-all duration-300 transform 
        ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
        ${type === 'success' ? 'border-green-500' : 'border-red-500'}
      `}
        >
            {/* Icon */}
            <div className="mr-3 flex-shrink-0">
                {type === 'success' ? (
                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                        <span className="text-green-600 text-sm font-bold">✓</span>
                    </div>
                ) : (
                    <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                        <span className="text-red-600 text-sm font-bold">!</span>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <h4 className={`font-semibold text-sm ${type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                    {type === 'success' ? 'Success' : 'Error'}
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
                    className={`h-full transition-all ease-linear ${type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
};

export default Toast;
