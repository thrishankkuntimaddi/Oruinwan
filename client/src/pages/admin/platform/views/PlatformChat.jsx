import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '@services/api';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, Search, Circle, MessageSquare, ArrowLeft, CheckCheck, Building2 } from 'lucide-react';
import { useToast } from '../../../../contexts/ToastContext';
import io from 'socket.io-client';

const PlatformChat = () => {
    const { userId } = useParams(); // /chttrix-admin/dm/user/:userId
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef(null);
    const socketRef = useRef(null);
    const { showToast } = useToast();

    // Fetch users list with last message + unread count
    const fetchUsers = useCallback(async () => {
        try {
            const res = await api.get(`/api/admin/dm-users`);
            setUsers(res.data || []);
        } catch (err) {
            console.error('Failed to fetch DM users:', err);
            showToast('Failed to load users', 'error');
        }
    }, [showToast]);

    // Fetch messages for a specific user
    const fetchMessages = useCallback(async (uid) => {
        try {
            const res = await api.get(`/api/admin/dm/user/${uid}`);
            setMessages(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Failed to fetch messages:', err);
        }
    }, []);

    // Setup socket — listen for platform-message events from all users
    useEffect(() => {
        socketRef.current = io(import.meta.env.VITE_BACKEND_URL);

        socketRef.current.on('platform-message', (message) => {
            // Append if it's for the currently selected user (sender or receiver matches)
            setMessages(prev => {
                const alreadyExists = prev.some(m => m._id === message._id);
                if (alreadyExists) return prev;
                return [...prev, message];
            });
            scrollToBottom();
            // Refresh sidebar counts
            fetchUsers();
        });

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, [fetchUsers]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // Select user from URL param
    useEffect(() => {
        if (userId && users.length > 0) {
            const found = users.find(u => u._id === userId);
            if (found) {
                setSelectedUser(found);
                fetchMessages(userId);
            }
        }
    }, [userId, users, fetchMessages]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const selectUser = (user) => {
        setSelectedUser(user);
        setMessages([]);
        fetchMessages(user._id);
        navigate(`/chttrix-admin/dm/user/${user._id}`, { replace: true });
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() || !selectedUser || sending) return;

        setSending(true);
        try {
            const res = await api.post(
                `/api/admin/dm/user/${selectedUser._id}`,
                { message: input }
            );
            setMessages(prev => [...prev, res.data]);
            setInput('');
            scrollToBottom();
            fetchUsers(); // refresh sidebar
        } catch (err) {
            console.error('Failed to send message:', err);
            showToast('Failed to send message', 'error');
        } finally {
            setSending(false);
        }
    };

    const scrollToBottom = () => {
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    };

    const filteredUsers = users.filter(u =>
        u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const isPlatformMsg = (msg) => msg.senderRole === 'platform';
    const formatTime = (date) => new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const roleColors = {
        owner: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
        admin: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
        manager: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' };

    return (
        <div className="h-[calc(100vh-140px)] flex gap-6">
            {/* Users List */}
            <div className={`${selectedUser ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-col bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden`}>
                <div className="p-5 border-b border-gray-100 dark:border-gray-700">
                    <h2 className="text-lg font-black text-gray-900 dark:text-white mb-3">Direct Messages</h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                        <input
                            type="text"
                            placeholder="Search users or companies..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {filteredUsers.length === 0 ? (
                        <div className="p-8 text-center">
                            <p className="text-gray-400 text-sm">No company users found</p>
                        </div>
                    ) : filteredUsers.map(user => (
                        <button
                            key={user._id}
                            onClick={() => selectUser(user)}
                            className={`w-full p-4 border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all text-left ${selectedUser?._id === user._id
                                ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-l-indigo-600'
                                : 'border-l-4 border-l-transparent'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className="relative flex-shrink-0">
                                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">
                                        {user.username?.charAt(0).toUpperCase()}
                                    </div>
                                    {user.isOnline && (
                                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full" />
                                    )}
                                    {user.unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                                            {user.unreadCount > 9 ? '9+' : user.unreadCount}
                                        </span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{user.username}</p>
                                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded flex-shrink-0 ${roleColors[user.companyRole] || roleColors.admin}`}>
                                            {user.companyRole}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Building2 size={10} className="text-gray-400 flex-shrink-0" />
                                        <p className="text-xs text-gray-400 truncate">{user.companyName}</p>
                                    </div>
                                    {user.lastMessage && (
                                        <p className="text-xs text-gray-400 truncate mt-0.5">{user.lastMessage.content}</p>
                                    )}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Chat Window */}
            {selectedUser ? (
                <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                    {/* Chat Header */}
                    <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex items-center gap-4">
                        <button
                            onClick={() => { setSelectedUser(null); navigate('/chttrix-admin/dm', { replace: true }); }}
                            className="md:hidden p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold">
                            {selectedUser.username?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-gray-900 dark:text-white">{selectedUser.username}</h3>
                                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${roleColors[selectedUser.companyRole] || roleColors.admin}`}>
                                    {selectedUser.companyRole}
                                </span>
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                                <Building2 size={11} className="text-gray-400" />
                                <p className="text-xs text-gray-500 dark:text-gray-400">{selectedUser.companyName}</p>
                            </div>
                        </div>
                        <div className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-bold border ${selectedUser.isOnline
                            ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900/30'
                            : 'text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                        }`}>
                            <Circle size={6} className={selectedUser.isOnline ? 'fill-green-600 dark:fill-green-400' : 'fill-gray-400'} />
                            {selectedUser.isOnline ? 'Online' : 'Offline'}
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/40 dark:bg-gray-900/20 custom-scrollbar">
                        {messages.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-gray-400 flex-col gap-3">
                                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                                    <MessageSquare size={28} className="opacity-40" />
                                </div>
                                <p className="font-semibold text-gray-500">No messages yet. Start the conversation!</p>
                            </div>
                        ) : (
                            messages.map((msg, index) => {
                                const isAdmin = isPlatformMsg(msg);
                                const senderInitial = msg.sender?.username?.charAt(0).toUpperCase() || (isAdmin ? 'C' : selectedUser.username?.charAt(0).toUpperCase());
                                return (
                                    <div key={msg._id || index} className={`flex gap-3 ${isAdmin ? 'flex-row-reverse' : ''}`}>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isAdmin
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-gradient-to-br from-indigo-400 to-purple-500 text-white'
                                        }`}>
                                            {senderInitial}
                                        </div>
                                        <div className={`max-w-[70%] flex flex-col gap-1 ${isAdmin ? 'items-end' : 'items-start'}`}>
                                            <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${isAdmin
                                                ? 'bg-indigo-600 text-white rounded-tr-none'
                                                : 'bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 text-gray-800 dark:text-gray-200 rounded-tl-none shadow-sm'
                                            }`}>
                                                {msg.content}
                                            </div>
                                            <div className={`flex items-center gap-1 text-[10px] text-gray-400 ${isAdmin ? 'flex-row-reverse' : ''}`}>
                                                <span>{formatTime(msg.createdAt)}</span>
                                                {isAdmin && <CheckCheck size={11} className="text-indigo-300" />}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <form onSubmit={sendMessage} className="p-4 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={`Message ${selectedUser.username}...`}
                                className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 text-sm text-gray-900 dark:text-white"
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || sending}
                                className="px-5 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                            >
                                {sending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={16} />}
                            </button>
                        </div>
                    </form>
                </div>
            ) : (
                <div className="hidden md:flex flex-1 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 items-center justify-center text-gray-400 flex-col gap-4">
                    <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                        <MessageSquare size={36} className="opacity-30" />
                    </div>
                    <div className="text-center">
                        <p className="font-bold text-lg text-gray-600 dark:text-gray-300">Select a user to start chatting</p>
                        <p className="text-sm text-gray-400 mt-1">Choose from owners, admins, or managers on the left</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlatformChat;
