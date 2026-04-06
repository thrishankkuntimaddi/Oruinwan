import React, { useState, useMemo } from "react";
import { X, Users, Search, Crown, Shield, User as UserIcon, MessageCircle } from "lucide-react";

const FONT = 'Inter, system-ui, -apple-system, sans-serif';

const ROLE_BADGES = {
    owner: { Icon: Crown,  label: 'Owner', bg: 'rgba(184,149,106,0.12)', color: 'var(--accent)',        border: 'var(--border-accent)' },
    admin: { Icon: Shield, label: 'Admin', bg: 'rgba(184,149,106,0.07)', color: 'var(--text-secondary)', border: 'var(--border-default)' },
};

export default function MemberListModal({
    isOpen,
    onClose,
    members = [],
    channelName,
    currentUserId,
    onStartDM,
    onViewProfile,
}) {
    const [searchQuery, setSearchQuery] = useState("");

    const sortedMembers = useMemo(() => {
        return [...members].sort((a, b) => {
            const aUser = a.user || a;
            const bUser = b.user || b;
            const aOnline = aUser.isOnline || aUser.status === 'online' ? 1 : 0;
            const bOnline = bUser.isOnline || bUser.status === 'online' ? 1 : 0;
            if (aOnline !== bOnline) return bOnline - aOnline;
            const roleWeight = { owner: 3, admin: 2, member: 1 };
            const aRole = roleWeight[a.role] || 1;
            const bRole = roleWeight[b.role] || 1;
            if (aRole !== bRole) return bRole - aRole;
            return (aUser.username || '').localeCompare(bUser.username || '');
        });
    }, [members]);

    const filteredMembers = useMemo(() => {
        if (!searchQuery.trim()) return sortedMembers;
        const query = searchQuery.toLowerCase();
        return sortedMembers.filter(member => {
            const user = member.user || member;
            return (user.username || '').toLowerCase().includes(query) ||
                   (user.email || '').toLowerCase().includes(query);
        });
    }, [sortedMembers, searchQuery]);

    const formatJoinDate = (date) => {
        if (!date) return 'Unknown';
        const d = new Date(date);
        const diffDays = Math.floor((new Date() - d) / 86400000);
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7)  return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        if (diffDays < 365)return `${Math.floor(diffDays / 30)} months ago`;
        return d.toLocaleDateString();
    };

    const onlineCount = sortedMembers.filter(m => {
        const u = m.user || m;
        return u.isOnline || u.status === 'online';
    }).length;

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)', zIndex: 50 }}
                onClick={onClose}
            />

            {/* Modal */}
            <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', pointerEvents: 'none' }}>
                <div
                    style={{
                        width: '100%', maxWidth: '640px', maxHeight: '80vh',
                        display: 'flex', flexDirection: 'column',
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-accent)',
                        borderRadius: '4px',
                        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
                        overflow: 'hidden',
                        pointerEvents: 'auto',
                        animation: 'fadeIn 180ms ease',
                        fontFamily: FONT,
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-default)', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                width: '36px', height: '36px', borderRadius: '2px', flexShrink: 0,
                                backgroundColor: 'rgba(184,149,106,0.10)', border: '1px solid var(--border-accent)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)',
                            }}>
                                <Users size={16} />
                            </div>
                            <div>
                                <h2 style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', fontFamily: FONT }}>Members</h2>
                                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', fontFamily: FONT }}>
                                    {channelName ? `#${channelName} · ` : ''}{filteredMembers.length} {filteredMembers.length === 1 ? 'member' : 'members'}
                                </p>
                            </div>
                        </div>
                        <CloseBtn onClick={onClose} />
                    </div>

                    {/* Search */}
                    <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                            <input
                                type="text"
                                placeholder="Search members…"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                style={{
                                    width: '100%', padding: '7px 10px 7px 32px',
                                    backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-default)',
                                    borderRadius: '2px', outline: 'none', color: 'var(--text-primary)',
                                    fontSize: '13px', fontFamily: FONT, boxSizing: 'border-box', transition: 'border-color 100ms ease',
                                }}
                                onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                                onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                            />
                        </div>
                    </div>

                    {/* Member List */}
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {filteredMembers.length === 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center', gap: '10px' }}>
                                <div style={{
                                    width: '44px', height: '44px', borderRadius: '2px',
                                    backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-default)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <Users size={20} style={{ color: 'var(--text-muted)' }} />
                                </div>
                                <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', fontFamily: FONT }}>No members found</p>
                                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', fontFamily: FONT }}>Try a different search term</p>
                            </div>
                        ) : (
                            filteredMembers.map((member) => {
                                const user   = member.user || member;
                                const userId = user._id || user.id;
                                return (
                                    <MemberRow
                                        key={userId}
                                        user={user}
                                        userId={userId}
                                        isCurrentUser={String(userId) === String(currentUserId)}
                                        roleBadge={ROLE_BADGES[member.role]}
                                        isOnline={user.isOnline || user.status === 'online'}
                                        joinedAt={member.joinedAt}
                                        formatJoinDate={formatJoinDate}
                                        onStartDM={onStartDM}
                                        onViewProfile={onViewProfile}
                                        onClose={onClose}
                                    />
                                );
                            })
                        )}
                    </div>

                    {/* Footer Stats */}
                    <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border-default)', backgroundColor: 'var(--bg-active)', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: FONT }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--state-success)', display: 'inline-block' }} />
                                {onlineCount} online
                            </span>
                            <span>·</span>
                            <span>{sortedMembers.length} total</span>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

function MemberRow({ user, userId, isCurrentUser, roleBadge, isOnline, joinedAt, formatJoinDate, onStartDM, onViewProfile, onClose }) {
    const [hovered, setHovered] = useState(false);
    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                padding: '12px 20px',
                borderBottom: '1px solid var(--border-subtle)',
                backgroundColor: hovered ? 'var(--bg-hover)' : 'transparent',
                transition: '100ms ease',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Avatar */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                    {user.profilePicture ? (
                        <img src={user.profilePicture} alt={user.username}
                            style={{ width: '40px', height: '40px', borderRadius: '2px', objectFit: 'cover' }} />
                    ) : (
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '2px',
                            backgroundColor: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <span style={{ color: '#0c0c0c', fontWeight: 700, fontSize: '15px' }}>
                                {(user.username || '?').charAt(0).toUpperCase()}
                            </span>
                        </div>
                    )}
                    <div style={{
                        position: 'absolute', bottom: '-2px', right: '-2px',
                        width: '11px', height: '11px', borderRadius: '50%',
                        backgroundColor: isOnline ? 'var(--state-success)' : 'var(--text-muted)',
                        border: '2px solid var(--bg-surface)',
                    }} />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: FONT }}>
                            {user.username || user.name || 'Unknown User'}
                            {isCurrentUser && (
                                <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400 }}>(You)</span>
                            )}
                        </span>
                        {roleBadge && (
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '3px',
                                padding: '1px 7px', borderRadius: '99px', fontSize: '10px', fontWeight: 600,
                                backgroundColor: roleBadge.bg, color: roleBadge.color,
                                border: `1px solid ${roleBadge.border}`,
                                fontFamily: FONT, flexShrink: 0,
                            }}>
                                <roleBadge.Icon size={9} />
                                {roleBadge.label}
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: FONT }}>
                        {user.email && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>{user.email}</span>}
                        <span>·</span>
                        <span>Joined {formatJoinDate(joinedAt)}</span>
                    </div>
                </div>

                {/* Actions */}
                {!isCurrentUser && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: hovered ? 1 : 0, transition: 'opacity 150ms ease', flexShrink: 0 }}>
                        {onStartDM && (
                            <IconBtn onClick={() => { onStartDM(userId); onClose(); }} title="Send message" accent>
                                <MessageCircle size={14} />
                            </IconBtn>
                        )}
                        {onViewProfile && (
                            <IconBtn onClick={() => { onViewProfile(userId); onClose(); }} title="View profile">
                                <UserIcon size={14} />
                            </IconBtn>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function IconBtn({ onClick, title, children, accent }) {
    const [hov, setHov] = useState(false);
    return (
        <button onClick={onClick} title={title}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{
                padding: '5px', border: 'none', outline: 'none', borderRadius: '2px',
                cursor: 'pointer', display: 'flex', transition: '100ms ease',
                color: accent
                    ? (hov ? 'var(--accent)' : 'var(--text-secondary)')
                    : (hov ? 'var(--text-primary)' : 'var(--text-secondary)'),
                backgroundColor: hov ? 'var(--bg-hover)' : 'transparent',
            }}>
            {children}
        </button>
    );
}

function CloseBtn({ onClick }) {
    const [hov, setHov] = useState(false);
    return (
        <button onClick={onClick}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{
                padding: '6px', border: 'none', outline: 'none', background: 'none',
                cursor: 'pointer', borderRadius: '2px', display: 'flex', transition: '100ms',
                color: hov ? 'var(--state-danger)' : 'var(--text-muted)',
            }}>
            <X size={18} />
        </button>
    );
}
