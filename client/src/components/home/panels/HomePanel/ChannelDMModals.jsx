import React, { useState } from 'react';
import CreateChannelModal from '../../../messagesComp/CreateChannelModal';
import { getAvatarUrl } from '../../../../utils/avatarUtils';
import { X, Search, MessageSquare } from 'lucide-react';

const NewDMModal = ({ showNewDMModal, setShowNewDMModal, workspaceMembers, handleStartDM }) => {
    const [searchQuery, setSearchQuery] = useState('');
    if (!showNewDMModal) return null;

    const filtered = (workspaceMembers || []).filter(m => {
        const q = searchQuery.toLowerCase();
        return (m.username || m.name || '').toLowerCase().includes(q)
            || (m.email || '').toLowerCase().includes(q);
    });

    const roleBadge = (role) => {
        if (!role || role === 'member') return null;
        return (
            <span style={{
                fontSize: '9px', fontWeight: 700, padding: '1px 5px',
                background: 'var(--bg-active)', border: '1px solid var(--border-accent)',
                color: 'var(--accent)', borderRadius: '2px', flexShrink: 0, textTransform: 'capitalize',
            }}>
                {role}
            </span>
        );
    };

    return (
        <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font)' }}
            onClick={e => { if (e.target === e.currentTarget) setShowNewDMModal(false); }}
        >
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', width: '460px', maxHeight: '580px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* Header */}
                <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <div>
                        <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>New Message</h3>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0' }}>Start a direct conversation</p>
                    </div>
                    <button onClick={() => setShowNewDMModal(false)}
                        style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', borderRadius: '2px', transition: '150ms ease' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                        <X size={15} />
                    </button>
                </div>

                {/* Search */}
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                        <input
                            type="text" placeholder="Search by name or email…"
                            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            autoFocus
                            style={{ width: '100%', padding: '8px 10px 8px 32px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '2px', fontSize: '12px', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font)', boxSizing: 'border-box' }}
                            onFocus={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
                            onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                        />
                    </div>
                </div>

                {/* List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }} className="custom-scrollbar">
                    {filtered.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
                            <span style={{ fontSize: '24px', marginBottom: '8px', opacity: 0.4 }}>👥</span>
                            <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', margin: 0 }}>No members found</p>
                        </div>
                    ) : (
                        <div style={{ padding: '0 6px' }}>
                            <div style={{ padding: '4px 8px 6px', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                                Workspace Members
                            </div>
                            {filtered.map(member => {
                                const displayName = member.name || member.username || 'Unknown';
                                const isOnline = member.status === 'online';
                                const about = member.profile?.about || member.about || '';
                                return (
                                    <div
                                        key={member._id}
                                        onClick={() => handleStartDM(member)}
                                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '2px', cursor: 'pointer', transition: '150ms ease' }}
                                        className="group"
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                    >
                                        {/* Avatar */}
                                        <div style={{ position: 'relative', flexShrink: 0 }}>
                                            <img
                                                src={getAvatarUrl(member)} alt={displayName}
                                                style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-default)' }}
                                                onError={e => { e.target.src = getAvatarUrl({ username: displayName }); }}
                                            />
                                            <span style={{
                                                position: 'absolute', bottom: '0', right: '0', width: '8px', height: '8px',
                                                borderRadius: '50%', background: isOnline ? 'var(--state-success)' : 'var(--border-default)',
                                                border: '1.5px solid var(--bg-surface)',
                                            }} />
                                        </div>

                                        {/* Info */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {displayName}
                                                </span>
                                                {roleBadge(member.role)}
                                            </div>
                                            {member.email && (
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
                                                    {member.email}
                                                </div>
                                            )}
                                            {about && (
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px', fontStyle: 'italic' }}>
                                                    {about}
                                                </div>
                                            )}
                                        </div>

                                        {/* Message CTA */}
                                        <button
                                            onClick={e => { e.stopPropagation(); handleStartDM(member); }}
                                            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', fontSize: '11px', fontWeight: 600, color: 'var(--accent)', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', borderRadius: '2px', cursor: 'pointer', fontFamily: 'var(--font)', opacity: 0, transition: '150ms ease' }}
                                            className="group-hover:opacity-100"
                                        >
                                            <MessageSquare size={11} /> Message
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export { CreateChannelModal, NewDMModal };
