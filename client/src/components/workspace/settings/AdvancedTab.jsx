import React from 'react';

/**
 * AdvancedTab Component
 * Displays dangerous workspace actions (delete) for admin users only
 */
const AdvancedTab = ({ isAdmin, setShowDeleteConfirm }) => {
    return (
        <div>
            {isAdmin ? (
                <div className="bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl p-8">
                    <h3 className="text-lg font-bold text-red-900 dark:text-red-400 mb-2">Danger Zone</h3>
                    <p className="text-sm text-red-700/80 dark:text-red-400/80 mb-8 leading-relaxed">
                        Deleting a workspace is permanent and cannot be undone. All messages, files, and data will be lost forever.
                        <br />
                        <strong>Only administrators can perform this action.</strong>
                    </p>
                    <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-xl border border-red-100 dark:border-red-900/30 shadow-sm">
                        <div>
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white">Delete this workspace</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Once deleted, it's gone for good.</p>
                        </div>
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="px-5 py-2.5 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 shadow-md hover:shadow-lg transition-all"
                        >
                            Delete Workspace
                        </button>
                    </div>
                </div>
            ) : (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-8 text-center border border-gray-200 dark:border-gray-700">
                    <div className="text-gray-400 mb-2 text-4xl">🔒</div>
                    <p className="text-gray-500 dark:text-gray-300 font-semibold">Admin Access Required</p>
                    <p className="text-sm text-gray-400 mt-2">Only workspace administrators can access advanced settings.</p>
                </div>
            )}
        </div>
    );
};

export default AdvancedTab;
