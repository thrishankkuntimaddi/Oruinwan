import React from 'react';
import { Bell } from 'lucide-react';

const Notifications = () => {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Notifications</h2>
                <p className="text-gray-500 dark:text-gray-400">Configure notification preferences</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
                <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">Notification settings coming soon</p>
            </div>
        </div>
    );
};

export default Notifications;
