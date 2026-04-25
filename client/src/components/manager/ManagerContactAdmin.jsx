import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { useToast } from '../../contexts/ToastContext';
import { Send, Paperclip, User, MessageSquare } from 'lucide-react';
import api from '@services/api';
import io from 'socket.io-client';

const ManagerContactAdmin = () => {
    const { user } = useAuth();
    const { company } = useCompany();
    const { showToast } = useToast();

    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [admin, setAdmin] = useState(null);
    const messagesEndRef = useRef(null);
    const socketRef = useRef(null);

    
    useEffect(() => {
        const fetchAdmin = async () => {
            try {
                const response = await api.get(`/api/companies/${company._id}/members`);

                const members = response.data.members || [];
                const companyAdmin = members.find(m => ['owner', 'admin'].includes(m.companyRole));
                setAdmin(companyAdmin);
            } catch (error) {
                console.error('Error fetching admin:', error);
            }
        };

        if (company) {
            fetchAdmin();
        }
    }, [company]);

    
    useEffect(() => {
        const fetchConversation = async () => {
            if (!admin?._id) return;

            try {
                setLoading(true);
                const response = await api.get(`/api/internal/messages/conversation/${admin._id}`);
                setMessages(response.data.messages || []);
            } catch (error) {
                console.error('Error fetching messages:', error);
                showToast('Failed to load messages', 'error');
            } finally {
                setLoading(false);
            }
        };

        if (admin) {
            fetchConversation();
        }
    }, [admin, showToast]);

    
    useEffect(() => {
        if (!user?._id) return;

        socketRef.current = io(import.meta.env.VITE_BACKEND_URL, {
            withCredentials: true
        });

        
        socketRef.current.emit('join-room', `user-${user._id}`);

        
        socketRef.current.on('internal-message', (message) => {
            if (message.sender._id === admin?._id || message.recipient._id === admin?._id) {
                setMessages(prev => [...prev, message]);
                scrollToBottom();
            }
        });

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, [user, admin]);

    
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !admin?._id) return;

        try {
            const response = await api.post(`/api/internal/messages`, {
                    recipientId: admin._id,
                    content: newMessage.trim()
                });

            setMessages(prev => [...prev, response.data.message]);
            setNewMessage('');
            showToast('Message sent successfully', 'success');
        } catch (error) {
            console.error('Error sending message:', error);
            showToast('Failed to send message', 'error');
        }
    };

    if (!admin) {
        return (
            <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
                <div className="text-center">
                    <User className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">No company admin found</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
            {}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-8 py-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-lg">
                        {admin.username?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Contact Company Admin</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Messaging {admin.username} • {admin.email}
                        </p>
                    </div>
                </div>
            </div>

            {}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50 dark:bg-gray-900">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <MessageSquare className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No messages yet</h3>
                        <p className="text-gray-500 dark:text-gray-400 max-w-md">
                            Start a conversation with your company admin. They'll be notified and can respond directly.
                        </p>
                    </div>
                ) : (
                    <>
                        {messages.map((msg, idx) => {
                            const isFromMe = msg.sender._id === user._id;
                            return (
                                <div
                                    key={idx}
                                    className={`flex ${isFromMe ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-md px-4 py-3 rounded-2xl ${isFromMe
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white'
                                            }`}
                                    >
                                        <p className="text-sm">{msg.content}</p>
                                        <p
                                            className={`text-xs mt-1 ${isFromMe ? 'text-indigo-200' : 'text-gray-500 dark:text-gray-400'
                                                }`}
                                        >
                                            {new Date(msg.createdAt).toLocaleTimeString()}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {}
            <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                    <button
                        type="button"
                        className="p-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <Paperclip size={20} />
                    </button>
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your message..."
                        className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim()}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                    >
                        <Send size={18} />
                        Send
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ManagerContactAdmin;
