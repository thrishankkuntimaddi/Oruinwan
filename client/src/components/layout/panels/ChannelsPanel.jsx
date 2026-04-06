import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Hash, Search, Trash2, X, CheckSquare, Settings2, Lock, Megaphone, UserPlus } from 'lucide-react';
import { useWorkspace } from "../../../contexts/WorkspaceContext";
import { useToast } from "../../../contexts/ToastContext";
import api from '@services/api';
import ConfirmationModal from "../../../shared/components/ui/ConfirmationModal";
import { useSocket } from "../../../contexts/SocketContext"; // ✅ Use global socket
import CreateChannelModal from "../../messagesComp/CreateChannelModal";

const ChannelsPanel = ({ title, isMobile = false }) => {
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
                    isDiscoverable: ch.isDiscoverable ?? true, // Default to true for backward compatibility
                    isMember: ch.isMember ?? false, // Is current user a member
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

    // NOTE: Polling removed — real-time updates are handled by socket events below
    // (channel-created, invited-to-channel, removed-from-channel) and the
    // visibilitychange listener above covers tab-focus recovery.


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

                case 'member-left':
                    // Handles the current user leaving via exitChannel API
                    // (socket echoes 'member-left' after server processes exit)
                    if (String(data.userId) === String(channelId)) break; // wrong event shape guard
                    setChannels(prev => prev.filter(ch => ch.id !== data.channelId));
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
        const isActive = channelId === item.id;

        const handleClick = (e) => {
            if (isSelectionMode) {
                e.stopPropagation();
                if (item.isDefault) { showToast('Default channels cannot be deleted', 'warning'); return; }
                const newSelected = new Set(selectedItems);
                if (newSelected.has(item.id)) newSelected.delete(item.id);
                else newSelected.add(item.id);
                setSelectedItems(newSelected);
            } else {
                navigate(item.path);
            }
        };

        const rowStyle = {
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: isMobile ? '10px 14px' : '7px 12px',
            minHeight: isMobile ? '48px' : 'auto',
            margin: '1px 4px', cursor: 'pointer',
            background: isSelected
                ? 'rgba(184,149,106,0.12)'
                : isActive
                    ? 'rgba(184,149,106,0.08)'
                    : 'transparent',
            borderLeft: isActive ? '2px solid #b8956a' : '2px solid transparent',
            position: 'relative', transition: 'all 150ms ease',
            WebkitTapHighlightColor: 'transparent',
        };

        const iconBoxStyle = {
            width: isMobile ? '32px' : '26px', height: isMobile ? '32px' : '26px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            background: isActive
                ? 'rgba(184,149,106,0.15)'
                : item.isPrivate
                    ? 'rgba(139,92,246,0.1)'
                    : 'rgba(255,255,255,0.05)',
            color: isActive ? '#b8956a' : item.isPrivate ? '#a78bfa' : 'rgba(228,228,228,0.4)',
        };

        return (
            <div
                onClick={handleClick}
                style={rowStyle}
                onMouseEnter={e => { if (!isActive && !isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (!isActive && !isSelected) e.currentTarget.style.background = 'transparent'; }}
            >
                <div style={{ display: 'flex', alignItems: 'center', flex: 1, overflow: 'hidden', gap: '10px' }}>
                    {isSelectionMode && !item.isDefault && (
                        <div style={{ width: '14px', height: '14px', border: `1px solid ${isSelected ? '#b8956a' : 'rgba(255,255,255,0.2)'}`, background: isSelected ? '#b8956a' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {isSelected && <CheckSquare size={9} style={{ color: '#0c0c0c' }} />}
                        </div>
                    )}

                    <div style={iconBoxStyle}>
                        {item.isPrivate ? (
                            <Lock size={isMobile ? 14 : 12} strokeWidth={2.5} />
                        ) : (item.label || '').toLowerCase() === 'announcements' ? (
                            <Megaphone size={isMobile ? 14 : 12} strokeWidth={2.5} />
                        ) : (
                            <Hash size={isMobile ? 14 : 12} strokeWidth={2.5} />
                        )}
                    </div>

                    <span style={{ fontSize: '13px', fontWeight: isActive ? 600 : 400, color: isActive ? '#e4e4e4' : 'rgba(228,228,228,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Inter, system-ui, sans-serif' }}>
                        {(item.label || 'Unnamed Channel').replace(/^#/, '')}
                    </span>

                    {!item.isMember && item.isDiscoverable && (
                        <div style={{ marginLeft: '4px', padding: '2px', background: 'rgba(184,149,106,0.1)' }} title="Click to join">
                            <UserPlus size={10} style={{ color: '#b8956a' }} strokeWidth={2.5} />
                        </div>
                    )}
                </div>
            </div>
        );
    };


    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0c0c0c' }}>
            {/* Header */}
            <div style={{ height: isMobile ? '48px' : '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', background: '#0c0c0c', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <h2 style={{ fontWeight: 700, fontSize: '14px', color: '#e4e4e4', lineHeight: '1.2', fontFamily: 'Inter, system-ui, sans-serif' }}>
                        {activeWorkspace?.name || 'Channels'}
                    </h2>
                    <span style={{ fontSize: '10px', color: 'rgba(228,228,228,0.3)', fontFamily: 'Inter, system-ui, sans-serif' }}>Channels</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                        onClick={() => setIsSelectionMode(!isSelectionMode)}
                        style={{ padding: '6px', background: isSelectionMode ? 'rgba(184,149,106,0.1)' : 'transparent', border: isSelectionMode ? '1px solid rgba(184,149,106,0.2)' : '1px solid transparent', color: isSelectionMode ? '#b8956a' : 'rgba(228,228,228,0.4)', cursor: 'pointer', transition: 'all 150ms ease' }}
                        title="Manage Channels"
                        onMouseEnter={e => { if (!isSelectionMode) e.currentTarget.style.color = '#e4e4e4'; }}
                        onMouseLeave={e => { if (!isSelectionMode) e.currentTarget.style.color = 'rgba(228,228,228,0.4)'; }}
                    >
                        <Settings2 size={18} />
                    </button>
                    <button
                        onClick={() => {
                            const userRole = activeWorkspace?.role?.toLowerCase() || '';
                            const isAdmin = userRole === 'admin' || userRole === 'owner';
                            const canCreateChannel = isAdmin || activeWorkspace?.settings?.allowMemberChannelCreation !== false;
                            if (!canCreateChannel) { showToast('Channel creation is disabled for members in this workspace', 'warning'); return; }
                            setShowCreateChannelModal(true);
                        }}
                        disabled={(() => { const userRole = activeWorkspace?.role?.toLowerCase() || ''; const isAdmin = userRole === 'admin' || userRole === 'owner'; return !isAdmin && activeWorkspace?.settings?.allowMemberChannelCreation === false; })()}
                        style={{ padding: '6px', background: 'transparent', border: '1px solid transparent', color: 'rgba(228,228,228,0.4)', cursor: 'pointer', transition: 'all 150ms ease' }}
                        title="Create Channel"
                        onMouseEnter={e => { e.currentTarget.style.color = '#b8956a'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(228,228,228,0.4)'; }}
                    >
                        <Plus size={18} />
                    </button>
                </div>
            </div>

            {/* Search */}
            <div style={{ padding: '12px 16px 8px' }}>
                <div style={{ position: 'relative' }}>
                    <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(228,228,228,0.3)' }} size={14} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search channels..."
                        style={{ width: '100%', paddingLeft: '32px', paddingRight: '12px', paddingTop: '7px', paddingBottom: '7px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#e4e4e4', fontSize: '12px', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box' }}
                    />
                </div>
            </div>

            {/* Selection Mode Header */}
            {isSelectionMode && (
                <div style={{ padding: '8px 16px', background: 'rgba(184,149,106,0.08)', borderBottom: '1px solid rgba(184,149,106,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#b8956a', fontFamily: 'Inter, system-ui, sans-serif' }}>{selectedItems.size} selected</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setShowDeleteConfirm(true)} disabled={selectedItems.size === 0}
                            style={{ padding: '5px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', opacity: selectedItems.size === 0 ? 0.4 : 1 }}
                            title="Delete Selected">
                            <Trash2 size={15} />
                        </button>
                        <button onClick={() => { setIsSelectionMode(false); setSelectedItems(new Set()); }}
                            style={{ padding: '5px', background: 'transparent', border: 'none', color: 'rgba(228,228,228,0.4)', cursor: 'pointer' }} title="Cancel">
                            <X size={15} />
                        </button>
                    </div>
                </div>
            )}

            {/* Channel List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 4px' }}>
                <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(228,228,228,0.3)', padding: '4px 16px 8px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                    {activeWorkspace?.name || 'Workspace'} Channels
                </p>
                {isLoadingChannels ? (
                    <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {[70, 50, 85, 60, 75, 45].map((w, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px' }}>
                                <div style={{ width: '24px', height: '24px', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />
                                <div style={{ height: '10px', background: 'rgba(255,255,255,0.06)', width: `${w}%` }} />
                            </div>
                        ))}
                    </div>
                ) : sortedChannels.length > 0 ? (
                    sortedChannels.map(channel => (
                        <Item key={channel.id} item={channel} />
                    ))
                ) : searchQuery ? (
                    <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                        <div style={{ width: '36px', height: '36px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                            <Search size={16} style={{ color: 'rgba(228,228,228,0.3)' }} />
                        </div>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(228,228,228,0.5)', fontFamily: 'Inter, system-ui, sans-serif' }}>No results for &ldquo;{searchQuery}&rdquo;</p>
                        <p style={{ fontSize: '11px', color: 'rgba(228,228,228,0.25)', marginTop: '4px', fontFamily: 'Inter, system-ui, sans-serif' }}>Try a different search term</p>
                    </div>
                ) : (
                    <div style={{ padding: '40px 16px', textAlign: 'center' }}>
                        <div style={{ width: '44px', height: '44px', background: 'rgba(184,149,106,0.08)', border: '1px solid rgba(184,149,106,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                            <Hash size={20} style={{ color: '#b8956a' }} />
                        </div>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(228,228,228,0.6)', marginBottom: '4px', fontFamily: 'Inter, system-ui, sans-serif' }}>No channels yet</p>
                        <p style={{ fontSize: '11px', color: 'rgba(228,228,228,0.3)', marginBottom: '16px', lineHeight: '1.5', fontFamily: 'Inter, system-ui, sans-serif' }}>Create a channel to start collaborating</p>
                        {(() => {
                            const userRole = activeWorkspace?.role?.toLowerCase() || '';
                            const isAdmin = userRole === 'admin' || userRole === 'owner';
                            const canCreate = isAdmin || activeWorkspace?.settings?.allowMemberChannelCreation !== false;
                            return canCreate ? (
                                <button onClick={() => setShowCreateChannelModal(true)}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#b8956a', border: 'none', color: '#0c0c0c', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
                                    <Plus size={13} /> Create Channel
                                </button>
                            ) : null;
                        })()}
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
                            isDiscoverable: channel.isDiscoverable ?? true,
                            isMember: true, // Creator is always a member
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
