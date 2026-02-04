import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Hash, User, MessageSquare, Lock, CheckSquare, FileText } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080'}/api`;

export default function UniversalSearch({ workspaceId, onClose, results, loading, query }) {
    const navigate = useNavigate();

    const hasResults = results.channels.length > 0 || results.contacts.length > 0 || results.messages.length > 0 || results.tasks.length > 0 || results.notes.length > 0;


    // Handle ESC key to close
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    // Handle channel navigation
    const handleChannelClick = (channel) => {
        const navPath = `/workspace/${workspaceId}/messages?channel=${channel.id}`;


        navigate(navPath);
        onClose();
    };

    // Handle contact/DM navigation
    const handleContactClick = async (contact) => {
        try {
            // Get or create DM session
            const token = localStorage.getItem('accessToken');
            const response = await axios.get(
                `${API_BASE_URL}/messages/workspace/${workspaceId}/dms`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            // Find existing DM session with this contact
            const existingDM = response.data.sessions?.find(
                (session) => session.otherUserId === contact.id
            );

            if (existingDM) {
                // Navigate to existing DM
                navigate(`/workspace/${workspaceId}/messages?dm=${existingDM.id}`);
            } else {
                // Navigate to messages and trigger new DM creation
                navigate(`/workspace/${workspaceId}/messages?newDM=${contact.id}`);
            }
            onClose();
        } catch (err) {
            console.error('Error opening DM:', err);
            // Fallback: just navigate to messages
            navigate(`/workspace/${workspaceId}/messages`);
            onClose();
        }
    };

    // Handle message navigation
    const handleMessageClick = (message) => {

        if (message.parent.type === 'channel') {
            const navPath = `/workspace/${workspaceId}/messages?channel=${message.parent.id}&highlight=${message.id}`;

            navigate(navPath);
        } else {
            const navPath = `/workspace/${workspaceId}/messages?dm=${message.parent.id}&highlight=${message.id}`;

            navigate(navPath);
        }
        onClose();
    };

    // Handle task navigation
    const handleTaskClick = (task) => {


        // Determine the appropriate filter based on task properties
        let filter = 'incoming'; // default

        if (task.status === 'done') {
            filter = 'completed';
        } else if (task.deleted) {
            filter = 'deleted';
        } else if (task.assignedTo && task.assignedTo.length > 0) {
            // Check if task is assigned to someone else (delegated) or to current user
            const isAssignedToOthers = task.assignedTo.some(assignee => assignee.id !== task.createdBy.id);
            if (isAssignedToOthers && task.createdBy.id === localStorage.getItem('userId')) {
                filter = 'delegated';
            } else {
                filter = 'incoming';
            }
        } else if (task.visibility === 'private') {
            filter = 'personal';
        }


        navigate(`/workspace/${workspaceId}/tasks?filter=${filter}&taskId=${task.id}`);
        onClose();
    };

    // Handle note navigation
    const handleNoteClick = (note) => {

        navigate(`/workspace/${workspaceId}/notes?noteId=${note.id}`);
        onClose();
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;

        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;

        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString();
    };

    return (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-[100] animate-fade-in max-w-2xl mx-auto">


            {/* Results */}
            <div className="max-h-[400px] overflow-y-auto">
                {/* Empty State - No Query */}
                {!query.trim() && (
                    <div className="py-16 text-center">
                        <Search size={48} className="mx-auto text-gray-300 dark:text-gray-700 mb-4" />
                        <p className="text-gray-500 dark:text-gray-400 text-sm">
                            Start typing to search across channels, contacts, and messages
                        </p>
                        <div className="mt-4 flex items-center justify-center gap-2">
                            <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700">
                                Cmd+K
                            </kbd>
                            <span className="text-xs text-gray-400">to open search</span>
                        </div>
                    </div>
                )}

                {/* Empty State - No Results */}
                {query.trim() && !loading && !hasResults && (
                    <div className="py-16 text-center">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search size={32} className="text-gray-400 dark:text-gray-500" />
                        </div>
                        <p className="text-gray-900 dark:text-gray-100 font-medium">No results found</p>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                            Try searching for something else
                        </p>
                    </div>
                )}

                {/* Channels Section */}
                {results.channels.length > 0 && (
                    <div className="border-b border-gray-100 dark:border-gray-800">
                        <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900/50">
                            Channels
                        </div>
                        {results.channels.map((channel) => (
                            <button
                                key={channel.id}
                                onClick={() => handleChannelClick(channel)}
                                className="w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 flex items-center gap-3 transition-colors text-left group"
                            >
                                <div className={`w-8 h-8 rounded flex items-center justify-center text-sm font-medium ${channel.isPrivate
                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                                    }`}>
                                    {channel.isPrivate ? <Lock size={14} /> : <Hash size={14} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                        {channel.name}
                                    </div>
                                    {channel.description && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                            {channel.description}
                                        </div>
                                    )}
                                </div>
                                <div className="text-xs text-gray-400 dark:text-gray-500">
                                    {channel.memberCount} {channel.memberCount === 1 ? 'member' : 'members'}
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {/* Contacts Section */}
                {results.contacts.length > 0 && (
                    <div className="border-b border-gray-100 dark:border-gray-800">
                        <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900/50">
                            Contacts
                        </div>
                        {results.contacts.map((contact) => (
                            <button
                                key={contact.id}
                                onClick={() => handleContactClick(contact)}
                                className="w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 flex items-center gap-3 transition-colors text-left group"
                            >
                                {contact.profilePicture ? (
                                    <img
                                        src={contact.profilePicture}
                                        alt={contact.name}
                                        className="w-8 h-8 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
                                        {contact.name.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                        {contact.name}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                        {contact.email}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    {contact.isOnline ? (
                                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                    ) : (
                                        <div className="w-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {/* Messages Section */}
                {results.messages.length > 0 && (
                    <div className="border-b border-gray-100 dark:border-gray-800">
                        <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900/50">
                            Messages (3 most recent)
                        </div>
                        {results.messages.map((message) => (
                            <button
                                key={message.id}
                                onClick={() => handleMessageClick(message)}
                                className="w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 flex items-start gap-3 transition-colors text-left group"
                            >
                                <MessageSquare size={18} className="text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                                            {message.sender.name}
                                        </span>
                                        <span className="text-xs text-gray-400 dark:text-gray-500">in</span>
                                        <span className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                                            {message.parent.type === 'channel' ? (
                                                <>
                                                    <Hash size={12} />
                                                    {message.parent.name}
                                                </>
                                            ) : (
                                                <>
                                                    <User size={12} />
                                                    {message.parent.name}
                                                </>
                                            )}
                                        </span>
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                                        {message.preview}
                                    </div>
                                </div>
                                <div className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                                    {formatTime(message.createdAt)}
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {/* Tasks Section */}
                {results.tasks.length > 0 && (
                    <div className="border-b border-gray-100 dark:border-gray-800">
                        <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900/50">
                            Tasks
                        </div>
                        {results.tasks.map((task) => (
                            <button
                                key={task.id}
                                onClick={() => handleTaskClick(task)}
                                className="w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 flex items-start gap-3 transition-colors text-left group"
                            >
                                <CheckSquare size={18} className={`mt-0.5 flex-shrink-0 ${task.status === 'done' ? 'text-green-500' : 'text-blue-500'
                                    }`} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                                            {task.title}
                                        </span>
                                        <span className={`px-1.5 py-0.5 text-xs rounded-full ${task.priority === 'highest' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                            task.priority === 'high' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                                                task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                    'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                                            }`}>
                                            {task.priority}
                                        </span>
                                    </div>
                                    {task.description && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mb-1">
                                            {task.description}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                                        <span>by {task.createdBy.name}</span>
                                        {task.assignedTo.length > 0 && (
                                            <span>• assigned to {task.assignedTo.length} {task.assignedTo.length === 1 ? 'person' : 'people'}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                                    {formatTime(task.createdAt)}
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {/* Notes Section */}
                {results.notes.length > 0 && (
                    <div>
                        <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900/50">
                            Notes
                        </div>
                        {results.notes.map((note) => (
                            <button
                                key={note.id}
                                onClick={() => handleNoteClick(note)}
                                className="w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 flex items-start gap-3 transition-colors text-left group"
                            >
                                <FileText size={18} className="text-purple-500 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                                            {note.title}
                                        </span>
                                        {note.isPinned && (
                                            <span className="text-xs text-yellow-600 dark:text-yellow-500">📌</span>
                                        )}
                                        {note.isPublic && (
                                            <span className="px-1.5 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                Public
                                            </span>
                                        )}
                                    </div>
                                    {note.preview && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-1">
                                            {note.preview}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                                        <span>by {note.owner.name}</span>
                                        {note.tags.length > 0 && (
                                            <span>• {note.tags.slice(0, 2).join(', ')}{note.tags.length > 2 ? '...' : ''}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                                    {formatTime(note.createdAt)}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer Hint */}
            <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                <div className="text-center text-xs text-gray-500 dark:text-gray-400">
                    <span>Press ESC to close • Type to search</span>
                </div>
            </div>
        </div>
    );
}
