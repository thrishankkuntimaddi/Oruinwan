import React from 'react';

const LoadingScreen = () => {
    return (
        <div className="fixed inset-0 bg-white z-[9999] flex flex-col items-center justify-center">
            <div className="relative flex items-center justify-center">
                {/* Outer Ring Spinner */}
                <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>

                {/* Inner Logo/Icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold text-blue-600 animate-pulse">C</span>
                </div>
            </div>
            <div className="mt-4 text-gray-400 text-sm font-medium tracking-wider animate-pulse">LOADING</div>
        </div>
    );
};

export default LoadingScreen;
