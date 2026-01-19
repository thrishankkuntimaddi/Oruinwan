import React, { useState, useMemo } from "react";
import { X, MessageSquare, Users as UsersIcon } from "lucide-react";

/**
 * ThreadsViewModal - Shows only messages that have thread replies
 * Allows users to quickly navigate to active discussions
 */
export default function ThreadsViewModal({
    isOpen,
    onClose,
    messages = [],
    threadCounts = {},
    onOpenThread,
    formatTime,
}) {
    const [searchQuery, setSearchQuery] = useState("");

    // Filter messages that have threads (replyCount > 0)
    const threadedMessages = useMemo(() => {
        return messages
            .filter((msg) => {
                const count = threadCounts[msg.id] || msg.replyCount || 0;
                return count > 0 && !msg.isDeletedUniversally;
            })
            .sort((a, b) => {
                // Sort by last reply time (most recent first)
                const aTime = new Date(a.lastReplyAt || a.ts).getTime();
                const bTime = new Date(b.lastReplyAt || b.ts).getTime();
                return bTime - aTime;
            });
    }, [messages, threadCounts]);

    // Filter by search query
    const filteredThreads = useMemo(() => {
        if (!searchQuery.trim()) return threadedMessages;
        const query = searchQuery.toLowerCase();
        return threadedMessages.filter(
            (msg) =>
                msg.text?.toLowerCase().includes(query) ||
                msg.senderName?.toLowerCase().includes(query)
        );
    }, [threadedMessages, searchQuery]);

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
                            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                                <MessageSquare size={20} className="text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                    Threads
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {threadedMessages.length} active {threadedMessages.length === 1 ? 'thread' : 'threads'}
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
                        <input
                            type="text"
                            placeholder="Search threads..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100"
                        />
                    </div>

                    {/* Thread List */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {filteredThreads.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                                    <MessageSquare size={32} className="text-gray-400" />
                                </div>
                                <p className="text-gray-500 dark:text-gray-400 font-medium">
                                    {searchQuery ? 'No threads found' : 'No threads yet'}
                                </p>
                                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                                    {searchQuery
                                        ? 'Try a different search term'
                                        : 'Start a conversation thread by replying to a message'}
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                {filteredThreads.map((msg) => {
                                    const count = threadCounts[msg.id] || msg.replyCount || 0;
                                    return (
                                        <div
                                            key={msg.id}
                                            onClick={() => {
                                                onOpenThread?.(msg.id);
                                                onClose();
                                            }}
                                            className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors group"
                                        >
                                            <div className="flex items-start gap-3">
                                                {/* Avatar */}
                                                {msg.senderAvatar ? (
                                                    <img
                                                        src={msg.senderAvatar}
                                                        alt={msg.senderName}
                                                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                                                        {(msg.senderName || '?').charAt(0).toUpperCase()}
                                                    </div>
                                                )}

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-baseline gap-2 mb-1">
                                                        <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                                                            {msg.senderName || 'Unknown'}
                                                        </span>
                                                        <span className="text-xs text-gray-400 dark:text-gray-500">
                                                            {formatTime?.(msg.ts) || new Date(msg.ts).toLocaleTimeString()}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 mb-2">
                                                        {msg.text}
                                                    </p>

                                                    {/* Thread Info */}
                                                    <div className="flex items-center gap-3 text-xs">
                                                        {/* Reply Avatars */}
                                                        {msg.replyAvatars && msg.replyAvatars.length > 0 && (
                                                            <div className="flex -space-x-2">
                                                                {msg.replyAvatars.slice(0, 3).map((avatar, i) => (
                                                                    <img
                                                                        key={i}
                                                                        src={avatar}
                                                                        alt="Replier"
                                                                        className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-900 object-cover"
                                                                    />
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* Reply Count */}
                                                        <span className="text-blue-600 dark:text-blue-400 font-medium group-hover:underline">
                                                            {count} {count === 1 ? 'reply' : 'replies'}
                                                        </span>

                                                        {/* Last Reply Time */}
                                                        {msg.lastReplyAt && (
                                                            <span className="text-gray-400 dark:text-gray-500">
                                                                Last reply {formatTime?.(msg.lastReplyAt) || 'recently'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl">
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                            Click on any thread to view the full conversation
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
