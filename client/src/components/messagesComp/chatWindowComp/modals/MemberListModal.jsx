import React, { useState, useMemo } from "react";
import { X, Users, Search, Crown, Shield, User as UserIcon, MessageCircle } from "lucide-react";

/**
 * MemberListModal - Shows all channel members with join dates and roles
 * Provides search functionality and quick actions
 */
export default function MemberListModal({
    isOpen,
    onClose,
    members = [],
    channelName,
    currentUserId,
    onStartDM,
    onViewProfile,
}) {
    const [searchQuery, setSearchQuery] = useState("");

    // Sort members: online first, then by role, then by name
    const sortedMembers = useMemo(() => {
        return [...members].sort((a, b) => {
            // Extract user data (handle different structures)
            const aUser = a.user || a;
            const bUser = b.user || b;
            const aId = aUser._id || aUser.id;
            const bId = bUser._id || bUser.id;

            // Online status first
            const aOnline = aUser.isOnline || aUser.status === 'online' ? 1 : 0;
            const bOnline = bUser.isOnline || bUser.status === 'online' ? 1 : 0;
            if (aOnline !== bOnline) return bOnline - aOnline;

            // Role priority: owner > admin > member
            const roleWeight = { owner: 3, admin: 2, member: 1 };
            const aRole = roleWeight[a.role] || 1;
            const bRole = roleWeight[b.role] || 1;
            if (aRole !== bRole) return bRole - aRole;

            // Alphabetical by username
            const aName = aUser.username || aUser.name || '';
            const bName = bUser.username || bUser.name || '';
            return aName.localeCompare(bName);
        });
    }, [members]);

    // Filter by search query
    const filteredMembers = useMemo(() => {
        if (!searchQuery.trim()) return sortedMembers;
        const query = searchQuery.toLowerCase();
        return sortedMembers.filter((member) => {
            const user = member.user || member;
            const username = user.username || user.name || '';
            const email = user.email || '';
            return (
                username.toLowerCase().includes(query) ||
                email.toLowerCase().includes(query)
            );
        });
    }, [sortedMembers, searchQuery]);

    const formatJoinDate = (date) => {
        if (!date) return 'Unknown';
        const d = new Date(date);
        const now = new Date();
        const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
        return d.toLocaleDateString();
    };

    const getRoleBadge = (role) => {
        switch (role) {
            case 'owner':
                return { icon: Crown, label: 'Owner', className: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' };
            case 'admin':
                return { icon: Shield, label: 'Admin', className: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' };
            default:
                return null;
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                <div
                    className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col pointer-events-auto animate-in zoom-in-95 slide-in-from-top-4 duration-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center">
                                <Users size={20} className="text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                    Members
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {channelName ? `#${channelName}` : ''} · {filteredMembers.length} {filteredMembers.length === 1 ? 'member' : 'members'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-500 dark:text-gray-400"
                            title="Close"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Search */}
                    <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-800">
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search members..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 dark:text-gray-100"
                            />
                        </div>
                    </div>

                    {/* Member List */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {filteredMembers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                                    <Users size={32} className="text-gray-400" />
                                </div>
                                <p className="text-gray-500 dark:text-gray-400 font-medium">
                                    No members found
                                </p>
                                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                                    Try a different search term
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                {filteredMembers.map((member) => {
                                    const user = member.user || member;
                                    const userId = user._id || user.id;
                                    const isCurrentUser = String(userId) === String(currentUserId);
                                    const roleBadge = getRoleBadge(member.role);
                                    const isOnline = user.isOnline || user.status === 'online';

                                    return (
                                        <div
                                            key={userId}
                                            className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
                                        >
                                            <div className="flex items-center gap-4">
                                                {/* Avatar with Online Indicator */}
                                                <div className="relative flex-shrink-0">
                                                    {user.profilePicture ? (
                                                        <img
                                                            src={user.profilePicture}
                                                            alt={user.username}
                                                            className="w-12 h-12 rounded-lg object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                                                            {(user.username || '?').charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                    {/* Online indicator */}
                                                    <div
                                                        className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-gray-900 ${isOnline ? 'bg-green-500' : 'bg-gray-400'
                                                            }`}
                                                    />
                                                </div>

                                                {/* User Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                                                            {user.username || user.name || 'Unknown User'}
                                                            {isCurrentUser && (
                                                                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">(You)</span>
                                                            )}
                                                        </span>
                                                        {roleBadge && (
                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${roleBadge.className}`}>
                                                                <roleBadge.icon size={12} />
                                                                {roleBadge.label}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                                                        {user.email && (
                                                            <span className="truncate">{user.email}</span>
                                                        )}
                                                        <span>·</span>
                                                        <span>Joined {formatJoinDate(member.joinedAt)}</span>
                                                    </div>
                                                </div>

                                                {/* Actions */}
                                                {!isCurrentUser && (
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {onStartDM && (
                                                            <button
                                                                onClick={() => {
                                                                    onStartDM(userId);
                                                                    onClose();
                                                                }}
                                                                className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors text-blue-600 dark:text-blue-400"
                                                                title="Send message"
                                                            >
                                                                <MessageCircle size={16} />
                                                            </button>
                                                        )}
                                                        {onViewProfile && (
                                                            <button
                                                                onClick={() => {
                                                                    onViewProfile(userId);
                                                                    onClose();
                                                                }}
                                                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-600 dark:text-gray-400"
                                                                title="View profile"
                                                            >
                                                                <UserIcon size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer Stats */}
                    <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl">
                        <div className="flex items-center justify-center gap-6 text-xs text-gray-500 dark:text-gray-400">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <span>
                                    {sortedMembers.filter(m => {
                                        const u = m.user || m;
                                        return u.isOnline || u.status === 'online';
                                    }).length} online
                                </span>
                            </div>
                            <span>·</span>
                            <span>{sortedMembers.length} total members</span>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
