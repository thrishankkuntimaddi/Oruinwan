// client/src/components/ui/LoadingScreen.jsx
import React from 'react';

const LoadingScreen = () => {
    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-50 dark:bg-[#030712] transition-colors duration-500">
            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 animate-pulse"></div>
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2 animate-pulse" style={{ animationDelay: '1s' }}></div>
            </div>

            <div className="relative flex flex-col items-center justify-center z-10">
                <div className="relative w-24 h-24 mb-8">
                    {/* Outer Ring */}
                    <div className="absolute inset-0 rounded-full border-4 border-indigo-100 dark:border-white/10"></div>
                    {/* Spinning Ring */}
                    <div className="absolute inset-0 rounded-full border-4 border-indigo-600 dark:border-indigo-500 border-t-transparent animate-spin"></div>

                    {/* Inner Pulsing Dot */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-8 h-8 bg-indigo-600 dark:bg-indigo-500 rounded-full animate-ping opacity-20"></div>
                        <div className="absolute w-4 h-4 bg-indigo-600 dark:bg-indigo-500 rounded-full shadow-lg shadow-indigo-500/50"></div>
                    </div>
                </div>

                <div className="flex flex-col items-center gap-2">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Chttrix</h3>
                    <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoadingScreen;

