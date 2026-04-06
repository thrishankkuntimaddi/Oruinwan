import React from 'react';
import { Users, UserPlus, X, Search } from 'lucide-react';

export default function InviteTab({
    searchQuery,
    onSearchQueryChange,
    filteredNonMembers,
    allUsers,
    members,
    channel,
    showDebugInfo,
    onInvite,
    loading
}) {
    const nonMembers = allUsers.filter(
        (u) => !members.some((m) => String(m._id) === String(u._id))
    );

    const avatarColor = (name = '') => {
        const colors = ['#b8956a', '#9c7fd4', '#63b3ed', '#48bb78', '#fc8181', '#f6ad55'];
        return colors[name.charCodeAt(0) % colors.length];
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => onSearchQueryChange(e.target.value)}
                    style={{
                        width: '100%', padding: '8px 32px 8px 32px',
                        backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-default)',
                        borderRadius: '2px', fontSize: '13px', color: 'var(--text-primary)',
                        outline: 'none', boxSizing: 'border-box', transition: 'border-color 150ms ease',
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                />
                {searchQuery && (
                    <button
                        onClick={() => onSearchQueryChange('')}
                        style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '2px', transition: 'color 150ms ease' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                        <X size={14} />
                    </button>
                )}
            </div>

            {/* Debug Panel */}
            {showDebugInfo && (
                <div style={{ padding: '10px 12px', backgroundColor: 'rgba(184,149,106,0.08)', border: '1px solid rgba(184,149,106,0.2)', borderRadius: '2px', fontSize: '11px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: '4px' }}>Debug Info</div>
                    <div style={{ color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div>• Total workspace users: {allUsers.length}</div>
                        <div>• Channel members: {members.length}</div>
                        <div>• Non-members eligible: {nonMembers.length}</div>
                        <div>• Filtered by search: {filteredNonMembers.length}</div>
                        <div>• Workspace ID: {channel.workspaceId || 'N/A'}</div>
                    </div>
                </div>
            )}

            {filteredNonMembers.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 16px', opacity: 0.6 }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '2px', backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                        <Users size={20} style={{ color: 'var(--text-muted)' }} />
                    </div>
                    <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', margin: '0 0 4px' }}>
                        {searchQuery ? 'No members found' : "Everyone's already here!"}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                        {searchQuery ? 'Try a different search term' : 'All workspace members are in this channel.'}
                    </p>
                </div>
            ) : (
                <>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                        {filteredNonMembers.length} member{filteredNonMembers.length !== 1 ? 's' : ''} available
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {filteredNonMembers.map((user) => (
                            <UserRow key={user._id} user={user} loading={loading} onInvite={onInvite} avatarColor={avatarColor} />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

function UserRow({ user, loading, onInvite, avatarColor }) {
    const [hovered, setHovered] = React.useState(false);
    const initials = (name = '') => name.charAt(0).toUpperCase();
    const bg = avatarColor(user?.username || 'U');

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', borderRadius: '2px', transition: '150ms ease',
                backgroundColor: hovered ? 'var(--bg-hover)' : 'var(--bg-active)',
                border: `1px solid ${hovered ? 'var(--border-accent)' : 'var(--border-default)'}`,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    backgroundColor: bg, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: '#0c0c0c', fontSize: '12px',
                    fontWeight: 700, flexShrink: 0,
                }}>
                    {initials(user?.username)}
                </div>
                <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{user?.username || 'Unknown'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{user?.email || ''}</div>
                </div>
            </div>
            <button
                onClick={() => onInvite(user._id)}
                disabled={loading}
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '6px', borderRadius: '2px', background: 'none',
                    border: '1px solid var(--border-accent)', cursor: loading ? 'not-allowed' : 'pointer',
                    color: 'var(--accent)', transition: '150ms ease', opacity: loading ? 0.5 : 1,
                }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.backgroundColor = 'var(--accent)'; e.currentTarget.style.color = '#0c0c0c'; } }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--accent)'; }}
                title="Add to Channel"
            >
                <UserPlus size={16} />
            </button>
        </div>
    );
}
