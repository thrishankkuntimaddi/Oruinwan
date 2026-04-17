import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Plus, Search, Trash2, CheckSquare, Megaphone, Settings2, X } from "lucide-react";
import { useWorkspace } from "../../../contexts/WorkspaceContext";
import { useSocket } from "../../../contexts/SocketContext";
import { useToast } from "../../../contexts/ToastContext";
import { messageService } from "../../../services/messageService";
import NewDMModal from "../../messagesComp/NewDMModal";
import BroadcastModal from "../../messagesComp/BroadcastModal";
import ConfirmationModal from "../../../shared/components/ui/ConfirmationModal";
import api from '@services/api';

const MessagesPanel = ({ title, isMobile = false }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { workspaceId, dmId, channelId } = useParams();
    const { activeWorkspace } = useWorkspace();
    const { showToast } = useToast();

    const [searchQuery, setSearchQuery] = useState("");
    const [showCreateDM, setShowCreateDM] = useState(false);
    const [showBroadcast, setShowBroadcast] = useState(false);
    const [broadcasts, setBroadcasts] = useState([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [filter, setFilter] = useState("all");

    // Selection Mode State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedItems, setSelectedItems] = useState(new Set());

    // ✅ CORRECT: Active chat derived from URL (single source of truth)
    const activeChatId = dmId || channelId || null;

    const [contacts, setContacts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const { socket } = useSocket();

    // Strip the raw E2EE placeholder that the API returns when it can't decrypt server-side.
    // The actual decrypted text is only available inside the open chat window.
    const sanitizePreview = (text) => {
        if (!text) return '';
        if (text.startsWith('\u{1F512}')) return ''; // '🔒 Encrypted message…'
        return text;
    };

    useEffect(() => {
        const loadDMs = async () => {
            if (!workspaceId) return;
            setIsLoading(true);
            try {
                const res = await api.get(`/api/v2/messages/workspace/${workspaceId}/dms`);
                const formatted = (res.data.sessions || []).map(session => {
                    // Determine initial status
                    const user = session.otherUser;
                    let initialStatus = "offline";
                    if (user?.isOnline) {
                        initialStatus = user.userStatus || "active"; // active, away, dnd
                    }

                    return {
                        id: session.id,
                        userId: session.otherUser?._id || session.otherUser?.id, // Store User ID for socket updates
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
                console.error("Failed to load DMs:", err);
            } finally {
                setIsLoading(false);
            }
        };

        loadDMs();
    }, [workspaceId, activeWorkspace?.currentUserId]);

    // Listen for status changes
    useEffect(() => {
        if (!socket) return;

        const handleStatusChange = ({ userId, status }) => {
            setContacts(prev => prev.map(contact => {
                // Check if this contact corresponds to the user who changed status
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

    const filteredList = displayList.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = filter === "all" || (filter === "unread" && item.unread > 0);
        return matchesSearch && matchesFilter;
    });

    const handleStartDM = async (selectedUser) => {
        setShowCreateDM(false);
        const targetUserId = selectedUser._id || selectedUser.id;
        if (!targetUserId || !workspaceId) return;

        try {
            // Resolve (or create) the DM session + E2EE keys BEFORE navigating
            // This is the same pattern used by Home.jsx and ensures non-owners can
            // start DMs with each other without hitting duplicate key errors.
            const resolveRes = await api.get(
                `/api/v2/messages/workspace/${workspaceId}/dm/resolve/${targetUserId}`
            );
            if (resolveRes.data?.success) {
                const sessionId = resolveRes.data.dmSessionId;
                navigate(`/workspace/${workspaceId}/messages/dm/${sessionId}`);
            } else {
                // Fallback: navigate with userId and let the auto-resolve handle it
                navigate(`/workspace/${workspaceId}/messages/dm/${targetUserId}`);
            }
        } catch (err) {
            console.error('[MessagesPanel] Failed to resolve DM session:', err);
            showToast('Could not start conversation. Please try again.', 'error');
        }
    };


    const handleBroadcast = () => {
        setShowBroadcast(true);
    };

    const handleSendBroadcast = async (selectedItems, message) => {
        try {
            // Separate users and channels
            const userRecipients = selectedItems.filter(item => item.type === 'dm' || item.type === 'member');
            const channelRecipients = selectedItems.filter(item => item.type === 'channel');

            const promises = [];

            // 1. Send to Users (DMs)
            if (userRecipients.length > 0) {
                const userIds = userRecipients.map(u => u.id); // Correctly extract 'id' property
                promises.push(messageService.sendBroadcast(workspaceId, userIds, message));
            }

            // 2. Send to Channels
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

            // Optionally refresh DM list to show new conversations
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
            console.error('Failed to send broadcast:', err);
            showToast('Failed to send broadcast. Please try again.', 'error');
            throw err; // Re-throw so BroadcastModal can handle it
        }
    };

    const handleDeleteSelected = () => {
        setContacts(prev => prev.filter(c => !selectedItems.has(c.id)));
        setBroadcasts(prev => prev.filter(b => !selectedItems.has(b.id)));
        setSelectedItems(new Set());
        setIsSelectionMode(false);
        setShowDeleteConfirm(false);
    };

    const Item = ({ item }) => {
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
                // ✅ CORRECT: Use React Router navigation only
                // Keep sidebar context: DMs from Messages panel should stay in Messages view
                const targetPath = isBroadcast
                    ? `/workspace/${workspaceId}/messages/broadcast/${item.id}`
                    : `/workspace/${workspaceId}/messages/dm/${item.id}`;

                navigate(targetPath);
            }
        };

        const rowStyle = {
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: isMobile ? '10px 14px' : '8px 10px',
            minHeight: isMobile ? '60px' : 'auto',
            cursor: 'pointer', border: '1px solid transparent',
            background: isSelected ? 'rgba(184,149,106,0.12)'
                : isActive ? 'rgba(184,149,106,0.08)'
                    : 'transparent',
            borderColor: isActive ? 'rgba(184,149,106,0.2)' : 'transparent',
            transition: 'all 150ms ease',
            WebkitTapHighlightColor: 'transparent',
        };

        const statusColor = item.status === 'active' || item.status === 'online' ? '#22c55e'
            : item.status === 'away' ? '#f59e0b'
                : item.status === 'dnd' || item.status === 'busy' ? '#ef4444'
                    : 'rgba(228,228,228,0.2)';

        const avatarBg = isActive ? 'rgba(184,149,106,0.15)' : 'rgba(255,255,255,0.07)';
        const avatarColor = isActive ? '#b8956a' : 'rgba(228,228,228,0.6)';

        return (
            <div
                key={item.id}
                onClick={handleClick}
                style={rowStyle}
                onMouseEnter={e => { if (!isActive && !isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (!isActive && !isSelected) e.currentTarget.style.background = 'transparent'; }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                    {isSelectionMode && (
                        <div style={{ width: '14px', height: '14px', border: `1px solid ${isSelected ? '#b8956a' : 'rgba(255,255,255,0.2)'}`, background: isSelected ? '#b8956a' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {isSelected && <CheckSquare size={9} style={{ color: '#0c0c0c' }} />}
                        </div>
                    )}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                        <div style={{ width: isMobile ? '42px' : '34px', height: isMobile ? '42px' : '34px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: isMobile ? '15px' : '13px', background: avatarBg, color: avatarColor, fontFamily: 'Inter, system-ui, sans-serif' }}>
                            {isBroadcast ? <Megaphone size={isMobile ? 17 : 14} /> : item.name.charAt(0).toUpperCase()}
                        </div>
                        {!isBroadcast && (
                            <div style={{ position: 'absolute', bottom: '-1px', right: '-1px', width: isMobile ? '11px' : '9px', height: isMobile ? '11px' : '9px', borderRadius: '50%', background: statusColor, border: '2px solid #0c0c0c' }} />
                        )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: isActive ? 600 : 400, color: isActive ? '#e4e4e4' : 'rgba(228,228,228,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Inter, system-ui, sans-serif' }}>
                            {item.name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Inter, system-ui, sans-serif' }}>
                            {item.lastMessage || 'No messages yet'}
                        </div>
                    </div>
                </div>

                {item.unread > 0 && !isSelectionMode && (
                    <div style={{ minWidth: '18px', height: '18px', borderRadius: '9px', background: '#b8956a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#0c0c0c', fontWeight: 700, fontFamily: 'Inter, system-ui, sans-serif', padding: '0 4px' }}>
                        {item.unread}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)' }}>
            {/* Header */}
            <div style={{ height: isMobile ? '48px' : '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', background: 'var(--bg-base)', flexShrink: 0, borderBottom: '1px solid var(--border-subtle)' }}>
                <h2 style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', fontFamily: 'Inter, system-ui, sans-serif' }}>Messages</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button onClick={() => setIsSelectionMode(!isSelectionMode)}
                        style={{ padding: '6px', background: isSelectionMode ? 'rgba(184,149,106,0.1)' : 'transparent', border: isSelectionMode ? '1px solid rgba(184,149,106,0.2)' : '1px solid transparent', color: isSelectionMode ? '#b8956a' : 'rgba(228,228,228,0.4)', cursor: 'pointer', transition: 'all 150ms ease' }}
                        title="Manage Messages"
                        onMouseEnter={e => { if (!isSelectionMode) e.currentTarget.style.color = '#e4e4e4'; }}
                        onMouseLeave={e => { if (!isSelectionMode) e.currentTarget.style.color = 'rgba(228,228,228,0.4)'; }}
                    ><Settings2 size={18} /></button>
                    <button onClick={() => setShowCreateDM(true)}
                        style={{ padding: '6px', background: 'transparent', border: '1px solid transparent', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 150ms ease' }}
                        title="New Message"
                        onMouseEnter={e => { e.currentTarget.style.color = '#b8956a'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(228,228,228,0.4)'; }}
                    ><Plus size={18} /></button>
                </div>
            </div>

            {/* Search */}
            <div style={{ padding: '10px 12px 4px' }}>
                <div style={{ position: 'relative' }}>
                    <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={13} />
                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search messages..."
                        style={{ width: '100%', paddingLeft: '30px', paddingRight: '10px', paddingTop: '6px', paddingBottom: '6px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box' }} />
                </div>
            </div>

            {/* Filters & Broadcast */}
            <div style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                    {['all', 'unread'].map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            style={{ padding: '3px 10px', fontSize: '11px', fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', background: filter === f ? 'rgba(184,149,106,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${filter === f ? 'rgba(184,149,106,0.25)' : 'rgba(255,255,255,0.08)'}`, color: filter === f ? '#b8956a' : 'rgba(228,228,228,0.4)', transition: 'all 150ms ease' }}>
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>
                <button onClick={handleBroadcast}
                    style={{ padding: '5px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 150ms ease' }}
                    title="New Broadcast"
                    onMouseEnter={e => e.currentTarget.style.color = '#b8956a'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.4)'}
                ><Megaphone size={15} /></button>
            </div>

            {/* Selection Mode Header */}
            {isSelectionMode && (
                <div style={{ padding: '8px 16px', background: 'rgba(184,149,106,0.08)', borderBottom: '1px solid rgba(184,149,106,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#b8956a', fontFamily: 'Inter, system-ui, sans-serif' }}>{selectedItems.size} selected</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setShowDeleteConfirm(true)} disabled={selectedItems.size === 0}
                            style={{ padding: '5px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', opacity: selectedItems.size === 0 ? 0.4 : 1 }} title="Delete">
                            <Trash2 size={15} /></button>
                        <button onClick={() => { setIsSelectionMode(false); setSelectedItems(new Set()); }}
                            style={{ padding: '5px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} title="Cancel">
                            <X size={15} /></button>
                    </div>
                </div>
            )}

            {/* Contact List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 4px 8px' }}>
                <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '4px 12px 8px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                    {activeWorkspace?.name || 'Workspace'} Conversations
                </p>

                {isLoading ? (
                    <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {[60, 75, 50, 85, 65].map((w, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-active)', flexShrink: 0 }} />
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <div style={{ height: '10px', background: 'var(--bg-active)', width: `${w}%` }} />
                                    <div style={{ height: '8px', background: 'var(--bg-hover)', width: `${w * 0.6}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredList.length > 0 ? (
                    filteredList.map((item) => <Item key={item.id} item={item} />)
                ) : (
                    <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, sans-serif' }}>
                        {searchQuery ? 'No conversations found' : 'No conversations yet'}
                    </div>
                )}
            </div>

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDeleteSelected}
                title="Delete Conversations?"
                message={`Are you sure you want to delete ${selectedItems.size} selected conversation(s)? This action cannot be undone.`}
                confirmText="Delete Conversations"
            />

            {/* New DM Modal */}
            {showCreateDM && (
                <NewDMModal
                    onClose={() => setShowCreateDM(false)}
                    onStart={handleStartDM}
                />
            )}

            {/* Broadcast Modal */}
            {showBroadcast && (
                <BroadcastModal
                    workspaceId={workspaceId}
                    onClose={() => setShowBroadcast(false)}
                    onSendBroadcast={handleSendBroadcast}
                />
            )}
        </div>
    );
};

export default MessagesPanel;
