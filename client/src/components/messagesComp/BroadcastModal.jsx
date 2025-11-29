import { useEffect, useState, useContext } from "react";
import axios from "axios";
import { AuthContext } from "../../contexts/AuthContext";
import { Search, X, Check, Send, Users } from "lucide-react";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function BroadcastModal({ onClose, onSendBroadcast }) {
    const [users, setUsers] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState(null);
    const { accessToken, user } = useContext(AuthContext);

    useEffect(() => {
        async function load() {
            try {
                const token = accessToken || localStorage.getItem("accessToken");
                if (!token && !user) {
                    setError("Please log in to continue");
                    setLoading(false);
                    return;
                }

                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                const res = await axios.get(`${API_BASE}/api/chat/contacts`, {
                    headers,
                    withCredentials: true
                });

                setUsers(res.data.contacts || []);
                setLoading(false);
            } catch (err) {
                console.error("Failed to load users:", err);
                setError("Failed to load contacts");
                setLoading(false);
            }
        }
        load();
    }, [accessToken, user]);

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
        try {
            // Pass selected users and message back to parent to handle sending
            // Or handle it here. For now, let's assume the parent handles the actual API calls 
            // or we can do it here if we have the logic.
            // Since the user asked to "work on the feature", I should probably implement the sending logic here or in a context.
            // However, sending to multiple people usually involves multiple API calls or a specific broadcast endpoint.
            // I'll pass it to the parent for now to keep UI separated from logic, or implement a loop here.

            await onSendBroadcast(selectedUsers, message);
            onClose();
        } catch (err) {
            setError("Failed to send broadcast");
            setSending(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center animate-fade-in backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-[90vw] max-w-5xl h-[85vh] flex flex-col overflow-hidden border border-gray-100">

                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <Users className="text-blue-600" size={24} />
                            New Broadcast
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">Send a message to multiple people at once</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-200 rounded-full">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">

                    {/* Left: Contact Selection */}
                    <div className="w-1/3 border-r border-gray-100 flex flex-col bg-white">
                        <div className="p-4 border-b border-gray-100">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search contacts..."
                                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                            {loading ? (
                                <div className="text-center py-8 text-gray-400">Loading...</div>
                            ) : error ? (
                                <div className="text-center py-8 text-red-500">{error}</div>
                            ) : (
                                <div className="space-y-1">
                                    {users.map(u => {
                                        const isSelected = selectedUsers.find(sel => sel._id === u._id);
                                        return (
                                            <div
                                                key={u._id}
                                                onClick={() => toggleUser(u)}
                                                className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all border ${isSelected ? "bg-blue-50 border-blue-200" : "hover:bg-gray-50 border-transparent"}`}
                                            >
                                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${isSelected ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600"}`}>
                                                    {u.username?.charAt(0).toUpperCase()}
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

                        <div className="p-3 border-t border-gray-100 bg-gray-50 text-xs font-medium text-gray-500 text-center">
                            {selectedUsers.length} recipients selected
                        </div>
                    </div>

                    {/* Right: Message Composition */}
                    <div className="flex-1 flex flex-col bg-gray-50/30">
                        <div className="flex-1 p-6 flex flex-col">
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Recipients:</label>
                                <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto custom-scrollbar">
                                    {selectedUsers.length === 0 && <span className="text-gray-400 text-sm italic">No recipients selected</span>}
                                    {selectedUsers.map(u => (
                                        <span key={u._id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-full shadow-sm">
                                            {u.username}
                                            <button onClick={() => toggleUser(u)} className="hover:text-red-500"><X size={12} /></button>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Your Message</label>
                            <textarea
                                className="flex-1 w-full bg-white border border-gray-200 rounded-xl p-5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-800 placeholder-gray-400 text-base leading-relaxed shadow-sm"
                                placeholder="Type your broadcast message here..."
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                            ></textarea>
                        </div>

                        <div className="p-6 border-t border-gray-100 bg-white flex justify-end">
                            <button
                                onClick={handleSend}
                                disabled={selectedUsers.length === 0 || !message.trim() || sending}
                                className={`px-8 py-3 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all
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
        </div>
    );
}
