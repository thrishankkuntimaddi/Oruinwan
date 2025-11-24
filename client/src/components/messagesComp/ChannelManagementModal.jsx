// client/src/components/messagesComp/ChannelManagementModal.jsx
import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function ChannelManagementModal({ channel, onClose, currentUserId }) {
    const [members, setMembers] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [loading, setLoading] = useState(false);

    const isCreator = String(channel.createdBy) === String(currentUserId);

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
            // Assuming you have a users endpoint
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

            alert("User invited successfully!");
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

            alert("Member removed successfully!");
            loadMembers();
        } catch (err) {
            console.error("Remove failed:", err);
            alert(err?.response?.data?.message || "Remove failed");
        } finally {
            setLoading(false);
        }
    };

    const nonMembers = allUsers.filter(
        (u) => !members.some((m) => String(m._id) === String(u._id))
    );

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded w-full max-w-2xl max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Manage Channel: {channel.name}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
                </div>

                {/* Channel Info */}
                <div className="mb-6 p-4 bg-gray-50 rounded">
                    <p className="text-sm text-gray-600">
                        <strong>Type:</strong> {channel.isPrivate ? "Private (invite-only)" : "Public"}
                    </p>
                    {channel.description && (
                        <p className="text-sm text-gray-600 mt-1">
                            <strong>Description:</strong> {channel.description}
                        </p>
                    )}
                </div>

                {/* Members List */}
                <div className="mb-6">
                    <h4 className="font-semibold mb-3">Members ({members.length})</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {members.map((member) => (
                            <div key={member._id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="h-8 w-8 bg-gray-300 rounded-full"
                                        style={{
                                            backgroundImage: `url(${member.profilePicture || "/default-avatar.png"})`,
                                            backgroundSize: "cover",
                                        }}
                                    />
                                    <span className="text-sm font-medium">{member.username}</span>
                                    {String(member._id) === String(channel.createdBy) && (
                                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Creator</span>
                                    )}
                                </div>

                                {isCreator && String(member._id) !== String(currentUserId) && (
                                    <button
                                        onClick={() => handleRemove(member._id)}
                                        disabled={loading}
                                        className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Invite Section */}
                <div>
                    <h4 className="font-semibold mb-3">Invite Members</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {nonMembers.length === 0 ? (
                            <p className="text-sm text-gray-500">All users are already members</p>
                        ) : (
                            nonMembers.map((user) => (
                                <div key={user._id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="h-8 w-8 bg-gray-300 rounded-full"
                                            style={{
                                                backgroundImage: `url(${user.profilePicture || "/default-avatar.png"})`,
                                                backgroundSize: "cover",
                                            }}
                                        />
                                        <span className="text-sm font-medium">{user.username}</span>
                                    </div>

                                    <button
                                        onClick={() => handleInvite(user._id)}
                                        disabled={loading}
                                        className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        Invite
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
