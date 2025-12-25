import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Trash2, UserPlus, Users, Lock, Unlock, X, AlertTriangle, Eraser } from "lucide-react";
import { useToast } from "../../contexts/ToastContext";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function ChannelManagementModal({ channel, onClose, currentUserId, initialTab = "members" }) {
    const { workspaceId } = useParams();
    const { showToast } = useToast();
    const [members, setMembers] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState(initialTab); // members, settings
    const [privacyVerification, setPrivacyVerification] = useState("");
    const [deleteVerification, setDeleteVerification] = useState("");
    const [memberToRemove, setMemberToRemove] = useState(null);
    const [memberToPromote, setMemberToPromote] = useState(null);
    const [memberToDemote, setMemberToDemote] = useState(null);

    // Editing states
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState(channel.name || "");
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [editedDescription, setEditedDescription] = useState(channel.description || "");

    // Admin permission logic
    const isDefaultChannel = channel.isDefault || ['general', 'announcements'].includes(channel.name?.toLowerCase().replace(/^#/, ''));
    const isWorkspaceAdmin = channel.workspaceRole === 'owner' || channel.workspaceRole === 'admin';
    const isChannelCreator = String(channel.createdBy) === String(currentUserId);

    // Check if user is a promoted admin (in the admins array)
    const isPromotedAdmin = channel.admins && Array.isArray(channel.admins)
        ? channel.admins.some(adminId => String(adminId) === String(currentUserId))
        : false;

    // User is admin if: (for default channels) workspace admin, OR (for regular channels) creator OR promoted admin
    const isAdmin = isDefaultChannel ? isWorkspaceAdmin : (isChannelCreator || isPromotedAdmin);

    const loadMembers = useCallback(async () => {
        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.get(`${API_BASE}/api/channels/${channel.id}/members`, { headers });
            setMembers(res.data.members || []);
        } catch (err) {
            console.error("Load members failed:", err);
        }
    }, [channel.id]);

    const loadAllUsers = useCallback(async () => {
        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            // Fetch workspace members instead of all users
            const res = await axios.get(`${API_BASE}/api/workspaces/${channel.workspaceId}/members`, { headers });
            setAllUsers(res.data.members || []);
        } catch (err) {
            console.error("Load workspace members failed:", err);
        }
    }, [channel.workspaceId]);

    useEffect(() => {
        loadMembers();
        loadAllUsers();
    }, [loadMembers, loadAllUsers]);

    const handleInvite = async (userId) => {
        if (!userId) return;
        setLoading(true);
        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post(`${API_BASE}/api/channels/${channel.id}/invite`, { userId }, { headers });
            loadMembers();
        } catch (err) {
            console.error("Invite failed:", err);
            showToast(err?.response?.data?.message || "Invite failed", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async (userId) => {
        setMemberToRemove(userId);
    };

    const confirmRemove = async () => {
        if (!memberToRemove) return;

        setLoading(true);
        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            await axios.post(`${API_BASE}/api/channels/${channel.id}/remove-member`,
                { userId: memberToRemove },
                { headers }
            );

            showToast("Member removed successfully", "success");
            setMemberToRemove(null);
            loadMembers();
        } catch (err) {
            console.error("Remove failed:", err);
            showToast(err?.response?.data?.message || "Failed to remove member", "error");
        } finally {
            setLoading(false);
        }
    };

    const handlePromoteAdmin = async (userId) => {
        setMemberToPromote(userId);
    };

    const confirmPromote = async () => {
        if (!memberToPromote) return;

        setLoading(true);
        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            await axios.post(`${API_BASE}/api/channels/${channel.id}/assign-admin`,
                { userId: memberToPromote },
                { headers }
            );

            showToast("Member promoted to admin successfully", "success");
            setMemberToPromote(null);

            // Add a small delay to ensure DB update completes
            setTimeout(() => {
                loadMembers();
            }, 300);
        } catch (err) {
            console.error("Promote failed:", err);
            showToast(err?.response?.data?.message || "Failed to promote member", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleDemoteAdmin = async (userId) => {
        setMemberToDemote(userId);
    };

    const confirmDemote = async () => {
        if (!memberToDemote) return;

        setLoading(true);
        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            await axios.post(`${API_BASE}/api/channels/${channel.id}/demote-admin`,
                { userId: memberToDemote },
                { headers }
            );

            const isSelf = String(memberToDemote) === String(currentUserId);
            showToast(isSelf ? "You have withdrawn as admin" : "Admin demoted to member successfully", "success");
            setMemberToDemote(null);

            // Add a small delay to ensure DB update completes
            setTimeout(() => {
                loadMembers();
            }, 300);
        } catch (err) {
            console.error("Demote failed:", err);
            showToast(err?.response?.data?.message || "Failed to demote admin", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleTogglePrivacy = async () => {
        if (channel.isPrivate) {
            // Making Public -> Requires Verification
            if (privacyVerification !== channel.name) {
                showToast("Please type the channel name correctly to make it public.", "error");
                return;
            }
        }
        // For making private, we'll proceed directly (confirmation is built into the UI)

        setLoading(true);
        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            const newPrivacy = !channel.isPrivate;

            await axios.patch(
                `${API_BASE}/api/channels/${channel.id}/privacy`,
                { isPrivate: newPrivacy },
                { headers }
            );

            showToast(
                `Channel is now ${newPrivacy ? "Private" : "Public"}. ${newPrivacy ? "Only invited members can see it." : "Everyone in workspace can access it."}`,
                "success"
            );

            setPrivacyVerification("");

            // Refresh page to update lock icons everywhere
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (err) {
            console.error("Toggle privacy failed:", err);
            showToast(err?.response?.data?.message || "Failed to change channel privacy", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteChannel = async () => {
        if (deleteVerification !== channel.name) {
            showToast("Please type the channel name correctly to delete it.", "error");
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            await axios.delete(`${API_BASE}/api/channels/${channel.id}`, { headers });

            showToast(`Channel ${channel.name} has been permanently deleted`, "success");

            // Navigate back to workspace home
            setTimeout(() => {
                window.location.href = `/workspace/${workspaceId}/home`;
            }, 1000);
        } catch (err) {
            console.error("Delete channel failed:", err);
            showToast(err?.response?.data?.message || "Failed to delete channel", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleClearMessages = async () => {
        if (!window.confirm("Are you sure you want to clear all messages in this channel? This cannot be undone.")) {
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            await axios.delete(`${API_BASE}/api/channels/${channel.id}/messages`, { headers });

            showToast("All messages have been cleared from this channel", "success");

            // Refresh to show empty channel
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (err) {
            console.error("Clear messages failed:", err);
            showToast(err?.response?.data?.message || "Failed to clear messages", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateName = async () => {
        if (!editedName.trim()) {
            showToast("Channel name cannot be empty", "error");
            return;
        }

        if (editedName === channel.name) {
            setIsEditingName(false);
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.patch(`${API_BASE}/api/channels/${channel.id}/name`,
                { name: editedName },
                { headers }
            );
            showToast("Channel name updated successfully", "success");
            setIsEditingName(false);
            // Refresh page to update channel name everywhere
            window.location.reload();
        } catch (err) {
            console.error("Update name failed:", err);
            showToast(err?.response?.data?.message || "Failed to update channel name", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateDescription = async () => {
        if (editedDescription === channel.description) {
            setIsEditingDescription(false);
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.patch(`${API_BASE}/api/channels/${channel.id}/description`,
                { description: editedDescription },
                { headers }
            );
            showToast("Channel description updated successfully", "success");
            setIsEditingDescription(false);
            channel.description = editedDescription; // Update local state
        } catch (err) {
            console.error("Update description failed:", err);
            showToast(err?.response?.data?.message || "Failed to update channel description", "error");
        } finally {
            setLoading(false);
        }
    };

    const nonMembers = allUsers.filter(
        (u) => !members.some((m) => String(m._id) === String(u._id))
    );

    return (
        <>
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                {channel.isPrivate ? <Lock size={20} className="text-gray-500" /> : <Users size={20} className="text-gray-500" />}
                                {channel.name}
                            </h3>
                            <div className="flex flex-col gap-0.5 mt-1">
                                <p className="text-xs text-gray-500">{members.length} members • {channel.isPrivate ? "Private" : "Public"} Channel</p>
                                {channel.description && (
                                    <p className="text-xs text-gray-600 italic mt-1">{channel.description}</p>
                                )}
                                <p className="text-[10px] text-gray-400">
                                    Created on {new Date(channel.createdAt || Date.now()).toLocaleDateString()} by {channel.creatorName || "Admin"}
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-gray-100 px-6">
                        <button
                            onClick={() => setActiveTab("members")}
                            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === "members" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                        >
                            {isAdmin ? "Members" : "Channel Info"}
                        </button>
                        {isAdmin && (
                            <button
                                onClick={() => setActiveTab("settings")}
                                className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === "settings" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                            >
                                Manage Channel
                            </button>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                        {activeTab === "members" && (
                            <div className="space-y-6">
                                {/* Invite Section (Admins Only) */}
                                {isAdmin && (
                                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                                        <h4 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
                                            <UserPlus size={16} /> Invite People
                                        </h4>
                                        <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                            {nonMembers.length === 0 ? (
                                                <p className="text-xs text-blue-600/70 italic">Everyone is already here!</p>
                                            ) : (
                                                nonMembers.map((user) => (
                                                    <div key={user._id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-blue-100 hover:border-blue-300 transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                                                                {(user?.username || 'U').charAt(0).toUpperCase()}
                                                            </div>
                                                            <span className="text-sm font-medium text-gray-700">{user?.username || 'Unknown'}</span>
                                                        </div>
                                                        <button
                                                            onClick={() => handleInvite(user._id)}
                                                            disabled={loading}
                                                            className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-md transition-colors"
                                                        >
                                                            Add
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Private Channel Notice (Non-Admins) */}
                                {!isAdmin && channel.isPrivate && (
                                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                                            <Lock size={20} />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-gray-900">Private Channel</h4>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                This channel is private. Only channel admins can invite new members.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Members List */}
                                <div>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Channel Members</h4>
                                    <div className="space-y-2">
                                        {members.map((member) => {
                                            const isOwner = String(member._id) === String(channel.createdBy);
                                            const isMemberAdmin = member.isAdmin || isOwner;
                                            const isCurrentUser = String(member._id) === String(currentUserId);

                                            return (
                                                <div key={member._id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors group">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold">
                                                            {(member?.username || 'U').charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                                                {member?.username || 'Unknown'}
                                                                {isOwner && (
                                                                    <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] font-bold rounded uppercase tracking-wide">Owner</span>
                                                                )}
                                                                {!isOwner && isMemberAdmin && (
                                                                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded uppercase tracking-wide">Admin</span>
                                                                )}
                                                            </div>
                                                            <div className="text-xs text-gray-500">Member</div>
                                                        </div>
                                                    </div>

                                                    {/* Admin actions for other members */}
                                                    {isAdmin && !isCurrentUser && !isOwner && (
                                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {!isMemberAdmin ? (
                                                                <button
                                                                    onClick={() => handlePromoteAdmin(member._id)}
                                                                    disabled={loading}
                                                                    className="text-xs font-medium text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-all"
                                                                >
                                                                    Promote to Admin
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleDemoteAdmin(member._id)}
                                                                    disabled={loading}
                                                                    className="text-xs font-medium text-orange-600 hover:bg-orange-50 px-3 py-1.5 rounded-lg transition-all"
                                                                >
                                                                    Demote to Member
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => handleRemove(member._id)}
                                                                disabled={loading}
                                                                className="text-xs font-medium text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-all"
                                                            >
                                                                Remove
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Self-demotion for current user if they're an admin but not owner */}
                                                    {isCurrentUser && isMemberAdmin && !isOwner && (
                                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => handleDemoteAdmin(member._id)}
                                                                disabled={loading}
                                                                className="text-xs font-medium text-gray-600 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-all"
                                                            >
                                                                Withdraw as Admin
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === "settings" && isAdmin && (
                            <div className="space-y-8">
                                {/* Channel Information */}
                                <div className="space-y-4">
                                    <h4 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">Channel Information</h4>

                                    {/* Channel Name */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="font-medium text-gray-800 text-sm">Channel Name</div>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                This is how your channel appears to all members
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isEditingName ? (
                                                <>
                                                    <input
                                                        type="text"
                                                        value={editedName}
                                                        onChange={(e) => setEditedName(e.target.value)}
                                                        className="text-sm border border-blue-300 rounded px-3 py-1.5 w-48 focus:outline-none focus:border-blue-500"
                                                        autoFocus
                                                        disabled={loading || isDefaultChannel}
                                                    />
                                                    <button
                                                        onClick={handleUpdateName}
                                                        disabled={loading || !editedName.trim()}
                                                        className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                                                    >
                                                        Save
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setEditedName(channel.name);
                                                            setIsEditingName(false);
                                                        }}
                                                        className="text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="text-sm font-semibold text-gray-700">{channel.name}</span>
                                                    {!isDefaultChannel && (
                                                        <button
                                                            onClick={() => setIsEditingName(true)}
                                                            className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                                                        >
                                                            Edit
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Channel Description */}
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="font-medium text-gray-800 text-sm">Channel Description</div>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                Help others understand what this channel is for
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-end gap-2 flex-1">
                                            {isEditingDescription ? (
                                                <>
                                                    <textarea
                                                        value={editedDescription}
                                                        onChange={(e) => setEditedDescription(e.target.value)}
                                                        className="text-sm border border-blue-300 rounded px-3 py-2 w-full focus:outline-none focus:border-blue-500 resize-none"
                                                        rows={3}
                                                        autoFocus
                                                        disabled={loading}
                                                    />
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={handleUpdateDescription}
                                                            disabled={loading}
                                                            className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                                                        >
                                                            Save
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setEditedDescription(channel.description || "");
                                                                setIsEditingDescription(false);
                                                            }}
                                                            className="text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <p className="text-sm text-gray-600 text-right">{channel.description || "No description"}</p>
                                                    <button
                                                        onClick={() => setIsEditingDescription(true)}
                                                        className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                                                    >
                                                        {channel.description ? "Edit" : "Add Description"}
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Privacy Settings (Hidden for Default Channels) */}
                                {!isDefaultChannel && (
                                    <div className="space-y-4">
                                        <h4 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">Privacy & Visibility</h4>
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="font-medium text-gray-800 flex items-center gap-2">
                                                    {channel.isPrivate ? <Lock size={16} /> : <Unlock size={16} />}
                                                    {channel.isPrivate ? "Private Channel" : "Public Channel"}
                                                </div>
                                                <p className="text-xs text-gray-500 mt-1 max-w-sm">
                                                    {channel.isPrivate
                                                        ? "Only invited members can view and join this channel."
                                                        : "Anyone in the workspace can view and join this channel."}
                                                </p>
                                            </div>
                                            {channel.isPrivate ? (
                                                <div className="flex flex-col items-end gap-2">
                                                    <input
                                                        type="text"
                                                        placeholder={`Type "${channel.name}" to confirm`}
                                                        value={privacyVerification}
                                                        onChange={(e) => setPrivacyVerification(e.target.value)}
                                                        className="text-xs border border-gray-300 rounded px-2 py-1 w-40 focus:outline-none focus:border-blue-500"
                                                    />
                                                    <button
                                                        onClick={handleTogglePrivacy}
                                                        disabled={privacyVerification !== channel.name}
                                                        className="text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                                                    >
                                                        Make Public
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={handleTogglePrivacy}
                                                    className="text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors"
                                                >
                                                    Make Private
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}


                                {/* Danger Zone (Hidden for Default Channels) */}
                                {!isDefaultChannel && (
                                    <div className="space-y-4">
                                        <h4 className="text-sm font-bold text-red-600 border-b border-red-100 pb-2 flex items-center gap-2">
                                            <AlertTriangle size={16} /> Danger Zone
                                        </h4>

                                        <div className="flex items-center justify-between p-4 border border-red-100 rounded-xl bg-red-50/30">
                                            <div>
                                                <div className="font-bold text-gray-800 text-sm">Clear All Messages</div>
                                                <p className="text-xs text-gray-500 mt-0.5">Permanently delete all message history in this channel.</p>
                                            </div>
                                            <button
                                                onClick={handleClearMessages}
                                                className="text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                                            >
                                                <Eraser size={14} /> Clear History
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between p-4 border border-red-100 rounded-xl bg-red-50/30">
                                            <div>
                                                <div className="font-bold text-gray-800 text-sm">Delete Channel</div>
                                                <p className="text-xs text-gray-500 mt-0.5">Permanently delete this channel and all its data.</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <input
                                                    type="text"
                                                    placeholder={`Type "${channel.name}" to confirm`}
                                                    value={deleteVerification}
                                                    onChange={(e) => setDeleteVerification(e.target.value)}
                                                    className="text-xs border border-red-200 rounded px-2 py-1 w-40 focus:outline-none focus:border-red-500 bg-white"
                                                />
                                                <button
                                                    onClick={handleDeleteChannel}
                                                    disabled={deleteVerification !== channel.name}
                                                    className="text-xs font-bold bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                                                >
                                                    <Trash2 size={14} /> Delete Channel
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Remove Member Confirmation Modal */}
            {memberToRemove && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[110]" onClick={() => setMemberToRemove(null)}>
                    <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                                <AlertTriangle size={20} className="text-red-600" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-gray-900 mb-2">Remove Member</h3>
                                <p className="text-sm text-gray-600 mb-6">
                                    Are you sure you want to remove this member from the channel? They will no longer have access to this channel.
                                </p>
                                <div className="flex gap-3 justify-end">
                                    <button
                                        onClick={() => setMemberToRemove(null)}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmRemove}
                                        disabled={loading}
                                        className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        Remove Member
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Promote to Admin Confirmation Modal */}
            {memberToPromote && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[110]" onClick={() => setMemberToPromote(null)}>
                    <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <Users size={20} className="text-blue-600" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-gray-900 mb-2">Promote to Admin</h3>
                                <p className="text-sm text-gray-600 mb-6">
                                    Are you sure you want to promote this member to admin? They will be able to manage channel settings and members.
                                </p>
                                <div className="flex gap-3 justify-end">
                                    <button
                                        onClick={() => setMemberToPromote(null)}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmPromote}
                                        disabled={loading}
                                        className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        Promote to Admin
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Demote Admin Confirmation Modal */}
            {memberToDemote && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[110]" onClick={() => setMemberToDemote(null)}>
                    <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                                <AlertTriangle size={20} className="text-orange-600" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-gray-900 mb-2">
                                    {String(memberToDemote) === String(currentUserId) ? "Withdraw as Admin" : "Demote to Member"}
                                </h3>
                                <p className="text-sm text-gray-600 mb-6">
                                    {String(memberToDemote) === String(currentUserId)
                                        ? "Are you sure you want to withdraw as admin? You will lose admin privileges and won't be able to manage channel settings."
                                        : "Are you sure you want to demote this admin to a regular member? They will lose admin privileges."}
                                </p>
                                <div className="flex gap-3 justify-end">
                                    <button
                                        onClick={() => setMemberToDemote(null)}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmDemote}
                                        disabled={loading}
                                        className="px-4 py-2 text-sm font-medium bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {String(memberToDemote) === String(currentUserId) ? "Withdraw" : "Demote to Member"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
