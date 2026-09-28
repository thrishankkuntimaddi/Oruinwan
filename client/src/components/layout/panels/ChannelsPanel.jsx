import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Hash, Search, Trash2, X, Check, Settings2, Lock, Megaphone, UserPlus } from 'lucide-react';
import WorkspacePanel, { PanelEmpty } from "../WorkspacePanel";
import "../shell.css";
import { useWorkspace } from "../../../contexts/WorkspaceContext";
import { useToast } from "../../../contexts/ToastContext";
import api from '@services/api';
import ConfirmationModal from "../../../shared/components/ui/ConfirmationModal";
import { useSocket } from "../../../contexts/SocketContext";
import { useNotifications } from "../../../features/notifications/NotificationsContext";
import CreateChannelModal from "../../../features/messaging/CreateChannelModal";
import logger from '../../../utils/logger';

const ChannelsPanel = ({ title, isMobile = false }) => {
    const navigate = useNavigate();
    const { workspaceId, id: channelId } = useParams();
    const { activeWorkspace } = useWorkspace();
    const { showToast } = useToast();
    const { socket, addChannelListener } = useSocket();
    const notif = useNotifications();
    const seedConversationUnread = notif?.seedConversationUnread;

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
                seedConversationUnread?.('channel', response.data.channels.map(ch => ({ id: ch._id, unread: ch.unreadCount || 0 })));
                setIsLoadingChannels(false);
            } catch (err) {
                logger.error('❌ Error fetching channels:', err);
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
                            isDiscoverable: ch.isDiscoverable ?? true,
                            isMember: ch.isMember ?? false,
                            description: ch.description || '',
                            canDelete: !ch.isDefault,
                            workspaceId: ch.workspace
                        }));
                        setChannels(mappedChannels);
                    } catch (err) {
                        logger.error('Error refreshing channels:', err);
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
                        .catch(err => logger.error('Error fetching invited channel:', err));
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
            logger.error('Error deleting channels:', err);
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

    const userRole = activeWorkspace?.role?.toLowerCase() || '';
    const canCreateChannel = userRole === 'admin' || userRole === 'owner' || activeWorkspace?.settings?.allowMemberChannelCreation !== false;
    const openCreate = () => {
        if (!canCreateChannel) { showToast('Channel creation is disabled for members in this workspace', 'warning'); return; }
        setShowCreateChannelModal(true);
    };

    const renderItem = (item) => {
        const isSelected = selectedItems.has(item.id);
        const isActive = channelId === item.id;
        const unread = notif ? notif.getUnread('channel', item.id) : 0;
        const mentioned = notif ? notif.hasMention('channel', item.id) : false;
        const isAnnouncements = (item.label || '').toLowerCase() === 'announcements';

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

        const classes = ['gl-item', 'gl-shell-row'];
        if (isMobile) classes.push('gl-shell-row--tall');
        if (isActive && !isSelectionMode) classes.push('is-active');
        if (isSelected) classes.push('is-selected');
        if (unread > 0) classes.push('is-unread');

        return (
            <div
                key={item.id}
                role="link"
                tabIndex={0}
                className={classes.join(' ')}
                aria-current={isActive && !isSelectionMode ? 'page' : undefined}
                onClick={handleClick}
                onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleClick(e); } }}
                style={{ WebkitTapHighlightColor: 'transparent' }}
            >
                {isSelectionMode && !item.isDefault && (
                    <span className={`gl-shell-check${isSelected ? ' is-on' : ''}`} aria-hidden="true">
                        {isSelected && <Check size={10} strokeWidth={3} />}
                    </span>
                )}

                <span className={`gl-shell-glyph${isAnnouncements ? ' gl-shell-glyph--accent' : ''}`} aria-hidden="true"
                    style={isMobile ? { width: '30px', height: '30px' } : undefined}
                >
                    {item.isPrivate ? (
                        <Lock size={isMobile ? 14 : 11} strokeWidth={2.5} />
                    ) : isAnnouncements ? (
                        <Megaphone size={isMobile ? 14 : 11} strokeWidth={2.5} />
                    ) : (
                        <Hash size={isMobile ? 14 : 11} strokeWidth={2.5} />
                    )}
                </span>

                <span className="gl-shell-row-label">
                    {(item.label || 'Unnamed Channel').replace(/^#/, '')}
                </span>

                {item.isMember === false && item.isDiscoverable && (
                    <span className="gl-shell-join" title="Click to join">
                        <UserPlus size={10} strokeWidth={2.5} />
                    </span>
                )}

                {unread > 0 && !isSelectionMode && (
                    <span
                        className={`gl-shell-unread${mentioned ? ' is-mention' : ''}`}
                        title={mentioned ? 'You were mentioned' : `${unread} unread`}
                    >
                        {mentioned ? '@' : ''}{unread > 99 ? '99+' : unread}
                    </span>
                )}
            </div>
        );
    };

    return (
        <WorkspacePanel
            icon={Hash}
            title="Channels"
            subtitle={activeWorkspace?.name || title || 'Workspace'}
            actions={(
                <>
                    <button
                        type="button"
                        className="gl-icon-btn"
                        onClick={() => { setIsSelectionMode(!isSelectionMode); if (isSelectionMode) setSelectedItems(new Set()); }}
                        aria-pressed={isSelectionMode}
                        title="Manage Channels"
                        aria-label="Manage channels"
                    >
                        <Settings2 size={15} />
                    </button>
                    <button
                        type="button"
                        className="gl-icon-btn"
                        onClick={openCreate}
                        disabled={!canCreateChannel}
                        title="Create Channel"
                        aria-label="Create channel"
                    >
                        <Plus size={16} />
                    </button>
                </>
            )}
            tools={(
                <div className="gl-search">
                    <Search size={13} />
                    <input
                        type="text"
                        className="gl-input"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search channels..."
                        aria-label="Search channels"
                    />
                </div>
            )}
            bodyClassName="custom-scrollbar"
            bodyProps={{ style: { paddingTop: isSelectionMode ? 0 : undefined } }}
        >
            {isSelectionMode && (
                <div className="gl-shell-selbar">
                    <span>{selectedItems.size} selected</span>
                    <div style={{ display: 'flex', gap: '2px' }}>
                        <button type="button" className="gl-icon-btn is-danger" onClick={() => setShowDeleteConfirm(true)} disabled={selectedItems.size === 0}
                            title="Delete Selected" aria-label="Delete selected">
                            <Trash2 size={14} />
                        </button>
                        <button type="button" className="gl-icon-btn" onClick={() => { setIsSelectionMode(false); setSelectedItems(new Set()); }}
                            title="Cancel" aria-label="Cancel selection">
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}

            {isLoadingChannels ? (
                <div aria-busy="true" aria-label="Loading channels" style={{ paddingTop: '6px' }}>
                    {[70, 50, 85, 60, 75, 45].map((w, i) => (
                        <div key={i} className="gl-shell-skel"><i /><i style={{ width: `${w}%` }} /></div>
                    ))}
                </div>
            ) : sortedChannels.length > 0 ? (
                <>
                    <div className="gl-section-label">
                        <span style={{ flex: 1 }}>All channels</span>
                        <span className="gl-count">{sortedChannels.length}</span>
                    </div>
                    {sortedChannels.map(renderItem)}
                </>
            ) : searchQuery ? (
                <PanelEmpty icon={Search} title={<>No results for &ldquo;{searchQuery}&rdquo;</>} text="Try a different search term" />
            ) : (
                <PanelEmpty
                    icon={Hash}
                    title="No channels yet"
                    text="Create a channel to start collaborating"
                    action={canCreateChannel ? (
                        <button type="button" className="gl-btn gl-btn--primary gl-btn--sm" onClick={() => setShowCreateChannelModal(true)}>
                            <Plus size={13} /> Create Channel
                        </button>
                    ) : null}
                />
            )}

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
        </WorkspacePanel>
    );
};

export default ChannelsPanel;
