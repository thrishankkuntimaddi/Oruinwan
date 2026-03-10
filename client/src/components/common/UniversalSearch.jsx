import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Hash, User, MessageSquare, Lock, CheckSquare, FileText, Loader2 } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080'}/api`;

// Helper: highlight matched text in a string
function HighlightMatch({ text = '', query = '' }) {
    if (!query.trim() || !text) return <span>{text}</span>;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    return (
        <span>
            {parts.map((part, i) =>
                part.toLowerCase() === query.toLowerCase()
                    ? <mark key={i} className="bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 rounded px-0.5">{part}</mark>
                    : <span key={i}>{part}</span>
            )}
        </span>
    );
}

// Skeleton loader row
function SkeletonRow() {
    return (
        <div className="px-4 py-3 flex items-center gap-3 animate-pulse">
            <div className="w-8 h-8 rounded bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded w-2/3" />
            </div>
        </div>
    );
}

export default function UniversalSearch({ workspaceId, onClose, results, loading, query, clearSearch }) {
    const navigate = useNavigate();

    const hasResults =
        results.channels.length > 0 ||
        results.contacts.length > 0 ||
        results.messages.length > 0 ||
        results.tasks.length > 0 ||
        results.notes.length > 0;

    // Handle ESC key to close
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                clearSearch?.();
                onClose();
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose, clearSearch]);

    const handleClose = () => {
        onClose();
        // Don't clear search on close so user can reopen to same state
    };

    // Navigate helpers
    const handleChannelClick = (channel) => {
        navigate(`/workspace/${workspaceId}/messages?channel=${channel.id}`);
        clearSearch?.();
        onClose();
    };

    const handleContactClick = async (contact) => {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await axios.get(
                `${API_BASE_URL}/messages/workspace/${workspaceId}/dms`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const existingDM = response.data.sessions?.find(
                (session) => session.otherUserId === contact.id
            );
            if (existingDM) {
                navigate(`/workspace/${workspaceId}/messages?dm=${existingDM.id}`);
            } else {
                navigate(`/workspace/${workspaceId}/messages?newDM=${contact.id}`);
            }
        } catch {
            navigate(`/workspace/${workspaceId}/messages`);
        }
        clearSearch?.();
        onClose();
    };

    const handleMessageClick = (message) => {
        if (message.parent.type === 'channel') {
            navigate(`/workspace/${workspaceId}/messages?channel=${message.parent.id}&highlight=${message.id}`);
        } else {
            navigate(`/workspace/${workspaceId}/messages?dm=${message.parent.id}&highlight=${message.id}`);
        }
        clearSearch?.();
        onClose();
    };

    const handleTaskClick = (task) => {
        let filter = 'incoming';
        if (task.status === 'done') filter = 'completed';
        else if (task.visibility === 'private') filter = 'personal';
        navigate(`/workspace/${workspaceId}/tasks?filter=${filter}&taskId=${task.id}`);
        clearSearch?.();
        onClose();
    };

    const handleNoteClick = (note) => {
        navigate(`/workspace/${workspaceId}/notes?noteId=${note.id}`);
        clearSearch?.();
        onClose();
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMins = Math.floor((now - date) / 60000);
        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-[100] max-w-2xl mx-auto" style={{ animation: 'searchFadeIn 0.12s cubic-bezier(.4,0,.2,1)' }}>

            {/* Results */}
            <div className="max-h-[460px] overflow-y-auto">

                {/* Loading Skeletons */}
                {loading && query.trim() && (
                    <div className="border-b border-gray-100 dark:border-gray-800">
                        <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900/50 flex items-center gap-2">
                            <Loader2 size={12} className="animate-spin" />
                            Searching…
                        </div>
                        <SkeletonRow />
                        <SkeletonRow />
                        <SkeletonRow />
                    </div>
                )}

                {/* Empty State — No Query */}
                {!query.trim() && (
                    <div className="py-14 text-center">
                        <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search size={26} className="text-gray-400 dark:text-gray-500" />
                        </div>
                        <p className="text-gray-600 dark:text-gray-300 font-medium text-sm">
                            Search across everything
                        </p>
                        <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                            Channels, contacts, messages, tasks, notes
                        </p>
                        <div className="mt-4 flex items-center justify-center gap-2">
                            <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700">
                                Cmd+K
                            </kbd>
                            <span className="text-xs text-gray-400">to open • ESC to close</span>
                        </div>
                    </div>
                )}

                {/* Empty State — No Results */}
                {query.trim() && !loading && !hasResults && (
                    <div className="py-14 text-center">
                        <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Search size={26} className="text-gray-400" />
                        </div>
                        <p className="text-gray-900 dark:text-gray-100 font-medium text-sm">No results for "{query}"</p>
                        <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Try a different search term</p>
                    </div>
                )}

                {/* ── Channels ── */}
                {!loading && results.channels.length > 0 && (
                    <div className="border-b border-gray-100 dark:border-gray-800">
                        <SectionHeader label="Channels" count={results.channels.length} />
                        {results.channels.map((channel) => (
                            <button
                                key={channel.id}
                                onClick={() => handleChannelClick(channel)}
                                className="w-full px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 flex items-center gap-3 transition-colors text-left group"
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium flex-shrink-0 ${
                                    channel.isPrivate
                                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                                }`}>
                                    {channel.isPrivate ? <Lock size={14} /> : <Hash size={14} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm">
                                        <HighlightMatch text={channel.name} query={query} />
                                    </div>
                                    {channel.description && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                            <HighlightMatch text={channel.description} query={query} />
                                        </div>
                                    )}
                                </div>
                                <div className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                                    {channel.memberCount} {channel.memberCount === 1 ? 'member' : 'members'}
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {/* ── Contacts ── */}
                {!loading && results.contacts.length > 0 && (
                    <div className="border-b border-gray-100 dark:border-gray-800">
                        <SectionHeader label="People" count={results.contacts.length} />
                        {results.contacts.map((contact) => (
                            <button
                                key={contact.id}
                                onClick={() => handleContactClick(contact)}
                                className="w-full px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 flex items-center gap-3 transition-colors text-left group"
                            >
                                {contact.profilePicture ? (
                                    <img src={contact.profilePicture} alt={contact.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                                        {contact.name?.charAt(0)?.toUpperCase() || <User size={14} />}
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm">
                                        <HighlightMatch text={contact.name} query={query} />
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                        <HighlightMatch text={contact.email} query={query} />
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <div className={`w-2 h-2 rounded-full ${contact.isOnline ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                                    <span className="text-[10px] text-gray-400">{contact.isOnline ? 'Online' : 'Offline'}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {/* ── Messages ── */}
                {!loading && results.messages.length > 0 && (
                    <div className="border-b border-gray-100 dark:border-gray-800">
                        <SectionHeader label="Messages" count={results.messages.length} note="3 most recent" />
                        {results.messages.map((message) => (
                            <button
                                key={message.id}
                                onClick={() => handleMessageClick(message)}
                                className="w-full px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 flex items-start gap-3 transition-colors text-left group"
                            >
                                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                                    <MessageSquare size={14} className="text-gray-500 dark:text-gray-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{message.sender.name}</span>
                                        <span className="text-xs text-gray-400">in</span>
                                        <span className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                                            {message.parent.type === 'channel' ? <Hash size={11} /> : <User size={11} />}
                                            {message.parent.name}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                                        <HighlightMatch text={message.preview} query={query} />
                                    </div>
                                </div>
                                <div className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{formatTime(message.createdAt)}</div>
                            </button>
                        ))}
                    </div>
                )}

                {/* ── Tasks ── */}
                {!loading && results.tasks.length > 0 && (
                    <div className="border-b border-gray-100 dark:border-gray-800">
                        <SectionHeader label="Tasks" count={results.tasks.length} />
                        {results.tasks.map((task) => (
                            <button
                                key={task.id}
                                onClick={() => handleTaskClick(task)}
                                className="w-full px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 flex items-start gap-3 transition-colors text-left group"
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                    task.status === 'done'
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                }`}>
                                    <CheckSquare size={14} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                        <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                                            <HighlightMatch text={task.title} query={query} />
                                        </span>
                                        <PriorityBadge priority={task.priority} />
                                    </div>
                                    {task.description && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                                            <HighlightMatch text={task.description} query={query} />
                                        </div>
                                    )}
                                    <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                                        by {task.createdBy?.name || 'Unknown'}
                                        {task.assignedTo?.length > 0 && ` • ${task.assignedTo.length} assignee${task.assignedTo.length !== 1 ? 's' : ''}`}
                                        {task.dueDate && ` • due ${new Date(task.dueDate).toLocaleDateString()}`}
                                    </div>
                                </div>
                                <div className="text-xs text-gray-400 flex-shrink-0">{formatTime(task.createdAt)}</div>
                            </button>
                        ))}
                    </div>
                )}

                {/* ── Notes ── */}
                {!loading && results.notes.length > 0 && (
                    <div>
                        <SectionHeader label="Notes" count={results.notes.length} />
                        {results.notes.map((note) => (
                            <button
                                key={note.id}
                                onClick={() => handleNoteClick(note)}
                                className="w-full px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 flex items-start gap-3 transition-colors text-left group"
                            >
                                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                                    <FileText size={14} className="text-purple-600 dark:text-purple-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                        <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                                            <HighlightMatch text={note.title} query={query} />
                                        </span>
                                        {note.isPinned && <span className="text-xs">📌</span>}
                                        {note.isPublic && (
                                            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium">Public</span>
                                        )}
                                    </div>
                                    {note.preview && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                                            <HighlightMatch text={note.preview} query={query} />
                                        </div>
                                    )}
                                    <div className="text-[10px] text-gray-400 mt-1">
                                        by {note.owner?.name || 'Unknown'}
                                        {note.tags?.length > 0 && ` • ${note.tags.slice(0,2).join(', ')}`}
                                    </div>
                                </div>
                                <div className="text-xs text-gray-400 flex-shrink-0">{formatTime(note.createdAt)}</div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>
                        {hasResults && !loading
                            ? `${[results.channels.length, results.contacts.length, results.messages.length, results.tasks.length, results.notes.length].reduce((a, b) => a + b, 0)} results`
                            : 'Type to search'}
                    </span>
                    <span>ESC to close</span>
                </div>
            </div>

            <style>{`
                @keyframes searchFadeIn {
                    from { opacity: 0; transform: translateY(-6px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    );
}

// Sub-components
function SectionHeader({ label, count, note }) {
    return (
        <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
            <span>{label}</span>
            <span className="font-normal normal-case text-gray-400 dark:text-gray-500">
                {note || `${count} found`}
            </span>
        </div>
    );
}

function PriorityBadge({ priority }) {
    const styles = {
        highest: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
        medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
        low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    };
    if (!priority) return null;
    return (
        <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-semibold ${styles[priority] || styles.low}`}>
            {priority}
        </span>
    );
}
