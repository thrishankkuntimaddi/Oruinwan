import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { Send, Search, Circle, MessageSquare, ArrowLeft } from 'lucide-react';
import { useToast } from '../../../../contexts/ToastContext';

const PlatformChat = () => {
    const { companyId } = useParams();
    const [companies, setCompanies] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const messagesEndRef = useRef(null);
    const { showToast } = useToast();

    // Define functions before useEffects that use them
    const fetchCompanies = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/admin/active-companies`, {
                withCredentials: true
            });
            setCompanies(res.data);
        } catch (err) {
            console.error('Failed to fetch companies:', err);
        }
    };

    const fetchMessages = useCallback(async (compId) => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/admin/dm/${compId}`, {
                withCredentials: true
            });
            setMessages(res.data);
        } catch (err) {
            console.error('Failed to fetch messages:', err);
            showToast('Failed to load messages', 'error');
        }
    }, [showToast]);

    useEffect(() => {
        fetchCompanies();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (companyId && companies.length > 0) {
            const company = companies.find(c => c._id === companyId);
            if (company) {
                setSelectedCompany(company);
                fetchMessages(companyId);
            }
        }
    }, [companyId, companies, fetchMessages]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() || !selectedCompany) return;

        try {
            const res = await axios.post(
                `${import.meta.env.VITE_BACKEND_URL}/api/admin/dm/${selectedCompany._id}`,
                { message: input },
                { withCredentials: true }
            );
            setMessages(prev => [...prev, res.data]);
            setInput('');
            scrollToBottom();
        } catch (err) {
            console.error('Failed to send message:', err);
            showToast('Failed to send message', 'error');
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const filteredCompanies = companies.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.domain?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="h-[calc(100vh-140px)] flex gap-6">
            {/* Companies List */}
            <div className={`${selectedCompany ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-col bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden`}>
                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                    <h2 className="text-xl font-black text-gray-900 dark:text-white mb-4">Company Chats</h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search companies..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900"
                        />
                    </div>
                </div>

                {/* Companies List */}
                <div className="flex-1 overflow-y-auto">
                    {filteredCompanies.map(company => (
                        <button
                            key={company._id}
                            onClick={() => {
                                setSelectedCompany(company);
                                fetchMessages(company._id);
                            }}
                            className={`w-full p-4 border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all text-left ${selectedCompany?._id === company._id
                                ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-l-indigo-600'
                                : 'border-l-4 border-l-transparent'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                                    {company.name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-gray-900 dark:text-white truncate">{company.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                        {company.domain || 'No domain'}
                                    </p>
                                </div>
                                {/* Online status indicator - can be enhanced with socket.io */}
                                <Circle size={8} className="text-green-500 fill-green-500" />
                            </div>
                        </button>
                    ))}
                    {filteredCompanies.length === 0 && (
                        <div className="p-8 text-center text-gray-400 text-sm">
                            No companies found
                        </div>
                    )}
                </div>
            </div>

            {/* Chat Window */}
            {selectedCompany ? (
                <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                    {/* Chat Header */}
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setSelectedCompany(null)}
                                className="md:hidden p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-lg">
                                {selectedCompany.name.charAt(0)}
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                                    {selectedCompany.name}
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {selectedCompany.admins[0]?.user?.username || 'Admin'}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-3 py-1 rounded-full font-bold">
                                <Circle size={6} className="fill-green-600" />
                                Online
                            </div>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/30 dark:bg-gray-900/20">
                        {messages.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-gray-400 flex-col gap-3">
                                <MessageSquare size={48} className="opacity-20" />
                                <p>No messages yet. Start the conversation!</p>
                            </div>
                        ) : (
                            messages.map((msg, index) => {
                                const isAdmin = msg.sender?.roles?.includes('chttrix_admin');
                                return (
                                    <div key={index} className={`flex gap-3 ${isAdmin ? 'flex-row-reverse' : ''}`}>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isAdmin
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                            }`}>
                                            {msg.sender?.username?.charAt(0) || 'U'}
                                        </div>
                                        <div className={`max-w-[70%] p-4 rounded-2xl ${isAdmin
                                            ? 'bg-indigo-600 text-white rounded-tr-none'
                                            : 'bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 text-gray-800 dark:text-gray-200 rounded-tl-none'
                                            }`}>
                                            <p className="text-sm">{msg.message || msg.text}</p>
                                            <p className={`text-[10px] mt-2 ${isAdmin ? 'text-indigo-200' : 'text-gray-400'
                                                }`}>
                                                {new Date(msg.createdAt).toLocaleTimeString([], {
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </p>
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
                                placeholder="Type a message..."
                                className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 text-gray-900 dark:text-white"
                            />
                            <button
                                type="submit"
                                disabled={!input.trim()}
                                className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </form>
                </div>
            ) : (
                <div className="hidden md:flex flex-1 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 items-center justify-center text-gray-400 flex-col gap-4">
                    <MessageSquare size={64} className="opacity-20" />
                    <p className="font-bold text-lg">Select a company to start chatting</p>
                    <p className="text-sm">Choose from the list on the left</p>
                </div>
            )}
        </div>
    );
};

export default PlatformChat;
