import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Hash, Search, Trash2, X, CheckSquare, Settings2, Lock, Megaphone } from 'lucide-react';
import { useWorkspace } from "../../../contexts/WorkspaceContext";
import { useToast } from "../../../contexts/ToastContext";
import api from "../../../services/api";
import ConfirmationModal from "../../../shared/components/ui/ConfirmationModal";
import { useSocket } from "../../../contexts/SocketContext"; // ✅ Use global socket

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

    // Channel Creation State 
    const [newChannelData, setNewChannelData] = useState({ name: "", description: "" });
    const [createStep, setCreateStep] = useState(1);
    const [selectedChannelMembers, setSelectedChannelMembers] = useState([]);

    // Workspace members (for channel creation)
    const [workspaceMembers, setWorkspaceMembers] = useState([]);

    // Real channels from backend - NO FILTERING NEEDED
    const [channels, setChannels] = useState([]);
    const [isLoadingChannels, setIsLoadingChannels] = useState(true);

    // Fetch workspace members for channel creation
    useEffect(() => {
        const fetchMembers = async () => {
            if (!workspaceId) return;

            try {
                const response = await api.get(`/api/workspaces/${workspaceId}/members`);
                setWorkspaceMembers(response.data.members || []);
            } catch (err) {
                console.error('Error fetching workspace members:', err);
            }
        };

        fetchMembers();
    }, [workspaceId]);

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

    // ✅ CORRECT: Create channel via backend
    const handleCreateChannel = async () => {
        if (!newChannelData.name) return;

        try {


            // ✨ NEW LOGIC: Backend determines public/private based on members array
            // - undefined/empty array → PUBLIC (all workspace members)
            // - array with IDs → PRIVATE (only selected members + creator)
            const payload = {
                name: newChannelData.name,
                description: newChannelData.description,
                members: selectedChannelMembers.length > 0
                    ? selectedChannelMembers
                    : undefined // Backend will make it public
            };



            // ✅ CORRECT: Call backend API
            const response = await api.post(`/api/workspaces/${workspaceId}/channels`, payload);
            const createdChannel = response.data.channel; // Backend returns { message, channel }



            // Append real channel to list
            const newChannel = {
                id: createdChannel._id,
                type: 'channel',
                label: createdChannel.name,
                path: `/workspace/${workspaceId}/channel/${createdChannel._id}`, // ✅ CORRECT PATH
                isFavorite: false,
                isPrivate: createdChannel.isPrivate,
                isDefault: false,
                description: createdChannel.description || '',
                canDelete: true,
                createdBy: createdChannel.createdBy // Add createdBy for newly created channel
            };

            setChannels(prev => [...prev, newChannel]);

            // ✅ CORRECT: Navigate with workspace context
            navigate(`/workspace/${workspaceId}/channel/${createdChannel._id}`);

            // Reset
            setShowCreateChannelModal(false);
            setNewChannelData({ name: "", description: "" });
            setCreateStep(1);
            setSelectedChannelMembers([]);
        } catch (err) {
            console.error('❌ Error creating channel:', err);
            showToast(err.response?.data?.message || 'Failed to create channel', 'error');
        }
    };

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
                className={`px-4 py-2 rounded-md cursor-pointer flex items-center justify-between group transition-colors ${isSelectionMode && isSelected
                    ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800"
                    : isActive
                        ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold"
                        : "hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                    }`}
            >
                <div className="flex items-center truncate flex-1 gap-2">
                    {isSelectionMode && !item.isDefault && (
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? "bg-blue-600 border-blue-600" : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                            }`}>
                            {isSelected && <CheckSquare size={10} className="text-white" />}
                        </div>
                    )}
                    {item.isPrivate ? (
                        <Lock size={14} className="text-purple-400 dark:text-purple-400" />
                    ) : (item.label || '').toLowerCase() === 'announcements' ? (
                        <Megaphone size={14} className="text-gray-400 dark:text-gray-500" />
                    ) : (
                        <Hash size={14} className="text-gray-400 dark:text-gray-500" />
                    )}
                    <span className="truncate text-sm font-medium">{(item.label || 'Unnamed Channel').replace(/^#/, '')}</span>
                    {/* Default badge removed */}
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
            {
                showCreateChannelModal && (
                    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center animate-fade-in backdrop-blur-sm">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-[500px] overflow-hidden transform transition-all scale-100 border border-gray-100 dark:border-gray-700">
                            <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                                    {createStep === 1 ? "Create New Channel" : "Add Members"}
                                </h3>
                                <button onClick={() => setShowCreateChannelModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
                            </div>

                            {createStep === 1 ? (
                                <div className="p-8 space-y-6">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Channel Name</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">#</span>
                                            <input
                                                type="text"
                                                value={newChannelData.name}
                                                onChange={(e) => setNewChannelData({ ...newChannelData, name: e.target.value })}
                                                placeholder="e.g. marketing-updates"
                                                className="w-full pl-8 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-900 dark:text-gray-100 transition-all font-medium"
                                                autoFocus
                                            />
                                        </div>
                                        <p className="text-xs text-gray-400 mt-2">Channels are where your team communicates. They're best when organized around a topic.</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Description <span className="text-gray-300 dark:text-gray-600 font-normal">(Optional)</span></label>
                                        <input
                                            type="text"
                                            value={newChannelData.description}
                                            onChange={(e) => setNewChannelData({ ...newChannelData, description: e.target.value })}
                                            placeholder="What's this channel about?"
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-900 dark:text-gray-100 transition-all"
                                        />
                                    </div>

                                    {/* ✨ NEW: Channel Visibility Info */}
                                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900 rounded-xl p-4">
                                        <h4 className="text-sm font-bold text-blue-900 dark:text-blue-300 mb-2">Channel Visibility</h4>
                                        <div className="space-y-2 text-xs text-blue-800 dark:text-blue-200">
                                            <p>
                                                <span className="font-bold">🌐 Public:</span> Skip member selection - all workspace members can view and join
                                            </p>
                                            <p>
                                                <span className="font-bold">🔒 Private:</span> Select specific members - only they can view and participate
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-0">
                                    <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-100 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-300 flex items-center gap-2">
                                        <span>#</span>
                                        <span>Adding members to <strong>#{newChannelData.name}</strong> (Private Channel)</span>
                                    </div>
                                    <div className="max-h-[300px] overflow-y-auto p-2">
                                        {workspaceMembers.map(member => (
                                            <label key={member._id} className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-xl cursor-pointer transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                                        checked={selectedChannelMembers.includes(member._id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedChannelMembers([...selectedChannelMembers, member._id]);
                                                            } else {
                                                                setSelectedChannelMembers(selectedChannelMembers.filter(id => id !== member._id));
                                                            }
                                                        }}
                                                    />
                                                    <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium text-xs">
                                                        {(member?.name || member?.username || 'U').charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-sm text-gray-900 dark:text-gray-200">{member?.name || member?.username || 'Unknown'}</div>
                                                        <div className="text-xs text-gray-500 dark:text-gray-400">{member?.email || ''}</div>
                                                    </div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="px-8 py-5 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
                                <button onClick={() => {
                                    setShowCreateChannelModal(false);
                                    setNewChannelData({ name: "", description: "" });
                                    setCreateStep(1);
                                    setSelectedChannelMembers([]);
                                }} className="px-6 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors">Cancel</button>

                                {createStep === 1 ? (
                                    <>
                                        <button
                                            onClick={() => setCreateStep(2)}
                                            disabled={!newChannelData.name}
                                            className="px-6 py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Add Specific Members
                                        </button>
                                        <button
                                            onClick={handleCreateChannel}
                                            disabled={!newChannelData.name}
                                            className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md hover:shadow-lg transition-all transform active:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Create Public Channel
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => {
                                                setCreateStep(1);
                                                setSelectedChannelMembers([]);
                                            }}
                                            className="px-6 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors"
                                        >
                                            Back
                                        </button>
                                        <button
                                            onClick={handleCreateChannel}
                                            disabled={selectedChannelMembers.length === 0}
                                            className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md hover:shadow-lg transition-all transform active:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Create Private Channel
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default ChannelsPanel;
