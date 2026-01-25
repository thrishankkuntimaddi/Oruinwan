import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Hash, Search, Trash2, X, CheckSquare, Settings2, Lock, Megaphone } from 'lucide-react';
import { useWorkspace } from "../../../contexts/WorkspaceContext";
import { useToast } from "../../../contexts/ToastContext";
import api from "../../../services/api";
import ConfirmationModal from "../../../shared/components/ui/ConfirmationModal";
import { useSocket } from "../../../contexts/SocketContext"; // ✅ Use global socket
import CreateChannelModal from "../../messagesComp/CreateChannelModal";

const ChannelsPanel = ({ title }) => {
    const navigate = useNavigate();
    const { workspaceId, id: channelId } = useParams();
    const { activeWorkspace } = useWorkspace();
    const { showToast } = useToast();
    const { socket, addChannelListener } = useSocket(); // ✅ Use global socket

    const [searchQuery, setSearchQuery] = useState("");
    const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Selection Mode State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedItems, setSelectedItems] = useState(new Set());

    // Real channels from backend - NO FILTERING NEEDED
    const [channels, setChannels] = useState([]);
    const [isLoadingChannels, setIsLoadingChannels] = useState(true);

    // Fetch workspace-specific channels (✅ CORRECT ENDPOINT)
    useEffect(() => {
        const fetchChannels = async () => {
            if (!workspaceId) return;

            try {
                setIsLoadingChannels(true);
                // ✅ CORRECT: Use workspace-specific endpoint
                const response = await api.get(`/api/workspaces/${workspaceId}/channels`);

                // ✅ NO FILTERING NEEDED - Backend already returns only this workspace's channels
                const mappedChannels = response.data.channels.map(ch => ({
                    id: ch._id,
                    type: 'channel',
                    label: ch.name,
                    path: `/workspace/${workspaceId}/channel/${ch._id}`, // ✅ CORRECT PATH
                    isFavorite: ch.isDefault || false,
                    isPrivate: ch.isPrivate || false,
                    isDefault: ch.isDefault || false,
                    description: ch.description || '',
                    canDelete: !ch.isDefault, // ✅ Default channels cannot be deleted
                    workspaceId: ch.workspace
                }));

                setChannels(mappedChannels);
                setIsLoadingChannels(false);
            } catch (err) {
                console.error('❌ Error fetching channels:', err);
                setIsLoadingChannels(false);
            }
        };

        fetchChannels();
    }, [workspaceId]);

    // ✅ AUTO-REFRESH: Refetch when tab becomes visible
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && workspaceId) {
                // Refetch channels when user returns to tab
                const refetch = async () => {
                    try {
                        const response = await api.get(`/api/workspaces/${workspaceId}/channels`);
                        const mappedChannels = response.data.channels.map(ch => ({
                            id: ch._id,
                            type: 'channel',
                            label: ch.name,
                            path: `/workspace/${workspaceId}/channel/${ch._id}`,
                            isFavorite: ch.isDefault || false,
                            isPrivate: ch.isPrivate || false,
                            isDefault: ch.isDefault || false,
                            description: ch.description || '',
                            canDelete: !ch.isDefault,
                            workspaceId: ch.workspace
                        }));
                        setChannels(mappedChannels);
                    } catch (err) {
                        console.error('Error refreshing channels:', err);
                    }
                };
                refetch();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [workspaceId]);

    // ✅ PERIODIC REFRESH: Poll every 30 seconds as fallback
    useEffect(() => {
        if (!workspaceId) return;

        const interval = setInterval(async () => {
            try {
                const response = await api.get(`/api/workspaces/${workspaceId}/channels`);
                const mappedChannels = response.data.channels.map(ch => ({
                    id: ch._id,
                    type: 'channel',
                    label: ch.name,
                    path: `/workspace/${workspaceId}/channel/${ch._id}`,
                    isFavorite: ch.isDefault || false,
                    isPrivate: ch.isPrivate || false,
                    isDefault: ch.isDefault || false,
                    description: ch.description || '',
                    canDelete: !ch.isDefault,
                    workspaceId: ch.workspace
                }));
                setChannels(mappedChannels);
            } catch (err) {
                console.error('Error auto-refreshing channels:', err);
            }
        }, 30000); // Every 30 seconds

        return () => clearInterval(interval);
    }, [workspaceId]);

    // ✅ REAL-TIME UPDATES: Listen for channel events via global socket
    useEffect(() => {
        if (!socket || !workspaceId) return;

        // Register channel event handler
        const handleChannelEvent = (eventType, data) => {

            switch (eventType) {
                case 'channel-created':
                    // Check if channel belongs to current workspace
                    if (data.workspace === workspaceId) {
                        const newChannel = {
                            id: data._id,
                            type: 'channel',
                            label: data.name,
                            path: `/workspace/${workspaceId}/channel/${data._id}`,
                            isFavorite: false,
                            isPrivate: data.isPrivate,
                            isDefault: false,
                            description: data.description || '',
                            canDelete: true
                        };
                        setChannels(prev => {
                            // Avoid duplicates
                            if (prev.some(ch => ch.id === newChannel.id)) return prev;
                            return [...prev, newChannel];
                        });
                        showToast(`New channel #${data.name} created!`, 'success');
                    }
                    break;

                case 'invited-to-channel':
                    // Fetch full channel details
                    api.get(`/api/channels/${data.channelId}`)
                        .then(response => {
                            const channel = response.data.channel;
                            const newChannel = {
                                id: channel._id,
                                type: 'channel',
                                label: channel.name,
                                path: `/workspace/${workspaceId}/channel/${channel._id}`,
                                isFavorite: false,
                                isPrivate: channel.isPrivate,
                                isDefault: false,
                                description: channel.description || '',
                                canDelete: true
                            };
                            setChannels(prev => {
                                if (prev.some(ch => ch.id === newChannel.id)) return prev;
                                return [...prev, newChannel];
                            });
                            showToast(`You've been added to #${data.channelName}!`, 'success');
                        })
                        .catch(err => console.error('Error fetching invited channel:', err));
                    break;

                case 'removed-from-channel':
                    setChannels(prev => prev.filter(ch => ch.id !== data.channelId));
                    showToast('You have been removed from a channel', 'info');
                    // If currently viewing the removed channel, navigate away
                    if (data.channelId === channelId) {
                        navigate(`/workspace/${workspaceId}`);
                    }
                    break;

                default:
                    break;
            }
        };

        // Register with global socket context
        const unsubscribe = addChannelListener(handleChannelEvent);

        return () => {
            unsubscribe();
        };
    }, [socket, workspaceId, channelId, navigate, showToast, addChannelListener]);

    // ✅ Delete channels via backend API
    const handleDeleteSelected = async () => {
        try {
            // Filter out default channels (they cannot be deleted)
            const deletableChannels = Array.from(selectedItems).filter(id => {
                const channel = channels.find(ch => ch.id === id);
                return channel && !channel.isDefault;
            });

            if (deletableChannels.length === 0) {
                showToast('Cannot delete default channels (#general, #announcements)', 'warning');
                setShowDeleteConfirm(false);
                return;
            }

            // ✅ Check if currently viewing a deleted channel BEFORE making changes
            const isViewingDeletedChannel = channelId && deletableChannels.includes(channelId);

            // ✅ Call backend DELETE endpoint for each channel
            const deletePromises = deletableChannels.map(id =>
                api.delete(`/api/channels/${id}`)
            );

            await Promise.all(deletePromises);

            // ✅ Navigate away BEFORE updating state if viewing a deleted channel
            if (isViewingDeletedChannel) {
                // Find first non-deleted channel or go to workspace home
                const remainingChannels = channels.filter(ch => !deletableChannels.includes(ch.id));
                if (remainingChannels.length > 0) {
                    navigate(remainingChannels[0].path);
                } else {
                    navigate(`/workspace/${workspaceId}`);
                }
            }

            // Remove deleted channels from frontend state
            setChannels(prev => prev.filter(ch => !deletableChannels.includes(ch.id)));

            // Reset selection state
            setSelectedItems(new Set());
            setIsSelectionMode(false);
            setShowDeleteConfirm(false);

            // Show success message
            const count = deletableChannels.length;
            showToast(
                `Successfully deleted ${count} channel${count > 1 ? 's' : ''}`,
                'success'
            );
        } catch (err) {
            console.error('Error deleting channels:', err);
            showToast(
                err.response?.data?.message || 'Failed to delete channels',
                'error'
            );
            setShowDeleteConfirm(false);
        }
    };

    const filteredChannels = channels.filter(channel =>
        (channel.label || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    // ✅ Default channels first, then user-created
    const sortedChannels = filteredChannels.sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return 0;
    });

    const Item = ({ item }) => {
        const isSelected = selectedItems.has(item.id);

        const handleClick = (e) => {
            if (isSelectionMode) {
                e.stopPropagation();

                // ✅ Prevent selection of default channels
                if (item.isDefault) {
                    showToast('Default channels cannot be deleted', 'warning');
                    return;
                }

                const newSelected = new Set(selectedItems);
                if (newSelected.has(item.id)) {
                    newSelected.delete(item.id);
                } else {
                    newSelected.add(item.id);
                }
                setSelectedItems(newSelected);
            } else {
                navigate(item.path);
            }
        };

        const isActive = channelId === item.id;

        return (
            <div
                onClick={handleClick}
                className={`px-3 py-2 mx-2 transition-all duration-200 rounded-lg cursor-pointer flex items-center justify-between group relative ${isSelectionMode && isSelected
                    ? "bg-blue-50/80 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                    : isActive
                        ? "bg-gradient-to-r from-blue-50 to-white dark:from-blue-900/30 dark:to-gray-900/50 text-blue-600 dark:text-blue-400"
                        : "hover:bg-gray-100 dark:hover:bg-gray-800/60 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                    }`}
            >
                {/* Active Accent Bar */}
                {isActive && !isSelectionMode && (
                    <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-blue-600 dark:bg-blue-500 rounded-r-full shadow-[0_0_8px_rgba(37,99,235,0.4)]" />
                )}

                <div className="flex items-center truncate flex-1 gap-3">
                    {isSelectionMode && !item.isDefault && (
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected ? "bg-blue-600 border-blue-600" : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                            }`}>
                            {isSelected && <CheckSquare size={10} className="text-white" />}
                        </div>
                    )}

                    {/* Icon Backdrop */}
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors shadow-sm ${isActive
                        ? "bg-blue-100/50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                        : item.label.toLowerCase() === 'announcements'
                            ? "bg-orange-50 dark:bg-orange-900/20 text-orange-500 dark:text-orange-400"
                            : item.isPrivate
                                ? "bg-purple-50 dark:bg-purple-900/20 text-purple-500 dark:text-purple-400"
                                : "bg-gray-100 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500 group-hover:bg-gray-200 dark:group-hover:bg-gray-700"
                        }`}>
                        {item.isPrivate ? (
                            <Lock size={14} strokeWidth={2.5} />
                        ) : (item.label || '').toLowerCase() === 'announcements' ? (
                            <Megaphone size={14} strokeWidth={2.5} />
                        ) : (
                            <Hash size={14} strokeWidth={2.5} />
                        )}
                    </div>

                    <span className={`truncate text-sm tracking-tight transition-all ${isActive ? "font-bold text-gray-900 dark:text-white" : "font-semibold group-hover:text-gray-900 dark:group-hover:text-gray-100"}`}>
                        {(item.label || 'Unnamed Channel').replace(/^#/, '')}
                    </span>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-gray-50/50 dark:bg-gray-900">
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-5 bg-white dark:bg-gray-900 shrink-0 border-b border-gray-200 dark:border-gray-800">
                <h2 className="font-bold text-lg text-gray-800 dark:text-gray-100 tracking-tight">
                    Channels
                </h2>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setIsSelectionMode(!isSelectionMode)}
                        className={`p-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors ${isSelectionMode ? "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400" : ""
                            }`}
                        title="Manage Channels"
                    >
                        <Settings2 size={20} />
                    </button>
                    <button
                        onClick={() => {
                            // ✅ Check permission before allowing channel creation
                            const userRole = activeWorkspace?.role?.toLowerCase() || '';
                            const isAdmin = userRole === 'admin' || userRole === 'owner';
                            const canCreateChannel = isAdmin || activeWorkspace?.settings?.allowMemberChannelCreation !== false;

                            if (!canCreateChannel) {
                                showToast('Channel creation is disabled for members in this workspace', 'warning');
                                return;
                            }
                            setShowCreateChannelModal(true);
                        }}
                        disabled={(() => {
                            const userRole = activeWorkspace?.role?.toLowerCase() || '';
                            const isAdmin = userRole === 'admin' || userRole === 'owner';
                            return !isAdmin && activeWorkspace?.settings?.allowMemberChannelCreation === false;
                        })()}
                        className="p-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400"
                        title={(() => {
                            const userRole = activeWorkspace?.role?.toLowerCase() || '';
                            const isAdmin = userRole === 'admin' || userRole === 'owner';
                            const canCreate = isAdmin || activeWorkspace?.settings?.allowMemberChannelCreation !== false;
                            return canCreate ? "Create Channel" : "Channel creation disabled for members";
                        })()}
                    >
                        <Plus size={20} />
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="px-4 pt-6">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search channels..."
                        className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                </div>
            </div>

            {/* Selection Mode Header */}
            {
                isSelectionMode && (
                    <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-100 dark:border-blue-800 flex items-center justify-between sticky top-0 z-10">
                        <span className="text-sm font-bold text-blue-900 dark:text-blue-300">{selectedItems.size} selected</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                disabled={selectedItems.size === 0}
                                className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Delete Selected"
                            >
                                <Trash2 size={16} />
                            </button>
                            <button
                                onClick={() => {
                                    setIsSelectionMode(false);
                                    setSelectedItems(new Set());
                                }}
                                className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
                                title="Cancel"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                )
            }

            {/* Channel List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-4 space-y-0.5">
                <div className="px-4 mb-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    {activeWorkspace?.name || 'Workspace'} Channels
                </div>
                {isLoadingChannels ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        Loading channels...
                    </div>
                ) : sortedChannels.length > 0 ? (
                    sortedChannels.map(channel => (
                        <Item key={channel.id} item={channel} />
                    ))
                ) : (
                    <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        No channels found
                    </div>
                )}
            </div>

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDeleteSelected}
                title="Delete Channels?"
                message={`Are you sure you want to delete ${selectedItems.size} selected channel(s)? This action cannot be undone.`}
                confirmText="Delete Channels"
            />

            {/* Create Channel Modal */}
            {showCreateChannelModal && (
                <CreateChannelModal
                    onClose={() => setShowCreateChannelModal(false)}
                    onCreated={(channel) => {
                        // Append to channels list
                        const newChannel = {
                            id: channel._id,
                            type: 'channel',
                            label: channel.name,
                            path: `/workspace/${workspaceId}/channel/${channel._id}`,
                            isFavorite: false,
                            isPrivate: channel.isPrivate,
                            isDefault: false,
                            description: channel.description || '',
                            canDelete: true,
                            createdBy: channel.createdBy
                        };
                        setChannels(prev => [...prev, newChannel]);

                        // Navigate to new channel
                        navigate(`/workspace/${workspaceId}/channel/${channel._id}`);
                    }}
                    workspaceId={workspaceId}
                />
            )}
        </div >
    );
};

export default ChannelsPanel;
