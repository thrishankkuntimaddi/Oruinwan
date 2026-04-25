import React, { useState, useEffect } from "react";
import api from '@services/api';
import { useToast } from "../../contexts/ToastContext";
import { X, Search, Check, Info, Hash, ChevronRight, Globe, Lock, UserPlus } from 'lucide-react';

const FONT = 'Inter, system-ui, -apple-system, sans-serif';

export default function CreateChannelModal({ onClose, onCreated, workspaceId }) {
    const { showToast } = useToast();
    const [currentTab, setCurrentTab] = useState(1);

    
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [visibility, setVisibility] = useState('public'); 
    const [isDiscoverable, setIsDiscoverable] = useState(true);

    
    const [workspaceMembers, setWorkspaceMembers] = useState([]);
    const [selectedMemberIds, setSelectedMemberIds] = useState(new Set());
    const [searchQuery, setSearchQuery] = useState("");
    const [loadingMembers, setLoadingMembers] = useState(false);

    
    useEffect(() => {
        const fetchMembers = async () => {
            setLoadingMembers(true);
            try {
                const res = await api.get(`/api/workspaces/${workspaceId}/all-members`);
                setWorkspaceMembers(res.data.members || []);
            } catch (err) {
                console.error("Failed to load members:", err);
                showToast("Failed to load workspace members", "error");
            } finally {
                setLoadingMembers(false);
            }
        };

        if (currentTab === 2 && workspaceId) {
            fetchMembers();
        }
    }, [currentTab, workspaceId, showToast]);

    const toggleMember = (id) => {
        const newSet = new Set(selectedMemberIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedMemberIds(newSet);
    };

    const handleNextTab = () => {
        if (!name.trim()) {
            showToast("Channel name is required", "error");
            return;
        }
        setCurrentTab(2);
    };

    const handleCreate = async () => {
        if (!name.trim()) {
            showToast("Channel name is required", "error");
            return;
        }

        
        if (visibility === 'private' && selectedMemberIds.size === 0) {
            showToast("Private channels require at least one invited member", "error");
            return;
        }

        try {
            
            const channelMembers = selectedMemberIds ? Array.from(selectedMemberIds) : [];

            const payload = {
                name: name.trim(),
                description,
                isPrivate: visibility === 'private',
                isDiscoverable: visibility === 'public' ? isDiscoverable : false,
                members: channelMembers, 
                workspaceId
            };

            const res = await api.post(`/api/workspaces/${workspaceId}/channels`, payload);
            const channel = res.data.channel;

            const channelType = visibility === 'private' ? 'Private' : 'Public';
            showToast(`${channelType} channel #${channel.name} created successfully!`);
            onCreated && onCreated(channel);
            onClose();
        } catch (err) {
            console.error("Create channel failed:", err);
            const errorMsg = err?.response?.data?.message || "Failed to create channel";
            showToast(errorMsg, "error");
        }
    };

    
    const filteredMembers = workspaceMembers.filter(m =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.email && m.email.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    
    const canCreate = visibility === 'public' || (visibility === 'private' && selectedMemberIds.size > 0);

    return (
        <div style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100, padding: '24px',
            fontFamily: FONT,
        }}>
            <div
                style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-accent)',
                    borderRadius: '2px',
                    width: '100%', maxWidth: '700px',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
                    display: 'flex', flexDirection: 'column',
                    overflow: 'hidden',
                    maxHeight: '90vh',
                }}
                onClick={e => e.stopPropagation()}
            >
                {}
                <div style={{
                    padding: '20px 28px',
                    borderBottom: '1px solid var(--border-default)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    backgroundColor: 'var(--bg-surface)',
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{
                            width: '36px', height: '36px', borderRadius: '2px',
                            backgroundColor: 'rgba(184,149,106,0.15)',
                            border: '1px solid var(--border-accent)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Hash size={18} style={{ color: 'var(--accent)' }} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 style={{
                                fontSize: '15px', fontWeight: 600,
                                color: 'var(--text-primary)',
                                margin: '0 0 2px', letterSpacing: '-0.015em',
                                fontFamily: FONT,
                            }}>
                                Create Channel
                            </h3>
                            <p style={{
                                fontSize: '12px', color: 'var(--text-muted)',
                                margin: 0, fontFamily: FONT,
                            }}>
                                Step {currentTab}/2 · {currentTab === 1 ? "Details & Visibility" : "Invite Members"}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        style={{
                            width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'none', border: 'none', outline: 'none', cursor: 'pointer',
                            color: 'var(--text-muted)', borderRadius: '2px', transition: '100ms ease',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--state-danger)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                        <X size={18} />
                    </button>
                </div>

                {}
                <div style={{ height: '2px', backgroundColor: 'var(--border-subtle)', flexShrink: 0 }}>
                    <div style={{
                        height: '100%',
                        backgroundColor: 'var(--accent)',
                        width: currentTab === 1 ? '50%' : '100%',
                        transition: 'width 300ms ease',
                    }} />
                </div>

                {}
                <div style={{ flex: 1, padding: '28px', overflowY: 'auto', minHeight: '360px' }}>
                    {currentTab === 1 ? (
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>

                            {}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                {}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{
                                        fontSize: '9px', fontWeight: 700,
                                        color: 'var(--text-muted)',
                                        textTransform: 'uppercase', letterSpacing: '0.14em',
                                        fontFamily: FONT,
                                    }}>
                                        Channel Name
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <div style={{
                                            position: 'absolute', left: '10px', top: '50%',
                                            transform: 'translateY(-50%)',
                                            color: 'var(--text-muted)', pointerEvents: 'none',
                                            display: 'flex',
                                        }}>
                                            <Hash size={16} />
                                        </div>
                                        <input
                                            value={name}
                                            onChange={e => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                                            style={{
                                                width: '100%', padding: '10px 12px 10px 32px',
                                                backgroundColor: 'var(--bg-input)',
                                                border: '1px solid var(--border-default)',
                                                borderRadius: '2px',
                                                fontSize: '14px', fontWeight: 600,
                                                color: 'var(--text-primary)',
                                                outline: 'none', boxSizing: 'border-box',
                                                fontFamily: FONT,
                                                transition: 'border-color 150ms ease',
                                            }}
                                            placeholder="project-name"
                                            autoFocus
                                            onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                                            onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                                        />
                                    </div>
                                    <p style={{
                                        fontSize: '11px', color: 'var(--text-muted)', margin: 0,
                                        display: 'flex', alignItems: 'center', gap: '4px', fontFamily: FONT,
                                    }}>
                                        <Info size={11} />
                                        Lowercase, spaces become hyphens
                                    </p>
                                </div>

                                {}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{
                                        fontSize: '9px', fontWeight: 700,
                                        color: 'var(--text-muted)',
                                        textTransform: 'uppercase', letterSpacing: '0.14em',
                                        fontFamily: FONT,
                                    }}>
                                        Description <span style={{ fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>(Optional)</span>
                                    </label>
                                    <textarea
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        style={{
                                            width: '100%', padding: '10px 12px',
                                            backgroundColor: 'var(--bg-input)',
                                            border: '1px solid var(--border-default)',
                                            borderRadius: '2px',
                                            fontSize: '13px', color: 'var(--text-primary)',
                                            outline: 'none', resize: 'none', lineHeight: 1.65,
                                            boxSizing: 'border-box', fontFamily: FONT,
                                            transition: 'border-color 150ms ease',
                                        }}
                                        placeholder="What is this channel about?"
                                        rows={5}
                                        onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                                        onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                                    />
                                </div>
                            </div>

                            {}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <label style={{
                                    fontSize: '9px', fontWeight: 700,
                                    color: 'var(--text-muted)',
                                    textTransform: 'uppercase', letterSpacing: '0.14em',
                                    fontFamily: FONT,
                                }}>
                                    Channel Visibility
                                </label>

                                {}
                                <div
                                    onClick={() => setVisibility('public')}
                                    style={{
                                        padding: '14px 16px',
                                        borderRadius: '2px', cursor: 'pointer',
                                        border: `1px solid ${visibility === 'public' ? 'var(--accent)' : 'var(--border-default)'}`,
                                        backgroundColor: visibility === 'public' ? 'rgba(184,149,106,0.08)' : 'var(--bg-active)',
                                        transition: 'border-color 150ms ease, background-color 150ms ease',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                        <div style={{
                                            width: '32px', height: '32px', borderRadius: '2px', flexShrink: 0,
                                            backgroundColor: visibility === 'public' ? 'rgba(184,149,106,0.15)' : 'var(--bg-hover)',
                                            border: '1px solid var(--border-default)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <Globe size={16} style={{ color: visibility === 'public' ? 'var(--accent)' : 'var(--text-muted)' }} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                                                <h4 style={{
                                                    fontSize: '13px', fontWeight: 600, margin: 0,
                                                    color: visibility === 'public' ? 'var(--accent)' : 'var(--text-primary)',
                                                    fontFamily: FONT,
                                                }}>Public</h4>
                                                {visibility === 'public' && (
                                                    <Check size={14} style={{ color: 'var(--accent)' }} />
                                                )}
                                            </div>
                                            <p style={{
                                                fontSize: '12px', color: 'var(--text-muted)', margin: 0,
                                                lineHeight: 1.5, fontFamily: FONT,
                                            }}>
                                                Anyone in workspace can discover and join.
                                            </p>
                                        </div>
                                    </div>

                                    {visibility === 'public' && (
                                        <div
                                            style={{
                                                marginTop: '12px', paddingTop: '12px',
                                                borderTop: '1px solid var(--border-default)',
                                                display: 'flex', alignItems: 'flex-start', gap: '10px',
                                                cursor: 'pointer',
                                            }}
                                            onClick={e => { e.stopPropagation(); setIsDiscoverable(!isDiscoverable); }}
                                        >
                                            <div style={{
                                                marginTop: '1px', width: '16px', height: '16px', borderRadius: '2px',
                                                border: `1px solid ${isDiscoverable ? 'var(--accent)' : 'var(--border-accent)'}`,
                                                backgroundColor: isDiscoverable ? 'var(--accent)' : 'transparent',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                flexShrink: 0, transition: '150ms ease',
                                            }}>
                                                {isDiscoverable && <Check size={10} style={{ color: '#0c0c0c' }} strokeWidth={3} />}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <h5 style={{
                                                    fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)',
                                                    margin: '0 0 2px', fontFamily: FONT,
                                                }}>Discoverable</h5>
                                                <p style={{
                                                    fontSize: '11px', color: 'var(--text-muted)', margin: 0,
                                                    lineHeight: 1.5, fontFamily: FONT,
                                                }}>
                                                    Others can find and join this channel
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {}
                                <div
                                    onClick={() => setVisibility('private')}
                                    style={{
                                        padding: '14px 16px',
                                        borderRadius: '2px', cursor: 'pointer',
                                        border: `1px solid ${visibility === 'private' ? 'var(--border-accent)' : 'var(--border-default)'}`,
                                        backgroundColor: visibility === 'private' ? 'var(--bg-hover)' : 'var(--bg-active)',
                                        transition: 'border-color 150ms ease, background-color 150ms ease',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                        <div style={{
                                            width: '32px', height: '32px', borderRadius: '2px', flexShrink: 0,
                                            backgroundColor: visibility === 'private' ? 'var(--bg-active)' : 'var(--bg-hover)',
                                            border: '1px solid var(--border-default)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <Lock size={16} style={{ color: visibility === 'private' ? 'var(--text-secondary)' : 'var(--text-muted)' }} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                                                <h4 style={{
                                                    fontSize: '13px', fontWeight: 600, margin: 0,
                                                    color: visibility === 'private' ? 'var(--text-primary)' : 'var(--text-secondary)',
                                                    fontFamily: FONT,
                                                }}>Private</h4>
                                                {visibility === 'private' && (
                                                    <Check size={14} style={{ color: 'var(--text-secondary)' }} />
                                                )}
                                            </div>
                                            <p style={{
                                                fontSize: '12px', color: 'var(--text-muted)', margin: 0,
                                                lineHeight: 1.5, fontFamily: FONT,
                                            }}>
                                                Only invited members can access.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
                            {}
                            <div>
                                <h3 style={{
                                    fontSize: '14px', fontWeight: 600,
                                    color: 'var(--text-primary)', margin: '0 0 4px',
                                    fontFamily: FONT,
                                }}>
                                    {visibility === 'private' ? 'Invite Members' : 'Invite Members (Optional)'}
                                </h3>
                                {visibility === 'private' && (
                                    <p style={{ fontSize: '12px', color: 'var(--accent)', margin: 0, fontFamily: FONT }}>
                                        ⚠️ Private channels require at least one invited member for encryption setup.
                                    </p>
                                )}
                            </div>

                            {}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ flex: 1, position: 'relative' }}>
                                    <Search size={14} style={{
                                        position: 'absolute', left: '10px', top: '50%',
                                        transform: 'translateY(-50%)',
                                        color: 'var(--text-muted)', pointerEvents: 'none',
                                    }} />
                                    <input
                                        type="text"
                                        placeholder="Search people..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        style={{
                                            width: '100%', padding: '9px 12px 9px 32px',
                                            backgroundColor: 'var(--bg-input)',
                                            border: '1px solid var(--border-default)',
                                            borderRadius: '2px',
                                            fontSize: '13px', fontWeight: 500,
                                            color: 'var(--text-primary)',
                                            outline: 'none', boxSizing: 'border-box', fontFamily: FONT,
                                            transition: 'border-color 150ms ease',
                                        }}
                                        autoFocus
                                        onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                                        onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                                    />
                                </div>
                                <div style={{
                                    padding: '6px 14px',
                                    backgroundColor: 'rgba(184,149,106,0.10)',
                                    border: '1px solid rgba(184,149,106,0.2)',
                                    borderRadius: '2px',
                                    fontSize: '12px', fontWeight: 700, color: 'var(--accent)',
                                    whiteSpace: 'nowrap', fontFamily: FONT,
                                }}>
                                    {selectedMemberIds.size} Selected
                                </div>
                            </div>

                            {}
                            <div style={{ flex: 1, overflowY: 'auto' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    {loadingMembers ? (
                                        <div style={{
                                            gridColumn: 'span 2', display: 'flex', flexDirection: 'column',
                                            alignItems: 'center', justifyContent: 'center', padding: '60px 16px',
                                            gap: '12px',
                                        }}>
                                            <div style={{
                                                width: '28px', height: '28px', borderRadius: '50%',
                                                border: '2px solid var(--border-accent)',
                                                borderTopColor: 'var(--accent)',
                                                animation: 'spin 0.8s linear infinite',
                                            }} />
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: FONT }}>
                                                Fetching members...
                                            </span>
                                        </div>
                                    ) : filteredMembers.length === 0 ? (
                                        <div style={{
                                            gridColumn: 'span 2', display: 'flex', flexDirection: 'column',
                                            alignItems: 'center', justifyContent: 'center', padding: '60px 16px', gap: '10px',
                                        }}>
                                            <div style={{
                                                width: '40px', height: '40px', borderRadius: '2px',
                                                backgroundColor: 'var(--bg-active)',
                                                border: '1px solid var(--border-default)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}>
                                                <Search size={20} style={{ color: 'var(--text-muted)' }} />
                                            </div>
                                            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', fontFamily: FONT }}>
                                                No members found matching "{searchQuery}"
                                            </div>
                                        </div>
                                    ) : (
                                        filteredMembers.map(user => {
                                            const isSelected = selectedMemberIds.has(user.id);
                                            return (
                                                <div
                                                    key={user.id}
                                                    onClick={() => toggleMember(user.id)}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: '10px',
                                                        padding: '10px 12px', borderRadius: '2px', cursor: 'pointer',
                                                        backgroundColor: isSelected ? 'rgba(184,149,106,0.12)' : 'var(--bg-active)',
                                                        border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-default)'}`,
                                                        transition: 'border-color 150ms ease, background-color 150ms ease',
                                                    }}
                                                    onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; } }}
                                                    onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.backgroundColor = 'var(--bg-active)'; } }}
                                                >
                                                    {}
                                                    <div style={{
                                                        width: '32px', height: '32px', borderRadius: '2px', flexShrink: 0,
                                                        backgroundColor: isSelected ? 'rgba(184,149,106,0.25)' : 'var(--bg-hover)',
                                                        border: '1px solid var(--border-default)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '13px', fontWeight: 600, fontFamily: FONT,
                                                        color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
                                                    }}>
                                                        {user.name.charAt(0).toUpperCase()}
                                                    </div>

                                                    {}
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{
                                                            fontSize: '13px', fontWeight: 500,
                                                            color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                            fontFamily: FONT,
                                                        }}>
                                                            {user.name}
                                                        </div>
                                                        <div style={{
                                                            fontSize: '11px', color: 'var(--text-muted)',
                                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                            fontFamily: FONT,
                                                        }}>
                                                            {user.email}
                                                        </div>
                                                    </div>

                                                    {}
                                                    <div style={{
                                                        width: '18px', height: '18px', borderRadius: '2px', flexShrink: 0,
                                                        border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-accent)'}`,
                                                        backgroundColor: isSelected ? 'var(--accent)' : 'transparent',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        transition: '150ms ease',
                                                    }}>
                                                        {isSelected && <Check size={11} style={{ color: '#0c0c0c' }} strokeWidth={3} />}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {}
                <div style={{
                    padding: '16px 28px',
                    borderTop: '1px solid var(--border-default)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    backgroundColor: 'var(--bg-surface)', flexShrink: 0,
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '7px 16px', fontSize: '13px', fontWeight: 500,
                            color: 'var(--text-muted)', background: 'none', border: 'none',
                            outline: 'none', cursor: 'pointer', fontFamily: FONT,
                            transition: 'color 150ms ease',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                        Cancel
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {currentTab === 2 && (
                            <button
                                onClick={() => setCurrentTab(1)}
                                style={{
                                    padding: '7px 16px', fontSize: '13px', fontWeight: 500,
                                    color: 'var(--text-secondary)',
                                    backgroundColor: 'var(--bg-active)',
                                    border: '1px solid var(--border-default)',
                                    borderRadius: '2px', cursor: 'pointer', fontFamily: FONT,
                                    transition: '150ms ease',
                                    outline: 'none',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--bg-active)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                            >
                                Back
                            </button>
                        )}

                        {currentTab === 1 ? (
                            <button
                                onClick={handleNextTab}
                                disabled={!name.trim()}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    padding: '7px 20px', fontSize: '13px', fontWeight: 600,
                                    color: !name.trim() ? 'var(--text-muted)' : '#0c0c0c',
                                    backgroundColor: !name.trim() ? 'var(--bg-active)' : 'var(--accent)',
                                    border: 'none', borderRadius: '2px', outline: 'none',
                                    cursor: !name.trim() ? 'not-allowed' : 'pointer',
                                    fontFamily: FONT, transition: '150ms ease',
                                    opacity: !name.trim() ? 0.5 : 1,
                                }}
                                onMouseEnter={e => { if (name.trim()) e.currentTarget.style.backgroundColor = 'var(--accent-hover)'; }}
                                onMouseLeave={e => { if (name.trim()) e.currentTarget.style.backgroundColor = 'var(--accent)'; }}
                            >
                                Next Step
                                <ChevronRight size={15} strokeWidth={2.5} />
                            </button>
                        ) : (
                            <button
                                onClick={handleCreate}
                                disabled={!canCreate}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    padding: '7px 20px', fontSize: '13px', fontWeight: 600,
                                    color: !canCreate ? 'var(--text-muted)' : '#0c0c0c',
                                    backgroundColor: !canCreate ? 'var(--bg-active)' : 'var(--accent)',
                                    border: 'none', borderRadius: '2px', outline: 'none',
                                    cursor: !canCreate ? 'not-allowed' : 'pointer',
                                    fontFamily: FONT, transition: '150ms ease',
                                    opacity: !canCreate ? 0.5 : 1,
                                }}
                                onMouseEnter={e => { if (canCreate) e.currentTarget.style.backgroundColor = 'var(--accent-hover)'; }}
                                onMouseLeave={e => { if (canCreate) e.currentTarget.style.backgroundColor = 'var(--accent)'; }}
                            >
                                <UserPlus size={15} strokeWidth={2} />
                                Create Channel
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
