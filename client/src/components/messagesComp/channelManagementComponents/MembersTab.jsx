import React from 'react';
import { Lock } from 'lucide-react';

export default function MembersTab({
    members,
    channel,
    currentUserId,
    isAdmin,
    loading,
    onPromoteAdmin,
    onDemoteAdmin,
    onRemoveMember
}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {}
            {!isAdmin && channel.isPrivate && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '14px 16px',
                    backgroundColor: 'var(--bg-active)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '2px',
                }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: '2px',
                        backgroundColor: 'var(--bg-hover)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--text-muted)',
                        flexShrink: 0,
                    }}>
                        <Lock size={16} />
                    </div>
                    <div>
                        <h4 style={{
                            fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 2px',
                            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                        }}>Private Channel</h4>
                        <p style={{
                            fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5,
                            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                        }}>
                            This channel is private. Only channel admins can invite new members.
                        </p>
                    </div>
                </div>
            )}

            {}
            <div>
                <div style={{
                    fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
                    color: 'var(--text-muted)', marginBottom: '12px', paddingBottom: '8px',
                    borderBottom: '1px solid var(--border-subtle)',
                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                }}>
                    Channel Members
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {members.map((member) => {
                        const isOwner = String(member._id) === String(channel.createdBy);
                        const isMemberAdmin = member.isAdmin || isOwner;
                        const isCurrentUser = String(member._id) === String(currentUserId);

                        return (
                            <MemberRow
                                key={member._id}
                                member={member}
                                isOwner={isOwner}
                                isMemberAdmin={isMemberAdmin}
                                isCurrentUser={isCurrentUser}
                                isAdmin={isAdmin}
                                members={members}
                                loading={loading}
                                onPromoteAdmin={onPromoteAdmin}
                                onDemoteAdmin={onDemoteAdmin}
                                onRemoveMember={onRemoveMember}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function MemberRow({ member, isOwner, isMemberAdmin, isCurrentUser, isAdmin, members, loading, onPromoteAdmin, onDemoteAdmin, onRemoveMember }) {
    const [hovered, setHovered] = React.useState(false);

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', borderRadius: '2px',
                backgroundColor: hovered ? 'var(--bg-hover)' : 'transparent',
                transition: 'background-color 150ms ease',
            }}
        >
            {}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                    width: 36, height: 36, borderRadius: '2px',
                    backgroundColor: 'var(--bg-active)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)',
                    flexShrink: 0,
                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                }}>
                    {(member?.username || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                    <div style={{
                        fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)',
                        display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px',
                        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                    }}>
                        {member?.username || 'Unknown'}
                        {isOwner && (
                            <span style={{
                                padding: '1px 6px', backgroundColor: 'rgba(184,149,106,0.15)',
                                color: 'var(--accent)', fontSize: '9px', fontWeight: 700,
                                borderRadius: '2px', textTransform: 'uppercase', letterSpacing: '0.1em',
                                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                            }}>Owner</span>
                        )}
                        {!isOwner && isMemberAdmin && (
                            <span style={{
                                padding: '1px 6px', backgroundColor: 'var(--bg-active)',
                                color: 'var(--text-secondary)', fontSize: '9px', fontWeight: 700,
                                borderRadius: '2px', textTransform: 'uppercase', letterSpacing: '0.1em',
                                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                            }}>Admin</span>
                        )}
                    </div>
                    <div style={{
                        fontSize: '12px', color: 'var(--text-muted)',
                        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                    }}>Member</div>
                </div>
            </div>

            {}
            {isAdmin && !isCurrentUser && !isOwner && hovered && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {!isMemberAdmin ? (
                        <InlineBtn label="Promote to Admin" onClick={() => onPromoteAdmin(member._id)} disabled={loading} />
                    ) : (
                        <InlineBtn label="Demote to Member" onClick={() => onDemoteAdmin(member._id)} disabled={loading} accent />
                    )}
                    <InlineBtn label="Remove" onClick={() => onRemoveMember(member._id)} disabled={loading} danger />
                </div>
            )}

            {}
            {isCurrentUser && isMemberAdmin && !isOwner && hovered && (() => {
                const totalAdmins = members.filter(m => m.isAdmin).length;
                if (totalAdmins === 1) return null;
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <InlineBtn label="Withdraw as Admin" onClick={() => onDemoteAdmin(member._id)} disabled={loading} />
                    </div>
                );
            })()}
        </div>
    );
}

function InlineBtn({ label, onClick, disabled, danger = false, accent = false }) {
    const [h, setH] = React.useState(false);
    const color = danger ? 'var(--state-danger)' : accent ? 'var(--accent)' : 'var(--text-secondary)';
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            onMouseEnter={() => setH(true)}
            onMouseLeave={() => setH(false)}
            style={{
                fontSize: '12px', fontWeight: 400, padding: '4px 10px',
                backgroundColor: h ? 'var(--bg-active)' : 'transparent',
                color, border: '1px solid var(--border-default)', borderRadius: '2px',
                cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
                transition: 'background-color 150ms ease',
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                whiteSpace: 'nowrap',
            }}
        >
            {label}
        </button>
    );
}
