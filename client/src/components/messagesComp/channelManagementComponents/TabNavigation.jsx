import React from 'react';

export default function TabNavigation({ activeTab, onTabChange, isAdmin }) {
    return (
        <div className="flex border-b border-gray-100 dark:border-gray-800 px-6">
            <button
                onClick={() => onTabChange("members")}
                className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === "members" ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"}`}
            >
                Members
            </button>
            {isAdmin && (
                <button
                    onClick={() => onTabChange("settings")}
                    className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === "settings" ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"}`}
                >
                    Manage Channel
                </button>
            )}
            {isAdmin && (
                <button
                    onClick={() => onTabChange("invite")}
                    className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === "invite" ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"}`}
                >
                    Invite People
                </button>
            )}
        </div>
    );
}
