import React from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * DeleteAccountModal Component
 * Confirmation modal for permanent account deletion
 */
const DeleteAccountModal = ({
    show,
    onClose,
    deleteConfirmText,
    setDeleteConfirmText,
    onDeleteAccount
}) => {
    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-md w-full mx-4 border border-red-200 dark:border-red-800" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                        <AlertCircle className="text-red-600 dark:text-red-400" size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Delete Account?</h3>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    This action is <strong>permanent</strong> and cannot be undone. All your data including:
                </p>

                <ul className="text-xs text-gray-500 dark:text-gray-400 mb-4 space-y-1 ml-4">
                    <li>• Messages and conversations</li>
                    <li>• Tasks and notes</li>
                    <li>• Personal workspace</li>
                    <li>• Profile information</li>
                </ul>

                <p className="text-sm font-bold text-red-600 dark:text-red-400 mb-4">
                    will be permanently deleted.
                </p>

                <div className="mb-4">
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                        Type DELETE to confirm
                    </label>
                    <input
                        type="text"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                        placeholder="Type DELETE"
                        onKeyPress={(e) => e.key === 'Enter' && onDeleteAccount()}
                    />
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => {
                            onClose();
                            setDeleteConfirmText("");
                        }}
                        className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onDeleteAccount}
                        disabled={deleteConfirmText !== "DELETE"}
                        className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Delete Forever
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeleteAccountModal;
