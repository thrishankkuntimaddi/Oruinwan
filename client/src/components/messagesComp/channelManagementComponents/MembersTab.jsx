import React from 'react';
import { Lock } from 'lucide-react';

export default function MembersTab({
    members,
    channel,
    currentUserId,
    isAdmin,
    loading,
    onPromoteAdmin,
    onDemoteAdmin,
    onRemoveMember
}) {
    return (
        <div className="space-y-6">
            {/* Private Channel Notice (Non-Admins) */}
            {!isAdmin && channel.isPrivate && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400">
                        <Lock size={20} />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white">Private Channel</h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                            This channel is private. Only channel admins can invite new members.
                        </p>
                    </div>
                </div>
            )}

            {/* Members List */}
            <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Channel Members</h4>
                <div className="space-y-2">
                    {members.map((member) => {
                        const isOwner = String(member._id) === String(channel.createdBy);
                        const isMemberAdmin = member.isAdmin || isOwner;
                        const isCurrentUser = String(member._id) === String(currentUserId);

                        return (
                            <div key={member._id} className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-colors group">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold">
                                        {(member?.username || 'U').charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                            {member?.username || 'Unknown'}
                                            {isOwner && (
                                                <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] font-bold rounded uppercase tracking-wide">Owner</span>
                                            )}
                                            {!isOwner && isMemberAdmin && (
                                                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded uppercase tracking-wide">Admin</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-500">Member</div>
                                    </div>
                                </div>

                                {/* Admin actions for other members */}
                                {isAdmin && !isCurrentUser && !isOwner && (
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {!isMemberAdmin ? (
                                            <button
                                                onClick={() => onPromoteAdmin(member._id)}
                                                disabled={loading}
                                                className="text-xs font-medium text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-all"
                                            >
                                                Promote to Admin
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => onDemoteAdmin(member._id)}
                                                disabled={loading}
                                                className="text-xs font-medium text-orange-600 hover:bg-orange-50 px-3 py-1.5 rounded-lg transition-all"
                                            >
                                                Demote to Member
                                            </button>
                                        )}
                                        <button
                                            onClick={() => onRemoveMember(member._id)}
                                            disabled={loading}
                                            className="text-xs font-medium text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-all"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                )}

                                {/* Self-demotion for current user if they're an admin but not owner */}
                                {isCurrentUser && isMemberAdmin && !isOwner && (() => {
                                    // Count total admins to prevent last admin from leaving
                                    const totalAdmins = members.filter(m => m.isAdmin).length;
                                    const isLastAdmin = totalAdmins === 1;

                                    // Don't show demote button if this is the last admin
                                    if (isLastAdmin) return null;

                                    return (
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => onDemoteAdmin(member._id)}
                                                disabled={loading}
                                                className="text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-all"
                                            >
                                                Withdraw as Admin
                                            </button>
                                        </div>
                                    );
                                })()}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
