import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../contexts/ToastContext";
import { getErrorMessage } from "../../utils/apiHelpers";
import { useChannels } from "../../hooks/useChannels";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import api from '@services/api';

export default function JoinChannelModal({ onClose, onJoined, currentUserId }) {
    const { showToast } = useToast();
    const navigate = useNavigate();
    const { activeWorkspace } = useWorkspace();
    const workspaceId = activeWorkspace?.id || activeWorkspace?._id;
    const { joinDiscoverableChannel } = useChannels(workspaceId);

    const [publicChannels, setPublicChannels] = useState([]);
    const [loadingList, setLoadingList] = useState(false);
    const [joiningId, setJoiningId] = useState(null); // track which channel is being joined

    const loadPublicChannels = useCallback(async () => {
        if (!workspaceId) return;
        try {
            setLoadingList(true);
            const res = await api.get(`/api/workspaces/${workspaceId}/channels`);
            const allChannels = res.data.channels || [];

            // Filter to public discoverable channels the user hasn't joined
            const notJoined = allChannels.filter(ch =>
                !ch.isPrivate &&
                ch.isDiscoverable !== false &&
                !ch.members.some(m => String(m) === String(currentUserId)) &&
                !ch.members.some(m => String(m._id) === String(currentUserId))
            );

            setPublicChannels(notJoined);
        } catch (err) {
            console.error("Load public channels failed:", err);
        } finally {
            setLoadingList(false);
        }
    }, [workspaceId, currentUserId]);

    useEffect(() => {
        loadPublicChannels();
    }, [loadPublicChannels]);

    const handleJoin = async (channelId) => {
        setJoiningId(channelId);
        try {
            // joinDiscoverableChannel: optimistic state update + correct endpoint
            const joined = await joinDiscoverableChannel(channelId);

            showToast(`Joined #${joined.label} successfully!`);
            onJoined?.(joined);
            onClose();

            // Navigate into the channel — no page reload
            navigate(joined.path || `/channels/${channelId}`);
        } catch (err) {
            console.error("Join failed:", err);
            showToast(getErrorMessage(err), "error");
        } finally {
            setJoiningId(null);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded w-full max-w-md max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Join Public Channel</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
                </div>

                {loadingList ? (
                    <p className="text-sm text-gray-500 text-center py-8">Loading channels...</p>
                ) : (
                    <div className="space-y-2">
                        {publicChannels.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-8">
                                No public channels available to join
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
                                            disabled={joiningId !== null}
                                            className="ml-4 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            {joiningId === channel._id ? "Joining…" : "Join"}
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                <div className="mt-6 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
