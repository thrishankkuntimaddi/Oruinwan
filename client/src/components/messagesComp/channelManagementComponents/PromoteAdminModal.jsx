import React from 'react';
import { Users } from 'lucide-react';

export default function PromoteAdminModal({ isOpen, onClose, onConfirm, loading }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[110]" onClick={onClose}>
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Users size={20} className="text-blue-600" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Promote to Admin</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                            Are you sure you want to promote this member to admin? They will be able to manage channel settings and members.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={onConfirm}
                                disabled={loading}
                                className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                            >
                                Promote to Admin
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
