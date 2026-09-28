import React, { useState, useEffect, useCallback, useRef } from "react";
import UserAvatarImage from '../../../shared/components/ui/UserAvatarImage';
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Plus, Search, Trash2, Check, Megaphone, Settings2, X, MessageSquare } from "lucide-react";
import WorkspacePanel, { PanelEmpty } from "../WorkspacePanel";
import "../shell.css";
import { useWorkspace } from "../../../contexts/WorkspaceContext";
import { useSocket } from "../../../contexts/SocketContext";
import { useToast } from "../../../contexts/ToastContext";
import { useNotifications } from "../../../features/notifications/NotificationsContext";
import { messageService } from "../../../services/messageService";
import NewDMModal from "../../../features/messaging/NewDMModal";
import BroadcastModal from "../../../features/messaging/BroadcastModal";
import ConfirmationModal from "../../../shared/components/ui/ConfirmationModal";
import api from '@services/api';
import logger from '../../../utils/logger';

const MessagesPanel = ({ title, isMobile = false }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { workspaceId, dmId, channelId } = useParams();
    const { activeWorkspace } = useWorkspace();
    const { showToast } = useToast();
    const notif = useNotifications();
    const seedConversationUnread = notif?.seedConversationUnread;

    const [searchQuery, setSearchQuery] = useState("");
    const [reloadKey, setReloadKey] = useState(0);
    const [showCreateDM, setShowCreateDM] = useState(false);
    const [showBroadcast, setShowBroadcast] = useState(false);
    const [broadcasts, setBroadcasts] = useState([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [filter, setFilter] = useState("all");

    
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedItems, setSelectedItems] = useState(new Set());

    
    const activeChatId = dmId || channelId || null;

    const [contacts, setContacts] = useState([]);
    const contactsRef = useRef(contacts);
    contactsRef.current = contacts;
    const [isLoading, setIsLoading] = useState(false);

    const { socket } = useSocket();

    
    
    const sanitizePreview = (text) => {
        if (!text) return '';
        if (text.startsWith('\u{1F512}')) return ''; 
        return text;
    };

    // Previews of encrypted messages are decrypted here, in the browser.
    const decryptPreviews = useCallback(async (items) => {
        const { decryptTextOrNull } = await import('../../../services/messageEncryptionService');
        const results = await Promise.all(items.filter(i => i.preview?.ciphertext).map(async (i) => {
            const text = await decryptTextOrNull(i.preview.ciphertext, i.preview.messageIv, i.id, 'dm');
            return [i.id, text || 'Encrypted message'];
        }));
        if (!results.length) return;
        const byId = new Map(results);
        setContacts(prev => prev.map(c => byId.has(c.id) ? { ...c, lastMessage: byId.get(c.id) } : c));
    }, []);

    // Keep previews and ordering live: newest conversation first.
    useEffect(() => {
        if (!socket) return undefined;
        const LABELS = { image: '📷 Photo', video: '🎬 Video', voice: '🎵 Voice note', file: '📎 File', poll: '📊 Poll', contact: '👤 Contact', meeting: '📅 Meeting', checklist: '☑️ Checklist' };
        const onNewMessage = async (msg) => {
            const dmId = String(msg?.dm?._id || msg?.dm || '');
            if (!dmId || msg.parentId) return;
            let text = LABELS[msg.type] || '';
            if (!text && msg.payload?.ciphertext) {
                const { decryptTextOrNull } = await import('../../../services/messageEncryptionService');
                text = (await decryptTextOrNull(msg.payload.ciphertext, msg.payload.messageIv, dmId, 'dm')) || 'Encrypted message';
            }
            setContacts(prev => {
                const idx = prev.findIndex(c => String(c.id) === dmId);
                if (idx === -1) return prev;
                const updated = { ...prev[idx], lastMessage: text || prev[idx].lastMessage, lastMessageId: msg._id ? String(msg._id) : prev[idx].lastMessageId };
                return [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
            });
        };
        socket.on('new-message', onNewMessage);
        return () => socket.off('new-message', onNewMessage);
    }, [socket]);

    useEffect(() => {
        const loadDMs = async () => {
            if (!workspaceId) return;
            if (!contactsRef.current.length) setIsLoading(true); // quiet refresh when a list is already shown
            try {
                const res = await api.get(`/api/v2/messages/workspace/${workspaceId}/dms`);
                const formatted = (res.data.sessions || []).map(session => {
                    
                    const user = session.otherUser;
                    let initialStatus = "offline";
                    if (user?.isOnline) {
                        initialStatus = user.userStatus || "active"; 
                    }

                    return {
                        id: session.id,
                        userId: session.otherUser?._id || session.otherUser?.id, 
                        name: session.otherUser?.username || "User",
                        avatar: session.otherUser?.profilePicture,
                        status: initialStatus,
                        unread: session.unreadCount || 0,
                        lastMessage: session.lastMessagePreview ? "" : (sanitizePreview(session.lastMessage) || ""),
                        preview: session.lastMessagePreview,
                        lastMessageId: session.lastMessageId ? String(session.lastMessageId) : null,
                        type: "dm"
                    };
                });
                setContacts(formatted);
                decryptPreviews(formatted);
                seedConversationUnread?.('dm', formatted.map(c => ({ id: c.id, unread: c.unread })));
            } catch (err) {
                logger.error("Failed to load DMs:", err);
            } finally {
                setIsLoading(false);
            }
        };

        loadDMs();
    }, [workspaceId, activeWorkspace?.currentUserId, reloadKey]);

    // A deleted last message must not linger as the preview: reload the list
    // (the server skips deleted messages) when the deleted one was a preview.
    useEffect(() => {
        if (!socket) return undefined;
        const onDeleted = (e) => {
            const id = String(e?.messageId || '');
            if (!id) return;
            const hit = contactsRef.current.some(c => c.lastMessageId === id || (e.dm && String(c.id) === String(e.dm) && !c.lastMessageId));
            if (hit) setReloadKey(k => k + 1);
        };
        socket.on('message-deleted', onDeleted);
        socket.on('message:deleted', onDeleted);
        return () => { socket.off('message-deleted', onDeleted); socket.off('message:deleted', onDeleted); };
    }, [socket]);

    
    useEffect(() => {
        if (!socket) return;

        const handleStatusChange = ({ userId, status }) => {
            setContacts(prev => prev.map(contact => {
                
                if (String(contact.userId) === String(userId)) {
                    return { ...contact, status: status };
                }
                return contact;
            }));
        };

        socket.on("user-status-changed", handleStatusChange);

        return () => {
            socket.off("user-status-changed", handleStatusChange);
        };
    }, [socket]);

    const displayList = [...broadcasts, ...contacts];

    const unreadFor = (item) => (item.type === 'dm' && notif ? notif.getUnread('dm', item.id) : item.unread || 0);
    const totalUnread = displayList.reduce((n, item) => n + (unreadFor(item) > 0 ? 1 : 0), 0);

    const filteredList = displayList.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = filter === "all" || (filter === "unread" && unreadFor(item) > 0);
        return matchesSearch && matchesFilter;
    });

    const handleStartDM = async (selectedUser) => {
        setShowCreateDM(false);
        const targetUserId = selectedUser._id || selectedUser.id;
        if (!targetUserId || !workspaceId) return;

        try {
            
            
            
            const resolveRes = await api.get(
                `/api/v2/messages/workspace/${workspaceId}/dm/resolve/${targetUserId}`
            );
            if (resolveRes.data?.success) {
                const sessionId = resolveRes.data.dmSessionId;
                navigate(`/workspace/${workspaceId}/messages/dm/${sessionId}`);
            } else {
                
                navigate(`/workspace/${workspaceId}/messages/dm/${targetUserId}`);
            }
        } catch (err) {
            logger.error('[MessagesPanel] Failed to resolve DM session:', err);
            showToast('Could not start conversation. Please try again.', 'error');
        }
    };

    const handleBroadcast = () => {
        setShowBroadcast(true);
    };

    const handleSendBroadcast = async (selectedItems, message) => {
        try {
            
            const userRecipients = selectedItems.filter(item => item.type === 'dm' || item.type === 'member');
            const channelRecipients = selectedItems.filter(item => item.type === 'channel');

            const promises = [];

            
            if (userRecipients.length > 0) {
                const userIds = userRecipients.map(u => u.id); 
                promises.push(messageService.sendBroadcast(workspaceId, userIds, message));
            }

            
            if (channelRecipients.length > 0) {
                const channelPromises = channelRecipients.map(ch =>
                    api.post('/api/v2/messages/channel', {
                        channelId: ch.id,
                        text: message,
                        attachments: []
                    })
                );
                promises.push(...channelPromises);
            }

            await Promise.all(promises);

            showToast(`Broadcast sent to ${selectedItems.length} recipient(s) successfully!`, 'success');
            setShowBroadcast(false);

            
            const res = await api.get(`/api/v2/messages/workspace/${workspaceId}/dms`);
            const formatted = (res.data.sessions || []).map(session => {
                const user = session.otherUser;
                let initialStatus = "offline";
                if (user?.isOnline) {
                    initialStatus = user.userStatus || "active";
                }

                return {
                    id: session.id,
                    userId: session.otherUser?._id || session.otherUser?.id,
                    name: session.otherUser?.username || "User",
                    avatar: session.otherUser?.profilePicture,
                    status: initialStatus,
                    unread: session.unreadCount || 0,
                    lastMessage: sanitizePreview(session.lastMessage) || "",
                    type: "dm"
                };
            });
            setContacts(formatted);
        } catch (err) {
            logger.error('Failed to send broadcast:', err);
            showToast('Failed to send broadcast. Please try again.', 'error');
            throw err; 
        }
    };

    const handleDeleteSelected = () => {
        setContacts(prev => prev.filter(c => !selectedItems.has(c.id)));
        setBroadcasts(prev => prev.filter(b => !selectedItems.has(b.id)));
        setSelectedItems(new Set());
        setIsSelectionMode(false);
        setShowDeleteConfirm(false);
    };

    const PRESENCE = { active: 'is-online', online: 'is-online', away: 'is-away', dnd: 'is-busy', busy: 'is-busy' };
    const avatarSize = isMobile ? 40 : 30;

    const renderItem = (item) => {
        const isBroadcast = item.type === "broadcast";
        const isSelected = selectedItems.has(item.id);

        const isActive = activeChatId === item.id ||
            (isBroadcast && location.pathname.includes(`/broadcast/${item.id}`)) ||
            (!isBroadcast && location.pathname.includes(`/dm/${item.id}`));

        const handleClick = (e) => {
            if (isSelectionMode) {
                e.stopPropagation();
                const newSelected = new Set(selectedItems);
                if (newSelected.has(item.id)) {
                    newSelected.delete(item.id);
                } else {
                    newSelected.add(item.id);
                }
                setSelectedItems(newSelected);
            } else {
                const targetPath = isBroadcast
                    ? `/workspace/${workspaceId}/messages/broadcast/${item.id}`
                    : `/workspace/${workspaceId}/messages/dm/${item.id}`;

                navigate(targetPath);
            }
        };

        const unread = unreadFor(item);
        const classes = ['gl-item', 'gl-shell-row', 'gl-shell-row--tall'];
        if (isActive && !isSelectionMode) classes.push('is-active');
        if (isSelected) classes.push('is-selected');
        if (unread > 0) classes.push('is-unread');

        return (
            <div
                key={item.id}
                data-testid={item.type === 'dm' ? 'dm-row' : undefined}
                role="link"
                tabIndex={0}
                className={classes.join(' ')}
                aria-current={isActive && !isSelectionMode ? 'page' : undefined}
                onClick={handleClick}
                onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleClick(e); } }}
                style={{ gap: '10px', minHeight: isMobile ? '60px' : undefined, WebkitTapHighlightColor: 'transparent' }}
            >
                {isSelectionMode && (
                    <span className={`gl-shell-check${isSelected ? ' is-on' : ''}`} aria-hidden="true">
                        {isSelected && <Check size={10} strokeWidth={3} />}
                    </span>
                )}
                <span className="gl-shell-avatar">
                    {isBroadcast ? (
                        <span className="gl-shell-avatar-round" style={{ width: avatarSize, height: avatarSize }}>
                            <Megaphone size={isMobile ? 17 : 13} />
                        </span>
                    ) : (
                        <UserAvatarImage
                            userId={item.userId}
                            name={item.name}
                            src={item.avatar}
                            size={avatarSize}
                            initialStyle={{
                                background: isActive ? 'var(--gl-accent-soft)' : 'var(--bg-active)',
                                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                                fontFamily: 'var(--font)',
                            }}
                        />
                    )}
                    {!isBroadcast && <span className={`gl-shell-presence ${PRESENCE[item.status] || ''}`} aria-hidden="true" />}
                </span>
                <span className="gl-shell-row-text">
                    <span className="gl-shell-row-label">{item.name}</span>
                    <span className="gl-shell-row-sub">{item.lastMessage || 'No messages yet'}</span>
                </span>

                {unread > 0 && !isSelectionMode && (
                    <span className="gl-shell-unread" title={`${unread} unread`}>
                        {unread > 99 ? '99+' : unread}
                    </span>
                )}
            </div>
        );
    };

    return (
        <WorkspacePanel
            icon={MessageSquare}
            title="Messages"
            subtitle={activeWorkspace?.name || title || 'Direct messages'}
            actions={(
                <>
                    <button type="button" className="gl-icon-btn"
                        onClick={() => { setIsSelectionMode(!isSelectionMode); if (isSelectionMode) setSelectedItems(new Set()); }}
                        aria-pressed={isSelectionMode}
                        title="Manage Messages"
                        aria-label="Manage messages"
                    ><Settings2 size={15} /></button>
                    <button type="button" className="gl-icon-btn"
                        onClick={handleBroadcast}
                        title="New Broadcast"
                        aria-label="New broadcast"
                    ><Megaphone size={15} /></button>
                    <button type="button" className="gl-icon-btn"
                        onClick={() => setShowCreateDM(true)}
                        title="New Message"
                        aria-label="New message"
                    ><Plus size={16} /></button>
                </>
            )}
            tools={(
                <>
                    <div className="gl-search">
                        <Search size={13} />
                        <input type="text" className="gl-input" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search messages..." aria-label="Search conversations" />
                    </div>
                    <div className="gl-tabs" role="tablist" aria-label="Filter conversations">
                        {['all', 'unread'].map(f => (
                            <button key={f} type="button" role="tab" className="gl-tab" aria-selected={filter === f} onClick={() => setFilter(f)}>
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                                {f === 'unread' && totalUnread > 0 && <span className="gl-count" style={{ color: 'var(--accent)', background: 'var(--gl-accent-soft)' }}>{totalUnread > 99 ? '99+' : totalUnread}</span>}
                            </button>
                        ))}
                    </div>
                </>
            )}
            bodyClassName="custom-scrollbar"
            bodyProps={{ style: { paddingTop: isSelectionMode ? 0 : undefined } }}
        >
            {isSelectionMode && (
                <div className="gl-shell-selbar">
                    <span>{selectedItems.size} selected</span>
                    <div style={{ display: 'flex', gap: '2px' }}>
                        <button type="button" className="gl-icon-btn is-danger" onClick={() => setShowDeleteConfirm(true)} disabled={selectedItems.size === 0}
                            title="Delete" aria-label="Delete selected">
                            <Trash2 size={14} /></button>
                        <button type="button" className="gl-icon-btn" onClick={() => { setIsSelectionMode(false); setSelectedItems(new Set()); }}
                            title="Cancel" aria-label="Cancel selection">
                            <X size={14} /></button>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div aria-busy="true" aria-label="Loading conversations" style={{ paddingTop: '6px' }}>
                    {[60, 75, 50, 85, 65].map((w, i) => (
                        <div key={i} className="gl-shell-skel is-round"><i /><i style={{ width: `${w}%` }} /></div>
                    ))}
                </div>
            ) : filteredList.length > 0 ? (
                filteredList.map(renderItem)
            ) : searchQuery ? (
                <PanelEmpty icon={Search} title="No conversations found" text="Try a different name." />
            ) : filter === 'unread' ? (
                <PanelEmpty icon={MessageSquare} title="You're all caught up" text="No unread conversations." />
            ) : (
                <PanelEmpty
                    icon={MessageSquare}
                    title="No conversations yet"
                    text="Start a direct message with someone in this workspace."
                    action={(
                        <button type="button" className="gl-btn gl-btn--primary gl-btn--sm" onClick={() => setShowCreateDM(true)}>
                            <Plus size={13} /> New message
                        </button>
                    )}
                />
            )}

            {}
            <ConfirmationModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDeleteSelected}
                title="Delete Conversations?"
                message={`Are you sure you want to delete ${selectedItems.size} selected conversation(s)? This action cannot be undone.`}
                confirmText="Delete Conversations"
            />

            {}
            {showCreateDM && (
                <NewDMModal
                    onClose={() => setShowCreateDM(false)}
                    onStart={handleStartDM}
                />
            )}

            {}
            {showBroadcast && (
                <BroadcastModal
                    workspaceId={workspaceId}
                    onClose={() => setShowBroadcast(false)}
                    onSendBroadcast={handleSendBroadcast}
                />
            )}
        </WorkspacePanel>
    );
};

export default MessagesPanel;
