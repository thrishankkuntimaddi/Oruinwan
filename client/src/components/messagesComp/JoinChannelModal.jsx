import React, { useState, useEffect, useCallback } from "react";
import { useToast } from "../../contexts/ToastContext";
import { getErrorMessage } from "../../utils/apiHelpers";
import { channelService } from "../../services/channelService";
import api from "../../services/api";

export default function JoinChannelModal({ onClose, onJoined, currentUserId }) {
    const { showToast } = useToast();
    const [publicChannels, setPublicChannels] = useState([]);
    const [loading, setLoading] = useState(false);

    const loadPublicChannels = useCallback(async () => {
        try {
            // GET /api/channels/my is user-scoped — for discovery use join-discoverable
            // Fall back: fetch all public channels via workspace discoverable endpoint
            const params = new URLSearchParams(window.location.search);
            const workspaceId = params.get('workspace');
            if (!workspaceId) return;

            const res = await api.get(`/api/workspaces/${workspaceId}/channels`);
            const allChannels = res.data.channels || [];

            // Filter to public, non-joined channels
            const notJoined = allChannels.filter(ch =>
                !ch.isPrivate &&
                !ch.members.some(m => String(m) === String(currentUserId)) &&
                !ch.members.some(m => String(m._id) === String(currentUserId))
            );

            setPublicChannels(notJoined);
        } catch (err) {
            console.error("Load public channels failed:", err);
        }
    }, [currentUserId]);

    useEffect(() => {
        loadPublicChannels();
    }, [loadPublicChannels]);

    const handleJoin = async (channelId) => {
        setLoading(true);
        try {
            await channelService.joinChannel(channelId);
            showToast("Joined channel successfully!");
            onJoined && onJoined();
            onClose();
        } catch (err) {
            console.error("Join failed:", err);
            showToast(getErrorMessage(err), "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded w-full max-w-md max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Join Public Channel</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
                </div>

                <div className="space-y-2">
                    {publicChannels.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-8">
                            No public channels available
                        </p>
                    ) : (
                        publicChannels.map((channel) => (
                            <div key={channel._id} className="p-3 bg-gray-50 rounded hover:bg-gray-100">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <p className="font-medium">#{channel.name}</p>
                                        {channel.description && (
                                            <p className="text-sm text-gray-600 mt-1">{channel.description}</p>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => handleJoin(channel._id)}
                                        disabled={loading}
                                        className="ml-4 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        Join
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
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
