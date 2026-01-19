import React from 'react';

const Meetings = () => {
    return (
        <div className="h-full flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 text-center p-8">
            <div className="w-24 h-24 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-6">
                <svg className="w-12 h-12 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Video Huddles Center</h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-md">
                Select a meeting from the sidebar to join, or start a new instant huddle to collaborate with your team.
            </p>
            <button className="mt-8 px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30">
                Start Instant Huddle
            </button>
        </div>
    );
};

export default Meetings;
