import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Ticket, Send, Paperclip, Clock, CheckCircle, AlertCircle, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { useToast } from '../../contexts/ToastContext';
import axios from 'axios';
import io from 'socket.io-client';

const ContactAdmin = () => {
    const { user } = useAuth();
    const { company } = useCompany();
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState('chat'); // 'chat' or 'tickets'

    // Chat state
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loadingMessages, setLoadingMessages] = useState(false);
    const messagesEndRef = useRef(null);
    const socketRef = useRef(null);

    // Tickets state
    const [tickets, setTickets] = useState([]);
    const [loadingTickets, setLoadingTickets] = useState(false);
    const [isCreateTicketOpen, setIsCreateTicketOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [newTicket, setNewTicket] = useState({
        subject: '',
        priority: 'medium',
        description: ''
    });

    // Initialize Socket.io for real-time chat
    useEffect(() => {
        if (user && activeTab === 'chat') {
            socketRef.current = io(process.env.REACT_APP_BACKEND_URL, {
                withCredentials: true
            });

            socketRef.current.on('platform-message', (message) => {
                setMessages(prev => [...prev, message]);
            });

            return () => {
                if (socketRef.current) {
                    socketRef.current.disconnect();
                }
            };
        }
    }, [user, activeTab]);

    // Fetch chat messages
    useEffect(() => {
        if (activeTab === 'chat' && company?._id) {
            fetchMessages();
        }
    }, [activeTab, company?._id]);

    // Fetch tickets
    useEffect(() => {
        if (activeTab === 'tickets' && company?._id) {
            fetchTickets();
        }
    }, [activeTab, company?._id]);

    // Auto-scroll to bottom of chat
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchMessages = async () => {
        try {
            setLoadingMessages(true);
            const response = await axios.get(
                `${process.env.REACT_APP_BACKEND_URL}/api/platform/support/messages/${company._id}`,
                { withCredentials: true }
            );
            setMessages(response.data.messages || []);
        } catch (error) {
            console.error('Error fetching messages:', error);
            showToast('Failed to load messages', 'error');
        } finally {
            setLoadingMessages(false);
        }
    };

    const fetchTickets = async () => {
        try {
            setLoadingTickets(true);
            const response = await axios.get(
                `${process.env.REACT_APP_BACKEND_URL}/api/platform/support/tickets/${company._id}`,
                { withCredentials: true }
            );
            setTickets(response.data.tickets || []);
        } catch (error) {
            console.error('Error fetching tickets:', error);
            showToast('Failed to load tickets', 'error');
        } finally {
            setLoadingTickets(false);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        try {
            const response = await axios.post(
                `${process.env.REACT_APP_BACKEND_URL}/api/platform/support/messages`,
                {
                    companyId: company._id,
                    content: newMessage
                },
                { withCredentials: true }
            );

            setMessages(prev => [...prev, response.data.message]);
            setNewMessage('');
        } catch (error) {
            console.error('Error sending message:', error);
            showToast('Failed to send message', 'error');
        }
    };

    const handleCreateTicket = async (e) => {
        e.preventDefault();

        try {
            const response = await axios.post(
                `${process.env.REACT_APP_BACKEND_URL}/api/platform/support/tickets`,
                {
                    companyId: company._id,
                    ...newTicket
                },
                { withCredentials: true }
            );

            setTickets(prev => [response.data.ticket, ...prev]);
            setIsCreateTicketOpen(false);
            setNewTicket({
                subject: '',
                priority: 'medium',
                description: ''
            });
            showToast('Ticket created successfully', 'success');
        } catch (error) {
            console.error('Error creating ticket:', error);
            showToast('Failed to create ticket', 'error');
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'open': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'in-progress': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'resolved': return 'bg-green-100 text-green-700 border-green-200';
            case 'closed': return 'bg-gray-100 text-gray-700 border-gray-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'low': return 'bg-gray-100 text-gray-600';
            case 'medium': return 'bg-blue-100 text-blue-600';
            case 'high': return 'bg-orange-100 text-orange-600';
            case 'critical': return 'bg-red-100 text-red-600';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    return (
        <div className="flex-1 bg-gray-50 dark:bg-gray-900 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-8 py-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white">Contact Platform Admin</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Get support from the Chttrix team
                        </p>
                    </div>

                    {/* Tabs */}
                    <div className="flex p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
                        <button
                            onClick={() => setActiveTab('chat')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md font-bold text-sm transition-all ${activeTab === 'chat'
                                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                        >
                            <MessageSquare size={16} />
                            Live Chat
                        </button>
                        <button
                            onClick={() => setActiveTab('tickets')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md font-bold text-sm transition-all ${activeTab === 'tickets'
                                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                        >
                            <Ticket size={16} />
                            Support Tickets
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                {activeTab === 'chat' ? (
                    /* LIVE CHAT VIEW */
                    <div className="h-full flex flex-col">
                        {/* Messages Container */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {loadingMessages ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center">
                                    <MessageSquare className="w-16 h-16 text-gray-300 mb-4" />
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No messages yet</h3>
                                    <p className="text-gray-500 dark:text-gray-400 max-w-md">
                                        Start a conversation with the Chttrix platform team. They'll respond as soon as possible.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {messages.map((msg, idx) => (
                                        <div
                                            key={idx}
                                            className={`flex ${msg.sender === user._id ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div
                                                className={`max-w-md px-4 py-3 rounded-2xl ${msg.sender === user._id
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
                                                    }`}
                                            >
                                                <p className="text-sm">{msg.content}</p>
                                                <p className={`text-xs mt-1 ${msg.sender === user._id ? 'text-indigo-200' : 'text-gray-500 dark:text-gray-400'}`}>
                                                    {new Date(msg.createdAt).toLocaleTimeString()}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </>
                            )}
                        </div>

                        {/* Message Input */}
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
                                    className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
                                />
                                <button
                                    type="submit"
                                    disabled={!newMessage.trim()}
                                    className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    <Send size={18} />
                                    Send
                                </button>
                            </form>
                        </div>
                    </div>
                ) : (
                    /* SUPPORT TICKETS VIEW */
                    <div className="h-full p-6 overflow-y-auto">
                        {/* Tickets Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search tickets..."
                                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
                                />
                            </div>
                            <button
                                onClick={() => setIsCreateTicketOpen(true)}
                                className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
                            >
                                <Ticket size={18} />
                                New Ticket
                            </button>
                        </div>

                        {/* Tickets List */}
                        {loadingTickets ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : tickets.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <Ticket className="w-16 h-16 text-gray-300 mb-4" />
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No tickets yet</h3>
                                <p className="text-gray-500 dark:text-gray-400 max-w-md mb-6">
                                    Create a support ticket and our team will get back to you shortly.
                                </p>
                                <button
                                    onClick={() => setIsCreateTicketOpen(true)}
                                    className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors"
                                >
                                    Create Your First Ticket
                                </button>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {tickets.map((ticket) => (
                                    <div
                                        key={ticket._id}
                                        onClick={() => setSelectedTicket(ticket)}
                                        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 hover:shadow-md transition-shadow cursor-pointer"
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1">
                                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                                                    {ticket.subject}
                                                </h3>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                                                    {ticket.description}
                                                </p>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(ticket.status)}`}>
                                                {ticket.status}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                                            <span className={`px-2 py-1 rounded-md font-bold ${getPriorityColor(ticket.priority)}`}>
                                                {ticket.priority}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock size={14} />
                                                {new Date(ticket.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Create Ticket Modal */}
            {isCreateTicketOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white">Create Support Ticket</h2>
                        </div>
                        <form onSubmit={handleCreateTicket} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Subject</label>
                                <input
                                    type="text"
                                    required
                                    value={newTicket.subject}
                                    onChange={(e) => setNewTicket(prev => ({ ...prev, subject: e.target.value }))}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
                                    placeholder="Brief description of your issue"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Priority</label>
                                <select
                                    value={newTicket.priority}
                                    onChange={(e) => setNewTicket(prev => ({ ...prev, priority: e.target.value }))}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
                                >
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                    <option value="critical">Critical</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Description</label>
                                <textarea
                                    required
                                    rows={6}
                                    value={newTicket.description}
                                    onChange={(e) => setNewTicket(prev => ({ ...prev, description: e.target.value }))}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white resize-none"
                                    placeholder="Provide detailed information about your issue..."
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateTicketOpen(false)}
                                    className="px-6 py-3 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors"
                                >
                                    Create Ticket
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ContactAdmin;
