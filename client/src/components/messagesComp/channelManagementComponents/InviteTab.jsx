import React from 'react';
import { Users, UserPlus, X } from 'lucide-react';

export default function InviteTab({
    searchQuery,
    onSearchQueryChange,
    filteredNonMembers,
    allUsers,
    members,
    channel,
    showDebugInfo,
    onInvite,
    loading
}) {
    const nonMembers = allUsers.filter(
        (u) => !members.some((m) => String(m._id) === String(u._id))
    );

    return (
        <div className="space-y-4">
            {/* Search Input */}
            <div className="relative">
                <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => onSearchQueryChange(e.target.value)}
                    className="w-full px-4 py-2.5 pl-10 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchQuery && (
                    <button
                        onClick={() => onSearchQueryChange('')}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                        <X size={18} />
                    </button>
                )}
            </div>

            {/* Debug Info Panel - Toggleable */}
            {showDebugInfo && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs">
                    <div className="font-bold text-yellow-900 mb-1">🐛 Debug Info:</div>
                    <div className="text-yellow-700 space-y-0.5">
                        <div>• Total workspace users: {allUsers.length}</div>
                        <div>• Channel members: {members.length}</div>
                        <div>• Non-members (eligible to invite): {nonMembers.length}</div>
                        <div>• Filtered by search: {filteredNonMembers.length}</div>
                        <div>• Workspace ID: {channel.workspaceId || 'N/A'}</div>
                    </div>
                </div>
            )}

            {filteredNonMembers.length === 0 ? (
                <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Users size={24} className="text-gray-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                        {searchQuery ? 'No members found' : "Everyone's already here!"}
                    </p>
                    <p className="text-xs text-gray-500">
                        {searchQuery ? 'Try a different search term' : 'All workspace members are in this channel.'}
                    </p>
                </div>
            ) : (
                <>
                    <div className="text-xs text-gray-500 mb-2">
                        {filteredNonMembers.length} member{filteredNonMembers.length !== 1 ? 's' : ''} available
                    </div>
                    <div className="space-y-2">
                        {filteredNonMembers.map((user) => (
                            <div key={user._id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:bg-blue-50/30 dark:hover:bg-gray-700 transition-all group">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                                        {(user?.username || 'U').charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">{user?.username || 'Unknown'}</div>
                                        <div className="text-xs text-gray-500">{user?.email || ''}</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => onInvite(user._id)}
                                    disabled={loading}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                                    title="Add to Channel"
                                >
                                    <UserPlus size={20} />
                                </button>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
