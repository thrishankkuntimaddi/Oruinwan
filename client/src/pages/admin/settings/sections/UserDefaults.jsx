import React from 'react';
import { Users } from 'lucide-react';

const UserDefaults = () => {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">User Defaults</h2>
                <p className="text-gray-500 dark:text-gray-400">Set default settings for new users</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">User defaults coming soon</p>
            </div>
        </div>
    );
};

export default UserDefaults;
