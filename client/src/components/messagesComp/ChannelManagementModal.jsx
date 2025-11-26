// client/src/components/messagesComp/ChannelManagementModal.jsx
import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Trash2, UserPlus, Users, Lock, Unlock, X, AlertTriangle, Eraser } from "lucide-react";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function ChannelManagementModal({ channel, onClose, currentUserId }) {
    const [members, setMembers] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("members"); // members, settings
    const [privacyVerification, setPrivacyVerification] = useState("");
    const [deleteVerification, setDeleteVerification] = useState("");

    const isCreator = String(channel.createdBy) === String(currentUserId);
    // In a real app, you'd check if currentUserId is in channel.admins list
    const isAdmin = isCreator;

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
            const res = await axios.get(`${API_BASE}/api/auth/users`, { headers });
            setAllUsers(res.data.users || []);
        } catch (err) {
            console.error("Load users failed:", err);
        }
    }, []);

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
            alert(err?.response?.data?.message || "Invite failed");
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async (userId) => {
        if (!window.confirm("Remove this member?")) return;
        setLoading(true);
        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.delete(`${API_BASE}/api/channels/${channel.id}/member`, {
                headers,
                data: { userId }
            });
            loadMembers();
        } catch (err) {
            console.error("Remove failed:", err);
            alert(err?.response?.data?.message || "Remove failed");
        } finally {
            setLoading(false);
        }
    };

    const handleTogglePrivacy = async () => {
        if (channel.isPrivate) {
            // Making Public -> Requires Verification
            if (privacyVerification !== channel.name) {
                alert("Please type the channel name correctly to make it public.");
                return;
            }
        } else {
            // Making Private -> Admin Confirmation
            if (!window.confirm("Are you sure you want to make this channel private? Only invited members will be able to see it.")) {
                return;
            }
        }

        // API call to toggle privacy would go here
        alert(`Channel is now ${channel.isPrivate ? "Public" : "Private"} (Mock Action)`);
        setPrivacyVerification("");
    };

    const handleDeleteChannel = async () => {
        if (deleteVerification !== channel.name) {
            alert("Please type the channel name correctly to delete it.");
            return;
        }
        // API call to delete channel
        alert("Channel Deleted (Mock Action)");
        onClose();
    };

    const handleClearMessages = async () => {
        if (!window.confirm("Are you sure you want to clear all messages in this channel? This cannot be undone.")) {
            return;
        }
        // API call to clear messages
        alert("Messages Cleared (Mock Action)");
    };

    const nonMembers = allUsers.filter(
        (u) => !members.some((m) => String(m._id) === String(u._id))
    );

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            {channel.isPrivate ? <Lock size={20} className="text-gray-500" /> : <Users size={20} className="text-gray-500" />}
                            {channel.name}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">{members.length} members • {channel.isPrivate ? "Private" : "Public"} Channel</p>
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
                        Members
                    </button>
                    {isAdmin && (
                        <button
                            onClick={() => setActiveTab("settings")}
                            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === "settings" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                        >
                            Settings
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {activeTab === "members" && (
                        <div className="space-y-6">
                            {/* Invite Section */}
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
                                                        {user.username.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="text-sm font-medium text-gray-700">{user.username}</span>
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

                            {/* Members List */}
                            <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Channel Members</h4>
                                <div className="space-y-2">
                                    {members.map((member) => (
                                        <div key={member._id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors group">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold">
                                                    {member.username.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                                        {member.username}
                                                        {String(member._id) === String(channel.createdBy) && (
                                                            <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] font-bold rounded uppercase tracking-wide">Owner</span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-gray-500">Member</div>
                                                </div>
                                            </div>

                                            {isAdmin && String(member._id) !== String(currentUserId) && (
                                                <button
                                                    onClick={() => handleRemove(member._id)}
                                                    disabled={loading}
                                                    className="opacity-0 group-hover:opacity-100 text-xs font-medium text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-all"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "settings" && isAdmin && (
                        <div className="space-y-8">
                            {/* Privacy Settings */}
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

                            {/* Danger Zone */}
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
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
