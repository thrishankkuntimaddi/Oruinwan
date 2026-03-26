import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, ArrowRight, Search, ListFilter, X } from 'lucide-react';
import ThreadPanel from '../ThreadPanel';
import api from '../../../../services/api';
import { formatTime } from '../helpers/helpers';
import { batchDecryptMessages } from '../../../../services/messageEncryptionService';
import { getAvatarUrl } from '../../../../utils/avatarUtils';

export default function ThreadsTab({ channelId, currentUserId, socket }) {
    const [threads, setThreads] = useState([]);
    const [selectedThread, setSelectedThread] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Fetch all messages and filter for threads (replyCount > 0)
    const fetchThreads = useCallback(async () => {
        setLoading(true);

        try {
            // Use dedicated threads endpoint for this channel
            const res = await api.get(`/api/threads/channels/${channelId}/threads`);
            const activeThreads = res.data.threads || [];



            // Decrypt thread preview messages
            let decryptedThreads = activeThreads;
            if (activeThreads.length > 0) {
                try {
                    decryptedThreads = await batchDecryptMessages(
                        activeThreads,
                        channelId,
                        'channel',
                        null
                    );

                } catch (err) {
                    console.error('[THREADS_TAB][DECRYPT] Failed to decrypt threads:', err);
                    // Keep encrypted threads if decryption fails
                    decryptedThreads = activeThreads;
                }
            }

            setThreads(decryptedThreads);
        } catch (err) {
            console.error('[THREADS_TAB][ERROR] Failed to fetch threads:', err);
            setThreads([]); // Empty array on error, no dummy data
        } finally {
            setLoading(false);
        }
    }, [channelId]);

    // Initial fetch
    useEffect(() => {
        fetchThreads();
    }, [fetchThreads]);

    // Real-time updates - OPTIMIZED
    useEffect(() => {
        if (!socket) return;

        // ✅ Handle when a new thread is created (first reply)
        const handleThreadCreated = async (data) => {


            // ✅ Only add if it's for THIS channel (prevent cross-channel pollution)
            if (data.channelId && data.channelId !== channelId) {
                return;
            }

            // Fetch and decrypt the new parent message
            if (data.parentMessage) {
                try {
                    const decrypted = await batchDecryptMessages(
                        [data.parentMessage],
                        channelId,
                        'channel',
                        null
                    );
                    const decryptedParent = decrypted[0] || data.parentMessage;

                    // Add to thread list at the top
                    setThreads(prev => [decryptedParent, ...prev]);
                } catch (err) {
                    console.error('[THREADS_TAB][DECRYPT] Failed to decrypt new thread:', err);
                    // Fall back to adding encrypted version
                    setThreads(prev => [data.parentMessage, ...prev]);
                }
            }
        };

        // ✅ Handle reply count updates
        const handleMessageUpdated = (data) => {
            const { messageId, updates } = data;

            if (updates?.replyCount !== undefined) {


                setThreads(prev => prev.map(thread =>
                    thread._id === messageId
                        ? { ...thread, replyCount: updates.replyCount }
                        : thread
                ));
            }
        };

        // ✅ Handle individual thread replies (update last reply time, move to top)
        const handleThreadReply = (data) => {
            const { parentId, reply } = data;



            // Move thread to top and update metadata
            setThreads(prev => {
                const thread = prev.find(t => t._id === parentId);
                if (!thread) {
                    return prev;
                }

                const updated = {
                    ...thread,
                    lastReplyAt: reply.createdAt,
                    lastReplyUser: reply.sender
                };

                // Remove from current position and add to top
                const others = prev.filter(t => t._id !== parentId);
                return [updated, ...others];
            });
        };

        socket.on('thread:created', handleThreadCreated);
        socket.on('message-updated', handleMessageUpdated);
        socket.on('thread-reply', handleThreadReply);

        return () => {
            socket.off('thread:created', handleThreadCreated);
            socket.off('message-updated', handleMessageUpdated);
            socket.off('thread-reply', handleThreadReply);
        };
    }, [socket, channelId]);


    const filteredThreads = threads.filter(t => {
        const text = t.decryptedContent || t.payload?.text || t.text || '';
        return text.toLowerCase().includes(searchTerm.toLowerCase());
    });

    return (
        <div className="flex w-full h-full bg-gray-50 dark:bg-gray-900">
            {/* Left Column: Thread List */}
            <div className="flex-shrink-0 w-[280px] flex flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                {/* Header */}
                <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                        <MessageSquare className="text-blue-500" size={20} />
                        Active Threads
                        <span className="text-xs font-normal text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full ml-auto">
                            {threads.length}
                        </span>
                    </h2>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                            type="text"
                            placeholder="Search threads..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-transparent focus:bg-white dark:focus:bg-gray-950 focus:border-blue-500 rounded-lg text-sm transition-all outline-none"
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                    {loading ? (
                        <div className="space-y-1 p-2 animate-pulse">
                            {[75, 55, 90, 60, 80].map((w, i) => (
                                <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white dark:bg-gray-800/40">
                                    {/* Avatar */}
                                    <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                                    {/* Content */}
                                    <div className="flex-1 min-w-0 space-y-1.5">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2.5 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                                            <div className="h-2 w-10 bg-gray-100 dark:bg-gray-700/50 rounded" />
                                        </div>
                                        <div className="h-2.5 bg-gray-100 dark:bg-gray-700/50 rounded" style={{ width: `${w}%` }} />
                                    </div>
                                    {/* Reply badge */}
                                    <div className="w-8 h-5 bg-blue-50 dark:bg-blue-900/20 rounded flex-shrink-0" />
                                </div>
                            ))}
                        </div>
                    ) : filteredThreads.length === 0 ? (
                        <div className="text-center py-10 opacity-40">
                            <ListFilter size={48} className="mx-auto mb-2 text-gray-300" />
                            <p className="text-sm font-medium">No threads found</p>
                        </div>
                    ) : (
                        filteredThreads.map(thread => (
                            <div
                                key={thread._id}
                                onClick={() => setSelectedThread(thread)}
                                className={`group flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer border transition-all ${selectedThread?._id === thread._id
                                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50'
                                    : 'bg-white dark:bg-gray-800/40 border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/70'
                                    }`}
                            >
                                {/* Avatar */}
                                <img
                                    src={getAvatarUrl(thread.sender || { username: thread.senderName || '?' })}
                                    alt={thread.sender?.username || thread.senderName || 'User'}
                                    className="w-7 h-7 rounded-full object-cover flex-shrink-0 border border-gray-200 dark:border-gray-700"
                                    onError={(e) => {
                                        const name = thread.sender?.username || thread.senderName || '?';
                                        e.target.style.display = 'none';
                                        const div = document.createElement('div');
                                        div.className = 'w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0';
                                        div.textContent = name.charAt(0).toUpperCase();
                                        e.target.parentNode.insertBefore(div, e.target);
                                    }}
                                />

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 truncate">
                                            {thread.sender?.username || thread.senderName || 'Unknown'}
                                        </span>
                                        <span className="text-[10px] text-gray-400 flex-shrink-0">
                                            {formatTime(thread.createdAt)}
                                        </span>
                                    </div>
                                    <p className="text-[12px] text-gray-600 dark:text-gray-400 truncate leading-tight">
                                        {thread.decryptedContent || thread.payload?.text || thread.text || '🔒 Encrypted message'}
                                    </p>
                                </div>

                                {/* Reply badge */}
                                <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                                    <MessageSquare size={9} />
                                    {thread.replyCount}
                                </span>

                                <ArrowRight size={13} className={`flex-shrink-0 text-gray-400 opacity-0 -translate-x-1 transition-all ${selectedThread?._id === thread._id ? 'opacity-100 translate-x-0 text-blue-500' : 'group-hover:opacity-100 group-hover:translate-x-0'}`} />
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Right Column: Thread Panel */}
            <div className="flex-1 flex flex-col bg-white dark:bg-gray-950/50 overflow-hidden">
                {selectedThread ? (
                    <div className="flex-1 flex flex-col h-full overflow-hidden">
                        {/* Custom Close Header */}
                        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <MessageSquare size={16} className="text-blue-500" />
                                <span className="text-sm font-bold text-gray-800 dark:text-gray-100">Thread</span>
                            </div>
                            <button
                                onClick={() => setSelectedThread(null)}
                                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
                                title="Close Thread"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <ThreadPanel
                            parentMessage={selectedThread}
                            channelId={channelId}
                            conversationType="channel"
                            onClose={() => setSelectedThread(null)}
                            socket={socket}
                            currentUserId={currentUserId}
                            fullHeight={true}
                            showHeader={false}
                            className="w-full border-none shadow-none flex-1"
                        />
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-600 p-8 text-center animate-fade-in">
                        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
                            <MessageSquare size={48} className="opacity-50" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300 mb-2">Select a Thread</h3>
                        <p className="max-w-xs mx-auto text-sm">
                            Click on any conversation from the list to view the full thread and reply.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
