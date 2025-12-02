import React, { useState, useEffect } from "react";
import axios from "axios";
import { useToast } from "../../contexts/ToastContext";
import { X, Hash, Lock, Search, Check, UserPlus } from "lucide-react";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function CreateChannelModal({ onClose, onCreated }) {
    const { showToast } = useToast();
    const [step, setStep] = useState(1);

    // Step 1: Details
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [isPrivate, setIsPrivate] = useState(false);

    // Step 2: Members
    const [contacts, setContacts] = useState([]);
    const [selectedMemberIds, setSelectedMemberIds] = useState(new Set());
    const [searchQuery, setSearchQuery] = useState("");
    const [loadingContacts, setLoadingContacts] = useState(false);

    // Fetch contacts when entering step 2
    useEffect(() => {
        if (step === 2) {
            fetchContacts();
        }
    }, [step]);

    const fetchContacts = async () => {
        setLoadingContacts(true);
        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.get(`${API_BASE}/api/chat/contacts`, { headers });
            setContacts(res.data.contacts || []);
        } catch (err) {
            console.error("Failed to load contacts:", err);
            showToast("Failed to load contacts", "error");
        } finally {
            setLoadingContacts(false);
        }
    };

    const handleNext = () => {
        if (!name.trim()) {
            showToast("Channel name is required", "error");
            return;
        }
        setStep(2);
    };

    const toggleMember = (id) => {
        const newSet = new Set(selectedMemberIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedMemberIds(newSet);
    };

    const handleCreate = async () => {
        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            const payload = {
                name,
                description,
                isPrivate,
                memberIds: Array.from(selectedMemberIds)
            };

            const res = await axios.post(`${API_BASE}/api/chat/channel/create`, payload, { headers });

            const channel = res.data.channel;
            showToast(`Channel #${channel.name} created successfully!`);
            onCreated && onCreated(channel);
            onClose();
        } catch (err) {
            console.error("Create channel failed:", err);
            showToast(err?.response?.data?.message || "Create failed", "error");
        }
    };

    const filteredContacts = contacts.filter(c =>
        c.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <h3 className="text-2xl font-bold text-gray-900">
                        {step === 1 ? "Create New Channel" : "Add Members"}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                    {step === 1 ? (
                        <div className="space-y-8">
                            {/* Name Input */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                                    Channel Name
                                </label>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                                        <Hash size={18} />
                                    </div>
                                    <input
                                        value={name}
                                        onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                                        className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium text-gray-900 placeholder-gray-400"
                                        placeholder="e.g. marketing-updates"
                                        autoFocus
                                    />
                                </div>
                                <p className="text-sm text-gray-500 mt-3 leading-relaxed">
                                    Channels are where your team communicates. They're best when organized around a topic.
                                </p>
                            </div>

                            {/* Description Input */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                                    Description <span className="text-gray-400 font-normal normal-case">(Optional)</span>
                                </label>
                                <input
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-gray-900 placeholder-gray-400"
                                    placeholder="What's this channel about?"
                                />
                            </div>

                            {/* Privacy Toggle */}
                            <div className="flex items-start gap-4 p-4 border border-gray-200 rounded-xl bg-gray-50/50 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setIsPrivate(!isPrivate)}>
                                <div className={`mt-1 w-11 h-6 rounded-full p-1 transition-colors relative ${isPrivate ? "bg-blue-600" : "bg-gray-300"}`}>
                                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${isPrivate ? "translate-x-5" : "translate-x-0"}`} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 font-bold text-gray-900 mb-1">
                                        Make Private
                                        {isPrivate && <Lock size={14} className="text-gray-500" />}
                                    </div>
                                    <p className="text-sm text-gray-500">
                                        {isPrivate
                                            ? "Only invited members can view and join this channel."
                                            : "Anyone in your workspace can view and join this channel."}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 h-full flex flex-col">
                            <p className="text-gray-500 text-sm">
                                Add people to <span className="font-bold text-gray-900">#{name}</span>. You can also add them later.
                            </p>

                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search by name..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                />
                            </div>

                            {/* List */}
                            <div className="flex-1 overflow-y-auto min-h-[200px] -mx-2 px-2 space-y-1">
                                {loadingContacts ? (
                                    <div className="text-center py-8 text-gray-400">Loading contacts...</div>
                                ) : filteredContacts.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400">No contacts found</div>
                                ) : (
                                    filteredContacts.map(user => {
                                        const isSelected = selectedMemberIds.has(user._id);
                                        return (
                                            <div
                                                key={user._id}
                                                onClick={() => toggleMember(user._id)}
                                                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${isSelected ? "bg-blue-50 border-blue-200" : "hover:bg-gray-50 border-transparent"}`}
                                            >
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${isSelected ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-600"}`}>
                                                    {user.username.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex-1">
                                                    <div className={`font-medium ${isSelected ? "text-blue-900" : "text-gray-900"}`}>{user.username}</div>
                                                    <div className="text-xs text-gray-500">{user.email}</div>
                                                </div>
                                                {isSelected ? (
                                                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white animate-scale-in">
                                                        <Check size={14} strokeWidth={3} />
                                                    </div>
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full border-2 border-gray-200 group-hover:border-gray-300" />
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 sticky bottom-0 z-10">
                    {step === 1 ? (
                        <>
                            <button
                                onClick={onClose}
                                className="px-6 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleNext}
                                className="px-8 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-500/30 transition-all transform active:scale-95"
                            >
                                Next
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => setStep(1)}
                                className="px-6 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleCreate}
                                className="px-8 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 flex items-center gap-2"
                            >
                                {selectedMemberIds.size > 0 ? `Create & Add ${selectedMemberIds.size}` : "Create Channel"}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
