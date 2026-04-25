import React, { useState, useEffect } from "react";
import { Search, X, User, Hash } from "lucide-react";
import { useContacts } from "../../../../contexts/ContactsContext";
import { useWorkspace } from "../../../../contexts/WorkspaceContext";
import api from '@services/api';

const FONT = 'Inter, system-ui, -apple-system, sans-serif';

export default function ForwardMessageModal({ onClose, onForward, currentChatId, currentChatType }) {
    const { channels } = useContacts();
    const { activeWorkspace } = useWorkspace();
    const [activeTab,        setActiveTab]        = useState('channels');
    const [search,           setSearch]           = useState("");
    const [selectedItems,    setSelectedItems]    = useState(new Set());
    const [workspaceMembers, setWorkspaceMembers] = useState([]);
    const [loading,          setLoading]          = useState(false);

    useEffect(() => {
        if (activeTab === 'dms' && activeWorkspace) loadWorkspaceMembers();
        
    }, [activeTab, activeWorkspace]);

    const loadWorkspaceMembers = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/api/workspaces/${activeWorkspace.id}/members`);
            setWorkspaceMembers(response.data.members || []);
        } catch (err) {
            console.error("Failed to load workspace members:", err);
        } finally {
            setLoading(false);
        }
    };

    const filteredChannels = channels
        .filter(ch => ch.id !== currentChatId)
        .filter(ch => ch.label.toLowerCase().includes(search.toLowerCase()));

    const filteredDMs = workspaceMembers
        .filter(member => member.username.toLowerCase().includes(search.toLowerCase()));

    const toggleSelection = (item) => {
        const newSelection = new Set(selectedItems);
        const itemId = activeTab === 'channels' ? item.id : item._id;
        if (newSelection.has(itemId)) newSelection.delete(itemId);
        else newSelection.add(itemId);
        setSelectedItems(newSelection);
    };

    const handleForward = () => {
        if (selectedItems.size === 0) return;
        const targets = [];
        if (activeTab === 'channels') {
            selectedItems.forEach(id => {
                const channel = channels.find(ch => ch.id === id);
                if (channel) targets.push({ type: 'channel', id: channel.id, label: channel.label });
            });
        } else {
            selectedItems.forEach(id => {
                const member = workspaceMembers.find(m => m._id === id);
                if (member) targets.push({ type: 'dm', id: member._id, label: member.username, isNewDM: true });
            });
        }
        onForward(targets);
    };

    return (
        <div style={{
            position: 'absolute', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
            fontFamily: FONT,
            animation: 'fadeIn 180ms ease',
        }}>
            <div style={{
                width: '380px', maxHeight: '80vh',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-accent)',
                borderRadius: '4px',
                boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden',
            }}>
                {}
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <h3 style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', fontFamily: FONT }}>
                        Forward message to…
                    </h3>
                    <CloseBtn onClick={onClose} />
                </div>

                {}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-default)', flexShrink: 0 }}>
                    <TabBtn active={activeTab === 'channels'} onClick={() => setActiveTab('channels')}>
                        <Hash size={13} /> Channels
                    </TabBtn>
                    <TabBtn active={activeTab === 'dms'} onClick={() => setActiveTab('dms')}>
                        <User size={13} /> Direct Messages
                    </TabBtn>
                </div>

                {}
                <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                        <input
                            type="text"
                            placeholder={activeTab === 'channels' ? "Search channels…" : "Search people…"}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            autoFocus
                            style={{
                                width: '100%', padding: '7px 10px 7px 32px',
                                backgroundColor: 'var(--bg-active)',
                                border: '1px solid var(--border-default)',
                                borderRadius: '2px', outline: 'none',
                                color: 'var(--text-primary)', fontSize: '13px',
                                fontFamily: FONT, boxSizing: 'border-box',
                                transition: 'border-color 100ms ease',
                            }}
                            onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                        />
                    </div>
                </div>

                {}
                <div style={{ flex: 1, overflowY: 'auto', padding: '6px', minHeight: '200px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: '12px', fontFamily: FONT }}>Loading…</div>
                    ) : activeTab === 'channels' ? (
                        filteredChannels.length > 0 ? (
                            filteredChannels.map(channel => {
                                const isSelected = selectedItems.has(channel.id);
                                return (
                                    <ListItem
                                        key={channel.id}
                                        isSelected={isSelected}
                                        onClick={() => toggleSelection(channel)}
                                        avatar={
                                            <div style={{ width: '30px', height: '30px', borderRadius: '2px', backgroundColor: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexShrink: 0 }}>
                                                <Hash size={13} />
                                            </div>
                                        }
                                        primary={channel.label}
                                        secondary="Channel"
                                    />
                                );
                            })
                        ) : (
                            <EmptyState>No channels found</EmptyState>
                        )
                    ) : (
                        filteredDMs.length > 0 ? (
                            filteredDMs.map(member => {
                                const isSelected = selectedItems.has(member._id);
                                return (
                                    <ListItem
                                        key={member._id}
                                        isSelected={isSelected}
                                        onClick={() => toggleSelection(member)}
                                        avatar={
                                            <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                                                {member.profilePicture ? (
                                                    <img src={member.profilePicture} alt={member.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#0c0c0c' }}>
                                                        {(member.username || 'U')[0].toUpperCase()}
                                                    </span>
                                                )}
                                            </div>
                                        }
                                        primary={member.username}
                                        secondary={member.email}
                                    />
                                );
                            })
                        ) : (
                            <EmptyState>{loading ? "Loading…" : "No members found"}</EmptyState>
                        )
                    )}
                </div>

                {}
                <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: FONT }}>
                        {selectedItems.size > 0 && `${selectedItems.size} selected`}
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <CancelBtn onClick={onClose}>Cancel</CancelBtn>
                        <ForwardBtn onClick={handleForward} disabled={selectedItems.size === 0}>
                            Forward to {selectedItems.size || '…'}
                        </ForwardBtn>
                    </div>
                </div>
            </div>
        </div>
    );
}

function CloseBtn({ onClick }) {
    const [hov, setHov] = useState(false);
    return (
        <button onClick={onClick}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ padding: '5px', border: 'none', outline: 'none', background: 'none', cursor: 'pointer', borderRadius: '2px', display: 'flex', transition: '100ms', color: hov ? 'var(--state-danger)' : 'var(--text-muted)' }}>
            <X size={16} />
        </button>
    );
}

function TabBtn({ active, onClick, children }) {
    const [hov, setHov] = useState(false);
    return (
        <button onClick={onClick}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{
                flex: 1, padding: '10px 0', fontSize: '12px', fontWeight: 500,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                color: active ? 'var(--accent)' : (hov ? 'var(--text-secondary)' : 'var(--text-muted)'),
                backgroundColor: 'transparent',
                border: 'none', outline: 'none', cursor: 'pointer',
                borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                transition: '100ms ease', fontFamily: 'Inter, system-ui, sans-serif',
            }}>
            {children}
        </button>
    );
}

function ListItem({ isSelected, onClick, avatar, primary, secondary }) {
    const [hov, setHov] = useState(false);
    return (
        <button onClick={onClick}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                padding: '7px 8px', border: 'none', outline: 'none', cursor: 'pointer',
                borderRadius: '2px', textAlign: 'left',
                backgroundColor: isSelected ? 'rgba(184,149,106,0.10)' : (hov ? 'var(--bg-hover)' : 'transparent'),
                borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                transition: '80ms ease',
            }}>
            {}
            <div style={{
                width: '14px', height: '14px', borderRadius: '2px', flexShrink: 0,
                border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border-default)'}`,
                backgroundColor: isSelected ? 'var(--accent)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: '100ms',
            }}>
                {isSelected && <span style={{ color: '#0c0c0c', fontSize: '9px', fontWeight: 700 }}>✓</span>}
            </div>
            {avatar}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Inter, system-ui, sans-serif' }}>{primary}</div>
                {secondary && <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Inter, system-ui, sans-serif' }}>{secondary}</div>}
            </div>
        </button>
    );
}

function EmptyState({ children }) {
    return (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {children}
        </div>
    );
}

function CancelBtn({ onClick, children }) {
    const [hov, setHov] = useState(false);
    return (
        <button onClick={onClick}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{
                padding: '7px 16px', fontSize: '12px', fontWeight: 500,
                color: hov ? 'var(--text-primary)' : 'var(--text-secondary)',
                backgroundColor: hov ? 'var(--bg-hover)' : 'transparent',
                border: '1px solid var(--border-default)', borderRadius: '2px',
                cursor: 'pointer', outline: 'none', transition: '100ms', fontFamily: 'Inter, system-ui, sans-serif',
            }}>
            {children}
        </button>
    );
}

function ForwardBtn({ onClick, disabled, children }) {
    const [hov, setHov] = useState(false);
    return (
        <button onClick={onClick} disabled={disabled}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{
                padding: '7px 16px', fontSize: '12px', fontWeight: 600,
                color: disabled ? 'var(--text-muted)' : '#0c0c0c',
                backgroundColor: disabled ? 'var(--bg-active)' : (hov ? 'var(--accent-hover)' : 'var(--accent)'),
                border: `1px solid ${disabled ? 'var(--border-default)' : 'var(--accent)'}`,
                borderRadius: '2px', cursor: disabled ? 'not-allowed' : 'pointer',
                outline: 'none', transition: '100ms', opacity: disabled ? 0.5 : 1,
                fontFamily: 'Inter, system-ui, sans-serif',
            }}>
            {children}
        </button>
    );
}
