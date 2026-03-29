import React, { useState, useEffect } from 'react';
import api from '@services/api';
import { MessageCircle, X } from 'lucide-react';
import { useToast } from '../../../../contexts/ToastContext';

const SupportTickets = ({ navigateToChat }) => {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [reply, setReply] = useState("");
    const { showToast } = useToast();

    useEffect(() => {
        fetchTickets();
    }, []);

    const fetchTickets = async () => {
        try {
            const res = await api.get(`/api/admin/tickets`);
            setTickets(res.data);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (status) => {
        if (!selectedTicket) return;
        try {
            const res = await api.put(`/api/admin/tickets/${selectedTicket._id}`, { status });
            setTickets(prev => prev.map(t => t._id === selectedTicket._id ? res.data : t));
            setSelectedTicket(res.data);
            showToast(`Status updated to ${status}`, "success");
        } catch (err) {
            showToast("Failed to update status", "error");
        }
    };

    const handleReply = async () => {
        if (!reply.trim() || !selectedTicket) return;
        try {
            const res = await api.put(`/api/admin/tickets/${selectedTicket._id}`, { message: reply });
            setTickets(prev => prev.map(t => t._id === selectedTicket._id ? res.data : t));
            setSelectedTicket(res.data);
            setReply("");
            showToast("Reply sent", "success");
        } catch (err) {
            showToast("Failed to reply", "error");
        }
    };

    const StatusBadge = ({ status }) => {
        const styles = {
            open: "bg-blue-50 text-blue-600",
            "in-progress": "bg-yellow-50 text-yellow-600",
            resolved: "bg-green-50 text-green-600",
            closed: "bg-gray-100 text-gray-500"
        };
        return (
            <span className={`px-2 py-1 rounded-lg text-xs font-bold uppercase ${styles[status] || styles.closed}`}>
                {status}
            </span>
        );
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading tickets...</div>;

    return (
        <div className="h-[calc(100vh-140px)] flex gap-6">
            {/* Ticket List */}
            <div className={`flex-1 flex flex-col bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors ${selectedTicket ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-black text-gray-900 dark:text-white">Support Tickets</h2>
                    <span className="text-xs font-bold bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full text-gray-500 dark:text-gray-300">{tickets.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {tickets.map(ticket => (
                        <div
                            key={ticket._id}
                            onClick={() => setSelectedTicket(ticket)}
                            className={`p-4 border-b border-gray-50 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all ${selectedTicket?._id === ticket._id ? 'bg-indigo-50/50 dark:bg-indigo-900/10 border-l-4 border-l-indigo-500' : 'border-l-4 border-l-transparent'}`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${ticket.priority === 'critical' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                                    {ticket.priority}
                                </span>
                                <span className="text-xs text-gray-400">{new Date(ticket.createdAt).toLocaleDateString()}</span>
                            </div>
                            <h3 className="font-bold text-gray-900 dark:text-white mb-1 truncate">{ticket.subject}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate mb-2">{ticket.description}</p>
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-medium text-gray-400">{ticket.companyId?.name}</span>
                                <StatusBadge status={ticket.status} />
                            </div>
                        </div>
                    ))}
                    {tickets.length === 0 && (
                        <div className="p-8 text-center text-gray-400 text-sm">No tickets found</div>
                    )}
                </div>
            </div>

            {/* Ticket Detail */}
            {selectedTicket ? (
                <div className="flex-[2] bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col overflow-hidden transition-colors">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-start bg-gray-50/50 dark:bg-gray-700/30">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <StatusBadge status={selectedTicket.status} />
                                <span className="text-xs text-gray-400">ID: {selectedTicket._id.slice(-6)}</span>
                            </div>
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-1">{selectedTicket.subject}</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                From <span className="font-bold text-gray-900 dark:text-gray-200">{selectedTicket.creatorId?.username}</span> ({selectedTicket.companyId?.name})
                            </p>
                        </div>
                        <button onClick={() => setSelectedTicket(null)} className="md:hidden p-2 bg-gray-200 dark:bg-gray-600 rounded-full"><X size={16} /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/30 dark:bg-gray-800">
                        {/* Original Description */}
                        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                            <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Issue Description</h4>
                            <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{selectedTicket.description}</p>
                        </div>

                        {/* Thread */}
                        {selectedTicket.messages.map((msg, i) => (
                            <div key={i} className={`flex gap-4 ${msg.sender?._id !== selectedTicket.creatorId?._id ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${msg.sender?._id !== selectedTicket.creatorId?._id ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                                    {msg.sender?.username?.charAt(0) || '?'}
                                </div>
                                <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${msg.sender?._id !== selectedTicket.creatorId?._id ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 text-gray-800 dark:text-gray-200'}`}>
                                    <p>{msg.message}</p>
                                    <p className={`text-[10px] mt-2 opacity-60 ${msg.sender?._id !== selectedTicket.creatorId?._id ? 'text-indigo-100' : 'text-gray-400'}`}>
                                        {new Date(msg.createdAt).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
                        <div className="flex gap-2 mb-4">
                            {['open', 'in-progress', 'resolved'].map(s => (
                                <button
                                    key={s}
                                    onClick={() => handleUpdateStatus(s)}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold border ${selectedTicket.status === s ? 'bg-gray-900 dark:bg-indigo-600 text-white border-gray-900 dark:border-indigo-600' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-gray-400'}`}
                                >
                                    Mark {s}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <textarea
                                className="flex-1 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 resize-none h-20"
                                placeholder="Type a reply..."
                                value={reply}
                                onChange={e => setReply(e.target.value)}
                            />
                            <button
                                onClick={handleReply}
                                className="px-6 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                            >
                                Send
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="hidden md:flex flex-[2] bg-gray-50 dark:bg-gray-800/50 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700 items-center justify-center text-gray-400 flex-col gap-4">
                    <MessageCircle size={48} className="opacity-20" />
                    <p className="font-medium">Select a ticket to view details</p>
                </div>
            )}
        </div>
    );
};

export default SupportTickets;
