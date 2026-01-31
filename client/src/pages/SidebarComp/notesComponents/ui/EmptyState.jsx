import React from 'react';
import { Clock, Star } from 'lucide-react';

const EmptyState = ({ loading }) => {
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-white dark:bg-gray-900 text-gray-400 dark:text-gray-500">
                <div className="w-24 h-24 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
                    <Clock size={40} className="text-gray-300 dark:text-gray-600 animate-pulse" />
                </div>
                <h2 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">Loading Notes...</h2>
                <p className="text-sm max-w-xs text-center text-gray-500 dark:text-gray-400">Please wait while we fetch your notes.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center h-full bg-white dark:bg-gray-900 text-gray-400 dark:text-gray-500">
            <div className="w-24 h-24 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
                <Star size={40} className="text-gray-300 dark:text-gray-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">Select a Note</h2>
            <p className="text-sm max-w-xs text-center text-gray-500 dark:text-gray-400">Choose a note from the sidebar or create a new one to get started.</p>
        </div>
    );
};

export default EmptyState;
