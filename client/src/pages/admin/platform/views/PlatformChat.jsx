import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Send, User } from 'lucide-react';

const PlatformChat = ({ targetCompanyId }) => {
    // If targetCompanyId is provided, we load that session.
    // Otherwise, we might list sessions (Future enhancement).
    // For now, let's assume this view loads a specific session passed by parent or selects first available.

    const [session, setSession] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (targetCompanyId) {
            fetchSession(targetCompanyId);
        }
    }, [targetCompanyId]);

    const fetchSession = async (companyId) => {
        try {
            const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/admin/chat/session/${companyId}`, { withCredentials: true });
            setSession(res.data);
            fetchMessages(res.data._id);
        } catch (err) {
            console.error("Failed to load chat session", err);
        }
    };

    const fetchMessages = async (sessionId) => {
        try {
            const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/admin/chat/session/${sessionId}/messages`, { withCredentials: true });
            setMessages(res.data);
            scrollToBottom();
        } catch (err) {
            console.error(err);
        }
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() || !session) return;

        try {
            const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/admin/chat/session/${session._id}/messages`, { text: input }, { withCredentials: true });
            setMessages(prev => [...prev, res.data]);
            setInput("");
            scrollToBottom();
        } catch (err) {
            console.error("Failed to send", err);
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    if (!targetCompanyId) return (
        <div className="h-full flex items-center justify-center text-gray-400">
            Select an active company to start chatting.
        </div>
    );

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex justify-between items-center">
                <h3 className="font-bold text-gray-900 dark:text-white">Admin Chat</h3>
                <span className="text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full font-bold">Secure Line</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30 dark:bg-gray-800/50">
                {messages.map(msg => (
                    <div key={msg._id} className={`flex gap-3 ${msg.sender?.roles?.includes('chttrix_admin') ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                            ${msg.sender?.roles?.includes('chttrix_admin') ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300'}`}>
                            {msg.sender?.username?.charAt(0)}
                        </div>
                        <div className={`max-w-[70%] p-3 rounded-2xl text-sm 
                            ${msg.sender?.roles?.includes('chttrix_admin') ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 text-gray-800 dark:text-gray-200 rounded-tl-none'}`}>
                            <p>{msg.text}</p>
                            <p className={`text-[10px] mt-1 text-right ${msg.sender?.roles?.includes('chttrix_admin') ? 'text-indigo-200' : 'text-gray-400'}`}>
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 flex gap-2">
                <input
                    type="text"
                    className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-700 border-transparent focus:bg-white dark:focus:bg-gray-900 border focus:border-indigo-100 dark:focus:border-indigo-900 rounded-xl focus:outline-none transition-colors text-gray-900 dark:text-white"
                    placeholder="Type a message..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                />
                <button type="submit" className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors">
                    <Send size={20} />
                </button>
            </form>
        </div>
    );
};

export default PlatformChat;
