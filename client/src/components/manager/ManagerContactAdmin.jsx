// client/src/components/manager/ManagerContactAdmin.jsx
// Internal messaging interface for Manager to Company Admin communication

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { useToast } from '../../contexts/ToastContext';
import { Send, Paperclip, User, MessageSquare } from 'lucide-react';
import axios from 'axios';
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

    // Get company admin
    useEffect(() => {
        const fetchAdmin = async () => {
            try {
                const response = await axios.get(
                    `${process.env.REACT_APP_BACKEND_URL}/api/companies/${company._id}/members`,
                    { withCredentials: true }
                );

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

    // Fetch conversation with admin
    useEffect(() => {
        const fetchConversation = async () => {
            if (!admin?._id) return;

            try {
                setLoading(true);
                const response = await axios.get(
                    `${process.env.REACT_APP_BACKEND_URL}/api/internal/messages/conversation/${admin._id}`,
                    { withCredentials: true }
                );
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

    // Initialize Socket.IO
    useEffect(() => {
        if (!user?._id) return;

        socketRef.current = io(process.env.REACT_APP_BACKEND_URL, {
            withCredentials: true
        });

        // Join user's personal room
        socketRef.current.emit('join-room', `user-${user._id}`);

        // Listen for new internal messages
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

    // Auto-scroll to bottom
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
            const response = await axios.post(
                `${process.env.REACT_APP_BACKEND_URL}/api/internal/messages`,
                {
                    recipientId: admin._id,
                    content: newMessage.trim()
                },
                { withCredentials: true }
            );

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
            <div className="h-full flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No company admin found</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-8 py-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg">
                        {admin.username?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900">Contact Company Admin</h1>
                        <p className="text-sm text-gray-500">
                            Messaging {admin.username} • {admin.email}
                        </p>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <MessageSquare className="w-16 h-16 text-gray-300 mb-4" />
                        <h3 className="text-lg font-bold text-gray-900 mb-2">No messages yet</h3>
                        <p className="text-gray-500 max-w-md">
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
                                                : 'bg-white border border-gray-200 text-gray-900'
                                            }`}
                                    >
                                        <p className="text-sm">{msg.content}</p>
                                        <p
                                            className={`text-xs mt-1 ${isFromMe ? 'text-indigo-200' : 'text-gray-500'
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

            {/* Message Input */}
            <div className="border-t border-gray-200 p-4 bg-white">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                    <button
                        type="button"
                        className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <Paperclip size={20} />
                    </button>
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your message..."
                        className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
