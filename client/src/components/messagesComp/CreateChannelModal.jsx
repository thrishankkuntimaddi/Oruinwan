// client/src/components/messagesComp/CreateChannelModal.jsx
import React, { useState } from "react";
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function CreateChannelModal({ onClose, onCreated }) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [isPrivate, setIsPrivate] = useState(false);
    const memberIds = []; // for later: accept list of user ids

    const handleCreate = async () => {
        if (!name.trim()) return alert("Channel name required");

        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.post(`${API_BASE}/api/chat/channel/create`, {
                name,
                description,
                isPrivate,
                memberIds
            }, { headers });

            const channel = res.data.channel;
            onCreated && onCreated(channel);
            onClose();
        } catch (err) {
            console.error("Create channel failed:", err);
            alert(err?.response?.data?.message || "Create failed");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded w-full max-w-md">
                <h3 className="text-lg font-semibold mb-4">Create Channel</h3>

                <label className="block mb-2 text-sm font-medium">Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border p-2 rounded mb-3" />

                <label className="block mb-2 text-sm font-medium">Description</label>
                <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border p-2 rounded mb-3" />

                <div className="flex items-center gap-2 mb-4">
                    <input id="private" type="checkbox" checked={isPrivate} onChange={() => setIsPrivate(p => !p)} />
                    <label htmlFor="private" className="text-sm">Make private (invite-only)</label>
                </div>

                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 rounded bg-gray-200">Cancel</button>
                    <button onClick={handleCreate} className="px-4 py-2 rounded bg-blue-600 text-white">Create</button>
                </div>
            </div>
        </div>
    );
}
