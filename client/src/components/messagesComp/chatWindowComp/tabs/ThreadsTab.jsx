import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, ArrowRight, Clock, Search, ListFilter, X } from 'lucide-react';
import ThreadPanel from '../ThreadPanel';
import api from '../../../../services/api';
import { formatTime } from '../helpers/helpers';
import { batchDecryptMessages } from '../../../../services/messageEncryptionService';

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
            <div className={`w-full md:w-1/3 min-w-[320px] max-w-sm flex flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 ${selectedThread ? 'hidden md:flex' : 'flex'}`}>
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
                        <div className="flex flex-col items-center justify-center py-10 opacity-50">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mb-2"></div>
                            <span className="text-xs">Loading threads...</span>
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
                                className={`group p-3 rounded-xl cursor-pointer border transition-all hover:shadow-md ${selectedThread?._id === thread._id
                                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50 shadow-sm'
                                    : 'bg-white dark:bg-gray-800/50 border-transparent hover:border-gray-200 dark:hover:border-gray-700'
                                    }`}
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-gray-300">
                                            {(thread.sender?.username || thread.senderName || '?').charAt(0)}
                                        </div>
                                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate max-w-[120px]">
                                            {thread.sender?.username || thread.senderName || "Unknown"}
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                        <Clock size={10} />
                                        {formatTime(thread.createdAt)}
                                    </span>
                                </div>

                                <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2 mb-3 leading-relaxed">
                                    {thread.decryptedContent || thread.payload?.text || thread.text || '🔒 Encrypted message'}
                                </p>

                                <div className="flex items-center justify-between">
                                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white dark:bg-gray-800 text-xs font-medium text-blue-600 dark:text-blue-400 border border-gray-100 dark:border-gray-700">
                                        <MessageSquare size={10} />
                                        {thread.replyCount} replies
                                    </span>
                                    <ArrowRight size={14} className={`text-gray-400 opacity-0 -translate-x-2 transition-all ${selectedThread?._id === thread._id ? 'opacity-100 translate-x-0 text-blue-500' : 'group-hover:opacity-100 group-hover:translate-x-0'
                                        }`} />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Right Column: Thread Panel */}
            <div className={`flex-1 flex flex-col bg-white dark:bg-gray-950/50 ${!selectedThread ? 'hidden md:flex' : 'flex'}`}>
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
