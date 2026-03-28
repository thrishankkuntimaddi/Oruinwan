import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Ticket, Send, Paperclip, Clock, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { useToast } from '../../contexts/ToastContext';
import api from '../../../services/api';
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
    // const [selectedTicket, setSelectedTicket] = useState(null); // Unused
    const [newTicket, setNewTicket] = useState({
        subject: '',
        priority: 'medium',
        description: ''
    });

    // Initialize Socket.io for real-time chat
    useEffect(() => {
        if (user && activeTab === 'chat') {
            socketRef.current = io(import.meta.env.VITE_BACKEND_URL);

            // Platform admin replies arrive via user-support:{userId} room
            // The server auto-joins every user to this room on connect — no manual join needed
            socketRef.current.on('platform-message', (message) => {
                setMessages(prev => {
                    const alreadyExists = prev.some(m => m._id === message._id);
                    return alreadyExists ? prev : [...prev, message];
                });
            });

            return () => {
                if (socketRef.current) {
                    socketRef.current.disconnect();
                }
            };
        }
    }, [user, activeTab]);

    const fetchMessages = useCallback(async (showLoading = true) => {
        if (!user) return;
        try {
            if (showLoading) setLoadingMessages(true);
            // Fetch only MY messages — each user has their own 1:1 with platform admin
            const response = await api.get(
                `/api/platform/support/messages/me`
            );
            setMessages(response.data.messages || []);
        } catch (error) {
            console.error('Error fetching messages:', error);
        } finally {
            setLoadingMessages(false);
        }
    }, [company?._id, showToast]);

    const fetchTickets = useCallback(async () => {
        if (!company?._id) return;
        try {
            setLoadingTickets(true);
            const response = await api.get(
                `/api/platform/support/tickets/${company._id}`
            );
            setTickets(response.data.tickets || []);
        } catch (error) {
            console.error('Error fetching tickets:', error);
            showToast('Failed to load tickets', 'error');
        } finally {
            setLoadingTickets(false);
        }
    }, [company?._id, showToast]);

    // Fetch MY messages + poll every 10s as real-time fallback
    useEffect(() => {
        if (activeTab === 'chat' && user) {
            fetchMessages(true);
            const interval = setInterval(() => fetchMessages(false), 10000);
            return () => clearInterval(interval);
        }
    }, [activeTab, user, fetchMessages]);


    // Fetch tickets
    useEffect(() => {
        if (activeTab === 'tickets' && company?._id) {
            fetchTickets();
        }
    }, [activeTab, company?._id, fetchTickets]);

    // Auto-scroll to bottom of chat
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        try {
            const response = await api.post(
                `/api/platform/support/messages`,
                {
                    companyId: company._id,
                    content: newMessage
                }
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
            const response = await api.post(
                `/api/platform/support/tickets`,
                {
                    companyId: company._id,
                    ...newTicket
                }
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
        <div className="h-full bg-gray-50 dark:bg-gray-900 overflow-hidden flex flex-col transition-colors duration-200">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-8 py-6 flex-shrink-0">
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
            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'chat' ? (
                    /* LIVE CHAT VIEW */
                    <div className="h-full flex flex-col">
                        {/* Messages Container */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                            {loadingMessages ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center pb-20 opacity-0 animate-fadeIn" style={{ animationFillMode: 'forwards' }}>
                                    <div className="p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-full mb-6 relative">
                                        <MessageSquare className="w-12 h-12 text-indigo-600 dark:text-indigo-400" />
                                        <div className="absolute top-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-gray-900 animate-pulse"></div>
                                    </div>
                                    <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">How can we help?</h3>
                                    <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
                                        Start a conversation with the Chttrix platform team. Our experts typically respond within minutes.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {messages.map((msg, idx) => {
                                        // senderRole: 'company' = owner sent it  |  'platform' = admin reply
                                        const isOwn = msg.senderRole === 'company';
                                        const isAdminReply = msg.senderRole === 'platform';
                                        return (
                                            <div
                                                key={msg._id || idx}
                                                className={`flex ${isOwn ? 'justify-end' : 'justify-start'} animate-slideIn`}
                                            >
                                                {!isOwn && (
                                                    <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0 self-end">
                                                        C
                                                    </div>
                                                )}
                                                <div
                                                    className={`max-w-md px-5 py-3.5 rounded-2xl shadow-sm ${isOwn
                                                        ? 'bg-indigo-600 text-white rounded-br-none'
                                                        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-bl-none'
                                                        }`}
                                                >
                                                    {isAdminReply && (
                                                        <p className="text-[10px] font-bold text-indigo-500 dark:text-indigo-300 mb-1 uppercase tracking-wide">Chttrix Support</p>
                                                    )}
                                                    <p className="text-sm leading-relaxed">{msg.content}</p>
                                                    <p className={`text-[10px] mt-1.5 font-medium ${isOwn ? 'text-indigo-200' : 'text-gray-400 dark:text-gray-500'}`}>
                                                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                        <div className="relative z-10 p-6 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] dark:shadow-none transition-colors">
                            <form onSubmit={handleSendMessage} className="flex gap-3 max-w-5xl mx-auto">
                                <button
                                    type="button"
                                    className="p-3.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all duration-200"
                                    title="Attach File"
                                >
                                    <Paperclip size={20} />
                                </button>
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type your message..."
                                    className="flex-1 px-5 py-3.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all shadow-sm"
                                />
                                <button
                                    type="submit"
                                    disabled={!newMessage.trim()}
                                    className="px-8 py-3.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center gap-2.5"
                                >
                                    <Send size={18} />
                                    <span>Send</span>
                                </button>
                            </form>
                        </div>
                    </div>
                ) : (
                    /* SUPPORT TICKETS VIEW */
                    <div className="h-full p-8 overflow-y-auto custom-scrollbar">
                        <div className="max-w-5xl mx-auto">
                            {/* Tickets Header */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                                <div className="relative flex-1 max-w-md">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Search tickets..."
                                        className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 dark:text-white transition-all shadow-sm"
                                    />
                                </div>
                                <button
                                    onClick={() => setIsCreateTicketOpen(true)}
                                    className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                                >
                                    <Ticket size={18} />
                                    New Ticket
                                </button>
                            </div>

                            {/* Tickets List */}
                            {loadingTickets ? (
                                <div className="flex items-center justify-center py-20">
                                    <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : tickets.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-12">
                                    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-full mb-4">
                                        <Ticket className="w-10 h-10 text-gray-400 dark:text-gray-500" />
                                    </div>
                                    <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">No tickets yet</h3>
                                    <p className="text-gray-500 dark:text-gray-400 max-w-md mb-8">
                                        Create a support ticket and our team will get back to you shortly.
                                    </p>
                                    <button
                                        onClick={() => setIsCreateTicketOpen(true)}
                                        className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-md"
                                    >
                                        Create Your First Ticket
                                    </button>
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {tickets.map((ticket) => (
                                        <div
                                            key={ticket._id}
                                            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 hover:shadow-lg dark:hover:shadow-gray-900/30 hover:border-indigo-200 dark:hover:border-indigo-900 transition-all cursor-default group"
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex-1 pr-4">
                                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                        {ticket.subject}
                                                    </h3>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                                                        {ticket.description}
                                                    </p>
                                                </div>
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold border capitalize ${getStatusColor(ticket.status)}`}>
                                                    {ticket.status}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-4 mt-2">
                                                <span className={`px-2 py-0.5 rounded uppercase text-[10px] font-black tracking-wider ${getPriorityColor(ticket.priority)}`}>
                                                    {ticket.priority}
                                                </span>
                                                <span className="flex items-center gap-1 font-medium">
                                                    <Clock size={14} className="text-gray-400" />
                                                    {new Date(ticket.createdAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Create Ticket Modal */}
            {isCreateTicketOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl animate-scaleIn">
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
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
                                    placeholder="Brief description of your issue"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Priority</label>
                                <select
                                    value={newTicket.priority}
                                    onChange={(e) => setNewTicket(prev => ({ ...prev, priority: e.target.value }))}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
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
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white resize-none"
                                    placeholder="Provide detailed information about your issue..."
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700 mt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateTicketOpen(false)}
                                    className="px-6 py-3 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-md"
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
