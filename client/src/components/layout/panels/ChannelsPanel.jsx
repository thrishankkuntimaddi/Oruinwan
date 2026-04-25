import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Hash, Search, Trash2, X, CheckSquare, Settings2, Lock, Megaphone, UserPlus } from 'lucide-react';
import { useWorkspace } from "../../../contexts/WorkspaceContext";
import { useToast } from "../../../contexts/ToastContext";
import api from '@services/api';
import ConfirmationModal from "../../../shared/components/ui/ConfirmationModal";
import { useSocket } from "../../../contexts/SocketContext"; 
import CreateChannelModal from "../../messagesComp/CreateChannelModal";

const ChannelsPanel = ({ title, isMobile = false }) => {
    const navigate = useNavigate();
    const { workspaceId, id: channelId } = useParams();
    const { activeWorkspace } = useWorkspace();
    const { showToast } = useToast();
    const { socket, addChannelListener } = useSocket(); 

    const [searchQuery, setSearchQuery] = useState("");
    const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedItems, setSelectedItems] = useState(new Set());

    
    const [channels, setChannels] = useState([]);
    const [isLoadingChannels, setIsLoadingChannels] = useState(true);

    
    useEffect(() => {
        const fetchChannels = async () => {
            if (!workspaceId) return;

            try {
                setIsLoadingChannels(true);
                
                const response = await api.get(`/api/workspaces/${workspaceId}/channels`);

                
                const mappedChannels = response.data.channels.map(ch => ({
                    id: ch._id,
                    type: 'channel',
                    label: ch.name,
                    path: `/workspace/${workspaceId}/channel/${ch._id}`, 
                    isFavorite: ch.isDefault || false,
                    isPrivate: ch.isPrivate || false,
                    isDefault: ch.isDefault || false,
                    isDiscoverable: ch.isDiscoverable ?? true, 
                    isMember: ch.isMember ?? false, 
                    description: ch.description || '',
                    canDelete: !ch.isDefault, 
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

    
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && workspaceId) {
                
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

    
    
    

    
    useEffect(() => {
        if (!socket || !workspaceId) return;

        
        const handleChannelEvent = (eventType, data) => {

            switch (eventType) {
                case 'channel-created':
                    
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
                            
                            if (prev.some(ch => ch.id === newChannel.id)) return prev;
                            return [...prev, newChannel];
                        });
                        showToast(`New channel #${data.name} created!`, 'success');
                    }
                    break;

                case 'invited-to-channel':
                    
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
                    
                    if (data.channelId === channelId) {
                        navigate(`/workspace/${workspaceId}`);
                    }
                    break;

                case 'member-left':
                    
                    
                    if (String(data.userId) === String(channelId)) break; 
                    setChannels(prev => prev.filter(ch => ch.id !== data.channelId));
                    if (data.channelId === channelId) {
                        navigate(`/workspace/${workspaceId}`);
                    }
                    break;

                default:
                    break;
            }
        };

        
        const unsubscribe = addChannelListener(handleChannelEvent);

        return () => {
            unsubscribe();
        };
    }, [socket, workspaceId, channelId, navigate, showToast, addChannelListener]);

    
    const handleDeleteSelected = async () => {
        try {
            
            const deletableChannels = Array.from(selectedItems).filter(id => {
                const channel = channels.find(ch => ch.id === id);
                return channel && !channel.isDefault;
            });

            if (deletableChannels.length === 0) {
                showToast('Cannot delete default channels (#general, #announcements)', 'warning');
                setShowDeleteConfirm(false);
                return;
            }

            
            const isViewingDeletedChannel = channelId && deletableChannels.includes(channelId);

            
            const deletePromises = deletableChannels.map(id =>
                api.delete(`/api/channels/${id}`)
            );

            await Promise.all(deletePromises);

            
            if (isViewingDeletedChannel) {
                
                const remainingChannels = channels.filter(ch => !deletableChannels.includes(ch.id));
                if (remainingChannels.length > 0) {
                    navigate(remainingChannels[0].path);
                } else {
                    navigate(`/workspace/${workspaceId}`);
                }
            }

            
            setChannels(prev => prev.filter(ch => !deletableChannels.includes(ch.id)));

            
            setSelectedItems(new Set());
            setIsSelectionMode(false);
            setShowDeleteConfirm(false);

            
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
                    : 'var(--bg-active)',
            color: isActive ? '#b8956a' : item.isPrivate ? '#a78bfa' : 'var(--text-muted)',
        };

        return (
            <div
                onClick={handleClick}
                style={rowStyle}
                onMouseEnter={e => { if (!isActive && !isSelected) e.currentTarget.style.background = 'var(--bg-hover)'; }}
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

                    <span style={{ fontSize: '13px', fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Inter, system-ui, sans-serif' }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)' }}>
            {}
            <div style={{ height: isMobile ? '48px' : '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', background: 'var(--bg-base)', flexShrink: 0, borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <h2 style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', lineHeight: '1.2', fontFamily: 'Inter, system-ui, sans-serif' }}>
                        {activeWorkspace?.name || 'Channels'}
                    </h2>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, sans-serif' }}>Channels</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                        onClick={() => setIsSelectionMode(!isSelectionMode)}
                        style={{ padding: '6px', background: isSelectionMode ? 'rgba(184,149,106,0.1)' : 'transparent', border: isSelectionMode ? '1px solid rgba(184,149,106,0.2)' : '1px solid transparent', color: isSelectionMode ? '#b8956a' : 'rgba(228,228,228,0.4)', cursor: 'pointer', transition: 'all 150ms ease' }}
                        title="Manage Channels"
                        onMouseEnter={e => { if (!isSelectionMode) e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { if (!isSelectionMode) e.currentTarget.style.color = 'var(--text-muted)'; }}
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
                        style={{ padding: '6px', background: 'transparent', border: '1px solid transparent', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 150ms ease' }}
                        title="Create Channel"
                        onMouseEnter={e => { e.currentTarget.style.color = '#b8956a'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                    >
                        <Plus size={18} />
                    </button>
                </div>
            </div>

            {}
            <div style={{ padding: '12px 16px 8px' }}>
                <div style={{ position: 'relative' }}>
                    <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={14} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search channels..."
                        style={{ width: '100%', paddingLeft: '32px', paddingRight: '12px', paddingTop: '7px', paddingBottom: '7px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box' }}
                    />
                </div>
            </div>

            {}
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
                            style={{ padding: '5px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} title="Cancel">
                            <X size={15} />
                        </button>
                    </div>
                </div>
            )}

            {}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 4px' }}>
                <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '4px 16px 8px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                    {activeWorkspace?.name || 'Workspace'} Channels
                </p>
                {isLoadingChannels ? (
                    <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {[70, 50, 85, 60, 75, 45].map((w, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px' }}>
                                <div style={{ width: '24px', height: '24px', background: 'var(--bg-active)', flexShrink: 0 }} />
                                <div style={{ height: '10px', background: 'var(--bg-active)', width: `${w}%` }} />
                            </div>
                        ))}
                    </div>
                ) : sortedChannels.length > 0 ? (
                    sortedChannels.map(channel => (
                        <Item key={channel.id} item={channel} />
                    ))
                ) : searchQuery ? (
                    <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                        <div style={{ width: '36px', height: '36px', background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                            <Search size={16} style={{ color: 'var(--text-muted)' }} />
                        </div>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, sans-serif' }}>No results for &ldquo;{searchQuery}&rdquo;</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'Inter, system-ui, sans-serif' }}>Try a different search term</p>
                    </div>
                ) : (
                    <div style={{ padding: '40px 16px', textAlign: 'center' }}>
                        <div style={{ width: '44px', height: '44px', background: 'rgba(184,149,106,0.08)', border: '1px solid rgba(184,149,106,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                            <Hash size={20} style={{ color: '#b8956a' }} />
                        </div>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', fontFamily: 'Inter, system-ui, sans-serif' }}>No channels yet</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.5', fontFamily: 'Inter, system-ui, sans-serif' }}>Create a channel to start collaborating</p>
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

            {}
            <ConfirmationModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDeleteSelected}
                title="Delete Channels?"
                message={`Are you sure you want to delete ${selectedItems.size} selected channel(s)? This action cannot be undone.`}
                confirmText="Delete Channels"
            />

            {}
            {showCreateChannelModal && (
                <CreateChannelModal
                    onClose={() => setShowCreateChannelModal(false)}
                    onCreated={(channel) => {
                        
                        const newChannel = {
                            id: channel._id,
                            type: 'channel',
                            label: channel.name,
                            path: `/workspace/${workspaceId}/channel/${channel._id}`,
                            isFavorite: false,
                            isPrivate: channel.isPrivate,
                            isDefault: false,
                            isDiscoverable: channel.isDiscoverable ?? true,
                            isMember: true, 
                            description: channel.description || '',
                            canDelete: true,
                            createdBy: channel.createdBy
                        };
                        setChannels(prev => [...prev, newChannel]);

                        
                        navigate(`/workspace/${workspaceId}/channel/${channel._id}`);
                    }}
                    workspaceId={workspaceId}
                />
            )}
        </div >
    );
};

export default ChannelsPanel;
