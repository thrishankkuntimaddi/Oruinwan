import React, { useState, useEffect } from "react";
import api from "../../services/api";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import conversationKeyService from "../../services/conversationKeyService";
import { X, Search, Check, AlertCircle, Info, Lock, Hash } from 'lucide-react';

export default function CreateChannelModal({ onClose, onCreated, workspaceId }) {
    const { showToast } = useToast();
    const { user } = useAuth(); // ✅ Correction #1: Hook at top level
    const [step, setStep] = useState(1);

    // Step 1: Details
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [isPrivate, setIsPrivate] = useState(false);

    // Step 2: Members
    const [workspaceMembers, setWorkspaceMembers] = useState([]);
    const [selectedMemberIds, setSelectedMemberIds] = useState(new Set());
    const [searchQuery, setSearchQuery] = useState("");
    const [loadingMembers, setLoadingMembers] = useState(false);

    // Fetch workspace members when entering step 2
    useEffect(() => {
        if (step === 2 && workspaceId) {
            fetchMembers();
        }
    }, [step, workspaceId]);

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
        if (selectedMemberIds.size < 2) {
            showToast("Please add at least 2 members to create a channel (minimum 3 people total including you).", "error");
            return;
        }

        try {
            const payload = {
                workspaceId,
                name: name.trim(),
                description,
                isPrivate,
                memberIds: Array.from(selectedMemberIds)
            };

            const res = await api.post("/api/chat/channel/create", payload);
            const channel = res.data.channel;

            // ============ E2EE: GENERATE CONVERSATION KEY ============
            // ✅ Correction #2: Idempotent - Check if keys already exist
            // ✅ Correction #3: Non-blocking - Don't fail channel creation if E2EE fails
            try {
                console.log('🔐 [E2EE] Generating conversation key for channel:', channel._id);

                // Check if conversation keys already exist (idempotency)
                const keysExistResponse = await fetch(
                    `/api/v2/conversations/${channel._id}/keys/exists?type=channel`,
                    { credentials: 'include' }
                );
                const { exists } = await keysExistResponse.json();

                if (exists) {
                    console.log('✅ [E2EE] Conversation keys already exist, skipping generation');
                } else {
                    // All participants: current user + selected members
                    const allParticipantIds = [
                        user?.sub || user?._id,
                        ...Array.from(selectedMemberIds)
                    ];

                    console.log('🔐 [E2EE] Generating keys for', allParticipantIds.length, 'participants');

                    // Generate and encrypt conversation key for all participants
                    const { conversationKey, encryptedKeys, workspaceEncryptedKey, workspaceKeyIv, workspaceKeyAuthTag } =
                        await conversationKeyService.createAndDistributeConversationKey(allParticipantIds, workspaceId);

                    // Store encrypted keys on server
                    await conversationKeyService.storeConversationKeysOnServer(
                        channel._id,
                        'channel',
                        workspaceId,
                        encryptedKeys,
                        workspaceEncryptedKey,
                        workspaceKeyIv,
                        workspaceKeyAuthTag
                    );

                    console.log('✅ [E2EE] Channel created with end-to-end encryption');
                }
            } catch (e2eeError) {
                // ✅ NON-BLOCKING: Don't fail channel creation if E2EE fails
                console.error('⚠️ [E2EE] Failed to generate conversation keys (non-blocking):', e2eeError);
                console.error('⚠️ [E2EE] Channel created successfully, but messages may not be encrypted');
            }
            // ========================================================

            showToast(`Channel #${channel.name} created successfully!`);
            onCreated && onCreated(channel);
            onClose();
        } catch (err) {
            console.error("Create channel failed:", err);
            showToast(err?.response?.data?.message || "Create failed", "error");
        }
    };

    const filteredMembers = workspaceMembers.filter(m =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.email && m.email.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 leading-tight">
                            {step === 1 ? "Create a channel" : `Add members to #${name}`}
                        </h3>
                        {step === 2 && (
                            <p className="text-xs text-gray-500 mt-1">
                                Channels must have at least 3 members (you + 2 others)
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-gray-100 rounded-md text-gray-400 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                    {step === 1 ? (
                        <div className="space-y-6">
                            {/* Name Input */}
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                                    Name
                                </label>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                                        <Hash size={16} />
                                    </div>
                                    <input
                                        value={name}
                                        onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-medium text-gray-900 placeholder-gray-400"
                                        placeholder="e.g. project-x"
                                        autoFocus
                                    />
                                </div>
                                <p className="text-[12px] text-gray-400 mt-2">
                                    Names must be lowercase, without spaces or periods.
                                </p>
                            </div>

                            {/* Description Input */}
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                                    Description <span className="text-gray-300 font-normal normal-case">(Optional)</span>
                                </label>
                                <input
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-gray-900 placeholder-gray-400"
                                    placeholder="What's this channel about?"
                                />
                            </div>

                            {/* Privacy Toggle */}
                            <div
                                className={`flex items-start gap-4 p-5 rounded-2xl border transition-all cursor-pointer ${isPrivate ? "border-blue-200 bg-blue-50/30" : "border-gray-200 bg-gray-50/50 hover:bg-gray-50"}`}
                                onClick={() => setIsPrivate(!isPrivate)}
                            >
                                <div className={`mt-1 w-10 h-5 rounded-full p-1 transition-colors relative ${isPrivate ? "bg-blue-600" : "bg-gray-300"}`}>
                                    <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${isPrivate ? "translate-x-5" : "translate-x-0"}`} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 font-bold text-gray-900 text-sm mb-0.5">
                                        Make Private
                                        {isPrivate && <Lock size={12} className="text-blue-600" />}
                                    </div>
                                    <p className="text-xs text-gray-500 leading-relaxed">
                                        {isPrivate
                                            ? "Only invited members can view or join this channel."
                                            : "Anyone in this workspace can view and join this channel."}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 h-full flex flex-col">
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search workspace members..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm"
                                />
                            </div>

                            {/* List */}
                            <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-0.5">
                                {loadingMembers ? (
                                    <div className="flex flex-col items-center justify-center py-10 text-gray-400 space-y-3">
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                                        <span className="text-xs">Loading members...</span>
                                    </div>
                                ) : filteredMembers.length === 0 ? (
                                    <div className="text-center py-10 text-gray-400 text-xs">No members found in this workspace</div>
                                ) : (
                                    filteredMembers.map(user => {
                                        const isSelected = selectedMemberIds.has(user.id);
                                        return (
                                            <div
                                                key={user.id}
                                                onClick={() => toggleMember(user.id)}
                                                className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all group ${isSelected ? "bg-blue-50/50" : "hover:bg-gray-50"}`}
                                            >
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${isSelected ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500 group-hover:bg-gray-200"}`}>
                                                    {user.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className={`text-sm font-medium truncate ${isSelected ? "text-blue-900" : "text-gray-900"}`}>{user.name}</div>
                                                    <div className="text-[11px] text-gray-400 truncate">{user.email}</div>
                                                </div>
                                                {isSelected ? (
                                                    <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white scale-110">
                                                        <Check size={12} strokeWidth={3} />
                                                    </div>
                                                ) : (
                                                    <div className="w-5 h-5 rounded-full border border-gray-200 group-hover:border-gray-300" />
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
                <div className="px-8 py-5 bg-gray-50/80 border-t border-gray-100 flex justify-between items-center sticky bottom-0 z-10">
                    <div className="flex items-center text-[11px] text-gray-400">
                        {step === 2 && (
                            <div className="flex items-center gap-1.5">
                                <Info size={12} />
                                <span className={selectedMemberIds.size >= 2 ? "text-green-600 font-medium" : ""}>
                                    {selectedMemberIds.size}/2 required members added
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2">
                        {step === 1 ? (
                            <>
                                <button
                                    onClick={onClose}
                                    className="px-5 py-2 text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleNext}
                                    className="px-6 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all"
                                >
                                    Next
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => setStep(1)}
                                    className="px-5 py-2 text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleCreate}
                                    disabled={selectedMemberIds.size < 2}
                                    className={`px-6 py-2 text-xs font-bold text-white rounded-lg transition-all ${selectedMemberIds.size < 2 ? "bg-gray-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 shadow-sm"}`}
                                >
                                    Create Channel
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
