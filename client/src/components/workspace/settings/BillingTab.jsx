import React from 'react';
import { Users, Hash, MessageSquare } from 'lucide-react';

/**
 * BillingTab Component
 * Displays workspace usage statistics and billing information
 */
const BillingTab = ({ stats, loadingStats }) => {
    return (
        <div>
            {loadingStats ? (
                <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-500 dark:text-gray-400">Loading workspace statistics...</p>
                </div>
            ) : (
                <>
                    <div className="text-center py-8 mb-8 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800">
                        <div className="w-16 h-16 bg-green-100 dark:bg-green-800/20 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                            ✨
                        </div>
                        <h3 className="text-lg font-bold text-green-900 dark:text-green-300 mb-2">FREE Plan</h3>
                        <p className="text-green-700 dark:text-green-400">Currently using the free tier</p>
                    </div>

                    {stats && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4">Workspace Usage</h3>

                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                        <Users size={20} className="text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold text-gray-900 dark:text-white">Members</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">Total workspace members</div>
                                    </div>
                                </div>
                                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.memberCount}</div>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                                        <Hash size={20} className="text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold text-gray-900 dark:text-white">Channels</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">Active channels</div>
                                    </div>
                                </div>
                                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.channelCount}</div>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                                        <MessageSquare size={20} className="text-green-600 dark:text-green-400" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold text-gray-900 dark:text-white">Messages</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">Total messages sent</div>
                                    </div>
                                </div>
                                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.messageCount}</div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default BillingTab;
