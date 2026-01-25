import React, { useState, useEffect } from "react";
import api from "../../services/api";
import { useToast } from "../../contexts/ToastContext";
import { X, Search, Check, Info, Hash, ChevronRight, Globe, Lock, UserPlus } from 'lucide-react';

export default function CreateChannelModal({ onClose, onCreated, workspaceId }) {
    const { showToast } = useToast();
    const [currentTab, setCurrentTab] = useState(1);

    // Step 1: Details
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [visibility, setVisibility] = useState('public'); // 'public' or 'private'

    // Step 2: Members
    const [workspaceMembers, setWorkspaceMembers] = useState([]);
    const [selectedMemberIds, setSelectedMemberIds] = useState(new Set());
    const [searchQuery, setSearchQuery] = useState("");
    const [loadingMembers, setLoadingMembers] = useState(false);

    // Fetch workspace members when entering step 2
    useEffect(() => {
        const fetchMembers = async () => {
            setLoadingMembers(true);
            try {
                const res = await api.get(`/api/workspaces/${workspaceId}/all-members`);
                setWorkspaceMembers(res.data.members || []);
            } catch (err) {
                console.error("Failed to load members:", err);
                showToast("Failed to load workspace members", "error");
            } finally {
                setLoadingMembers(false);
            }
        };

        if (currentTab === 2 && workspaceId) {
            fetchMembers();
        }
    }, [currentTab, workspaceId, showToast]);

    const toggleMember = (id) => {
        const newSet = new Set(selectedMemberIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedMemberIds(newSet);
    };

    const handleNextTab = () => {
        if (!name.trim()) {
            showToast("Channel name is required", "error");
            return;
        }
        setCurrentTab(2);
    };

    const handleCreate = async () => {
        if (!name.trim()) {
            showToast("Channel name is required", "error");
            return;
        }

        // ✅ ENFORCE: Private channels MUST have at least 1 invited member
        if (visibility === 'private' && selectedMemberIds.size === 0) {
            showToast("Private channels require at least one invited member", "error");
            return;
        }

        try {
            const payload = {
                name: name.trim(),
                description,
                isPrivate: visibility === 'private',
                memberIds: Array.from(selectedMemberIds),
                workspaceId
            };

            const res = await api.post(`/api/workspaces/${workspaceId}/channels`, payload);
            const channel = res.data.channel;

            const channelType = visibility === 'private' ? 'Private' : 'Public';
            showToast(`${channelType} channel #${channel.name} created successfully!`);
            onCreated && onCreated(channel);
            onClose();
        } catch (err) {
            console.error("Create channel failed:", err);
            const errorMsg = err?.response?.data?.message || "Failed to create channel";
            showToast(errorMsg, "error");
        }
    };

    // Filter members
    const filteredMembers = workspaceMembers.filter(m =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.email && m.email.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    // Check if "Create Channel" should be enabled
    const canCreate = visibility === 'public' || (visibility === 'private' && selectedMemberIds.size > 0);

    return (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-md flex items-center justify-center z-[100] animate-in fade-in duration-200 p-6">
            <div
                className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col transform transition-all animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >

                {/* Header */}
                <div className="px-10 py-6 border-b border-gray-50 dark:border-gray-800 flex justify-between items-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-20">
                    <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                            <Hash size={24} strokeWidth={3} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white leading-tight tracking-tight">
                                Create Channel
                            </h3>
                            <p className="text-sm text-gray-400 dark:text-gray-500 font-medium mt-0.5">
                                Step {currentTab}/2: {currentTab === 1 ? "Setup" : "Members"}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all duration-200"
                    >
                        <X size={20} strokeWidth={2.5} />
                    </button>
                </div>

                {/* Progress Line */}
                <div className="relative h-1 bg-gray-50 dark:bg-gray-800 w-full overflow-hidden">
                    <div
                        className="absolute h-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)] transition-all duration-500 ease-out"
                        style={{ width: currentTab === 1 ? '50%' : '100%' }}
                    />
                </div>

                {/* Content Area */}
                <div className="flex-1 bg-white dark:bg-gray-900 p-10 min-h-[420px]">
                    {currentTab === 1 ? (
                        <div className="grid grid-cols-12 gap-12 h-full animate-in slide-in-from-left-4 fade-in duration-300">

                            {/* LEFT COLUMN: Inputs (7 cols) */}
                            <div className="col-span-12 md:col-span-7 space-y-8">
                                {/* Name Input */}
                                <div className="group space-y-3">
                                    <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest pl-1">
                                        Channel Name
                                    </label>
                                    <div className="relative transform transition-all duration-200 focus-within:scale-[1.01]">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-600 group-focus-within:text-blue-500 transition-colors">
                                            <Hash size={22} strokeWidth={2.5} />
                                        </div>
                                        <input
                                            value={name}
                                            onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                                            className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 text-lg font-bold text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-gray-600 transition-all shadow-inner"
                                            placeholder="project-name"
                                            autoFocus
                                        />
                                    </div>
                                    <p className="text-xs text-gray-400 pl-1 font-medium flex items-center gap-1">
                                        <Info size={12} />
                                        Lowercase, spaces become hyphens
                                    </p>
                                </div>

                                {/* Description Input */}
                                <div className="group space-y-3">
                                    <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest pl-1">
                                        Description <span className="normal-case font-normal text-gray-300 ml-1 opacity-70">(Optional)</span>
                                    </label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 text-sm font-medium text-gray-700 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-600 resize-none leading-relaxed transition-all shadow-inner"
                                        placeholder="What is this channel about?"
                                        rows={4}
                                    />
                                </div>
                            </div>

                            {/* RIGHT COLUMN: Visibility (5 cols) */}
                            <div className="col-span-12 md:col-span-5 flex flex-col gap-5">
                                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-1">
                                    Channel Visibility
                                </label>

                                {/* Public Channel */}
                                <div
                                    onClick={() => setVisibility('public')}
                                    className={`relative p-5 rounded-2xl cursor-pointer transition-all duration-300 ${visibility === 'public'
                                        ? 'bg-gradient-to-br from-blue-600 to-blue-700 shadow-xl shadow-blue-500/20 transform scale-[1.02]'
                                        : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                                        }`}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className={`p-2.5 rounded-xl transition-colors ${visibility === 'public' ? 'bg-white/20 text-white' : 'bg-white dark:bg-gray-700 text-gray-400 dark:text-gray-400 shadow-sm'}`}>
                                            <Globe size={20} strokeWidth={2.5} />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className={`text-[15px] font-bold mb-0.5 ${visibility === 'public' ? 'text-white' : 'text-gray-900 dark:text-white'}`}>Public</h4>
                                            <p className={`text-xs font-medium leading-relaxed ${visibility === 'public' ? 'text-blue-100' : 'text-gray-400 dark:text-gray-500'}`}>
                                                Anyone in workspace can discover and join.
                                            </p>
                                        </div>
                                        {visibility === 'public' && <div className="w-5 h-5 bg-white text-blue-600 rounded-full flex items-center justify-center shadow-sm"><Check size={12} strokeWidth={4} /></div>}
                                    </div>
                                </div>

                                {/* Private Channel */}
                                <div
                                    onClick={() => setVisibility('private')}
                                    className={`relative p-5 rounded-2xl cursor-pointer transition-all duration-300 ${visibility === 'private'
                                        ? 'bg-gray-900 dark:bg-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-none text-white transform scale-[1.02]'
                                        : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                                        }`}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className={`p-2.5 rounded-xl transition-colors ${visibility === 'private' ? 'bg-white/20 text-white' : 'bg-white dark:bg-gray-700 text-gray-400 dark:text-gray-400 shadow-sm'}`}>
                                            <Lock size={20} strokeWidth={2.5} />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className={`text-[15px] font-bold mb-0.5 ${visibility === 'private' ? 'text-white' : 'text-gray-900 dark:text-white'}`}>Private</h4>
                                            <p className={`text-xs font-medium leading-relaxed ${visibility === 'private' ? 'text-gray-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                                Only invited members can access.
                                            </p>
                                        </div>
                                        {visibility === 'private' && <div className="w-5 h-5 bg-white text-gray-900 rounded-full flex items-center justify-center shadow-sm"><Check size={12} strokeWidth={4} /></div>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col animate-in slide-in-from-right-8 fade-in duration-300">
                            {/* Member Selection Header */}
                            <div className="mb-6">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                                    {visibility === 'private' ? 'Invite Members' : 'Invite Members (Optional)'}
                                </h3>
                                {visibility === 'private' && (
                                    <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">
                                        ⚠️ Private channels require at least one invited member for encryption setup.
                                    </p>
                                )}
                            </div>

                            {/* Member Search Header */}
                            <div className="flex items-center gap-4 mb-8">
                                <div className="flex-1 relative group">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={20} strokeWidth={2.5} />
                                    <input
                                        type="text"
                                        placeholder="Search people..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-gray-800/50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 outline-none transition-all font-semibold text-gray-900 dark:text-white placeholder-gray-400 shadow-inner"
                                        autoFocus
                                    />
                                </div>
                                <div className="bg-blue-50 dark:bg-blue-900/20 px-5 py-3.5 rounded-2xl text-xs font-bold text-blue-600 dark:text-blue-300 whitespace-nowrap">
                                    {selectedMemberIds.size} Selected
                                </div>
                            </div>

                            {/* Grid List for Members */}
                            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar -mr-4">
                                <div className="grid grid-cols-2 gap-4">
                                    {loadingMembers ? (
                                        <div className="col-span-2 flex flex-col items-center justify-center py-20 text-gray-400 space-y-4">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                            <span className="text-xs font-semibold uppercase tracking-wide">Fetching members...</span>
                                        </div>
                                    ) : filteredMembers.length === 0 ? (
                                        <div className="col-span-2 text-center py-20 text-gray-400 flex flex-col items-center gap-3">
                                            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-2xl flex items-center justify-center text-gray-300">
                                                <Search size={32} />
                                            </div>
                                            <div className="text-sm font-medium">No members found matching "{searchQuery}"</div>
                                        </div>
                                    ) : (
                                        filteredMembers.map(user => {
                                            const isSelected = selectedMemberIds.has(user.id);
                                            return (
                                                <div
                                                    key={user.id}
                                                    onClick={() => toggleMember(user.id)}
                                                    className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all duration-200 ${isSelected
                                                        ? "bg-blue-600 shadow-lg shadow-blue-500/20 transform scale-[1.01]"
                                                        : "bg-gray-50 dark:bg-gray-800 hover:bg-white dark:hover:bg-gray-700/80 hover:shadow-md"
                                                        }`}
                                                >
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-sm ${isSelected
                                                        ? "bg-white/20 text-white"
                                                        : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 shadow-sm"
                                                        }`}>
                                                        {user.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className={`text-sm font-bold truncate ${isSelected ? "text-white" : "text-gray-900 dark:text-white"}`}>
                                                            {user.name}
                                                        </div>
                                                        <div className={`text-xs truncate font-medium ${isSelected ? "text-blue-100" : "text-gray-400"}`}>{user.email}</div>
                                                    </div>
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${isSelected
                                                        ? "bg-white text-blue-600 shadow-sm"
                                                        : "border-2 border-gray-200 dark:border-gray-700"
                                                        }`}>
                                                        {isSelected && <Check size={14} strokeWidth={4} />}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-10 py-6 bg-white dark:bg-gray-900 border-t border-gray-50 dark:border-gray-800 flex justify-between items-center sticky bottom-0 z-20">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                    >
                        Cancel
                    </button>

                    <div className="flex items-center gap-4">
                        {currentTab === 2 && (
                            <button
                                onClick={() => setCurrentTab(1)}
                                className="px-6 py-3 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-colors"
                            >
                                Back
                            </button>
                        )}

                        {currentTab === 1 ? (
                            <button
                                onClick={handleNextTab}
                                disabled={!name.trim()}
                                className={`flex items-center gap-2 px-8 py-3.5 text-sm font-bold text-white rounded-xl shadow-lg transition-all duration-300 transform ${!name.trim()
                                    ? "bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed shadow-none"
                                    : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/30 hover:shadow-blue-500/40 hover:-translate-y-0.5"
                                    }`}
                            >
                                Next Step
                                <ChevronRight size={16} strokeWidth={3} />
                            </button>
                        ) : (
                            <button
                                onClick={handleCreate}
                                disabled={!canCreate}
                                className={`flex items-center gap-2 px-8 py-3.5 text-sm font-bold text-white rounded-xl shadow-lg transition-all duration-300 transform ${!canCreate
                                    ? "bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed shadow-none"
                                    : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/30 hover:shadow-blue-500/40 hover:-translate-y-0.5"
                                    }`}
                            >
                                <UserPlus size={18} strokeWidth={2.5} />
                                Create Channel
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
