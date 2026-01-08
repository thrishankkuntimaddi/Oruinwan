import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import { AuthContext } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { Search, X, Send, Users, Check } from "lucide-react";
import { API_BASE } from "../../services/api";

export default function BroadcastView() {
    const [users, setUsers] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const { accessToken } = useContext(AuthContext);
    const { showToast } = useToast();

    useEffect(() => {
        async function loadContacts() {
            try {
                const token = accessToken || localStorage.getItem("accessToken");
                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                const res = await axios.get(`${API_BASE}/api/chat/contacts`, { headers });
                setUsers(res.data.contacts || []);
                setLoading(false);
            } catch (err) {
                console.error("Failed to load contacts", err);
                setLoading(false);
            }
        }
        loadContacts();
    }, [accessToken]);

    const toggleUser = (u) => {
        if (selectedUsers.find(sel => sel._id === u._id)) {
            setSelectedUsers(selectedUsers.filter(sel => sel._id !== u._id));
        } else {
            setSelectedUsers([...selectedUsers, u]);
        }
    };

    const handleSend = async () => {
        if (selectedUsers.length === 0 || !message.trim()) return;
        setSending(true);

        // Simulate sending
        setTimeout(() => {
            showToast(`Broadcast sent to ${selectedUsers.length} recipients!`);
            setSending(false);
            setMessage("");
            setSelectedUsers([]);
        }, 1500);
    };

    const filteredUsers = users.filter(u =>
        u.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-xl text-blue-600">
                            <Users size={24} />
                        </div>
                        New Broadcast
                    </h1>
                    <p className="text-gray-500 mt-1 ml-14">Send updates to your team efficiently</p>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Left: Recipient Selection */}
                <div className="w-80 border-r border-gray-100 flex flex-col bg-gray-50/30">
                    <div className="p-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search people..."
                                className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-2 pb-2 custom-scrollbar">
                        {loading ? (
                            <div className="text-center py-8 text-gray-400">Loading contacts...</div>
                        ) : (
                            <div className="space-y-1">
                                {filteredUsers.map(u => {
                                    const isSelected = selectedUsers.find(sel => sel._id === u._id);
                                    return (
                                        <div
                                            key={u._id}
                                            onClick={() => toggleUser(u)}
                                            className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all border ${isSelected ? "bg-blue-50 border-blue-200 shadow-sm" : "hover:bg-white hover:shadow-sm border-transparent"}`}
                                        >
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${isSelected ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-600"}`}>
                                                {u.username.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className={`text-sm font-medium truncate ${isSelected ? "text-blue-900" : "text-gray-900"}`}>{u.username}</div>
                                            </div>
                                            {isSelected && <Check size={16} className="text-blue-600" />}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="p-3 border-t border-gray-100 bg-white text-xs font-medium text-gray-500 text-center">
                        {selectedUsers.length} recipients selected
                    </div>
                </div>

                {/* Right: Composer */}
                <div className="flex-1 flex flex-col bg-white">
                    <div className="flex-1 p-8">
                        <div className="max-w-3xl mx-auto w-full h-full flex flex-col">
                            <div className="mb-6">
                                <label className="block text-sm font-bold text-gray-700 mb-2">To:</label>
                                <div className="flex flex-wrap gap-2 p-2 min-h-[48px] border-b border-gray-100">
                                    {selectedUsers.length === 0 && <span className="text-gray-400 italic py-1">Select recipients from the list...</span>}
                                    {selectedUsers.map(u => (
                                        <span key={u._id} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full">
                                            {u.username}
                                            <button onClick={(e) => { e.stopPropagation(); toggleUser(u); }} className="hover:text-blue-900"><X size={14} /></button>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col">
                                <label className="block text-sm font-bold text-gray-700 mb-2">Message:</label>
                                <textarea
                                    className="flex-1 w-full bg-gray-50 border border-gray-200 rounded-2xl p-6 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-lg text-gray-800 placeholder-gray-400 leading-relaxed"
                                    placeholder="Type your broadcast message here..."
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                ></textarea>
                            </div>
                        </div>
                    </div>

                    <div className="px-8 py-6 border-t border-gray-100 flex justify-end bg-gray-50/30">
                        <button
                            onClick={handleSend}
                            disabled={selectedUsers.length === 0 || !message.trim() || sending}
                            className={`px-8 py-3 rounded-xl font-bold text-white shadow-lg flex items-center gap-2 transition-all
                ${selectedUsers.length === 0 || !message.trim() || sending
                                    ? "bg-gray-300 cursor-not-allowed shadow-none"
                                    : "bg-blue-600 hover:bg-blue-700 hover:scale-[1.02] active:scale-95 shadow-blue-500/30"}`}
                        >
                            {sending ? "Sending..." : <><Send size={18} /> Send Broadcast</>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
