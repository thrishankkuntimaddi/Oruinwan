import React from 'react';
import { Crown, Shield, UserCheck, Pause, Play, Trash2, MoreVertical, Search, Loader } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../../contexts/ToastContext';

const ROLE_GROUPS = [
    { role: 'owner', label: 'Owner', Icon: Crown },
    { role: 'admin', label: 'Admin', Icon: Shield },
    { role: 'member', label: 'Member', Icon: UserCheck },
];

const roleBadge = (role) => {
    const styles = {
        owner: { color: 'var(--accent)', background: 'var(--bg-active)', border: '1px solid var(--border-accent)' },
        admin: { color: 'var(--text-secondary)', background: 'var(--bg-active)', border: '1px solid var(--border-default)' },
        member: { color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border-subtle)' },
    }[role] || { color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border-subtle)' };
    return (
        <span style={{ ...styles, fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '2px', textTransform: 'capitalize' }}>
            {role}
        </span>
    );
};

const menuBtn = { width: '100%', textAlign: 'left', padding: '7px 12px', fontSize: '12px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', transition: '150ms ease' };

const MembersTab = ({ activeWorkspace, isAdmin, members, loadingMembers, memberActionLoading = {}, openMemberDropdown, setOpenMemberDropdown, fetchMembers, refreshWorkspace }) => {
    const { showToast } = useToast();

    const handleSuspendMember = async (userId) => {
        if (!window.confirm('Suspend this member? They will lose workspace access.')) return;
        try {
            await api.post(`/api/workspaces/${activeWorkspace.id}/members/${userId}/suspend`);
            showToast('Member suspended', 'success'); fetchMembers(); setOpenMemberDropdown(null);
        } catch (err) { showToast(err.response?.data?.message || 'Failed to suspend member', 'error'); }
    };

    const handleRestoreMember = async (userId) => {
        try {
            await api.post(`/api/workspaces/${activeWorkspace.id}/members/${userId}/restore`);
            showToast('Member restored', 'success'); fetchMembers(); setOpenMemberDropdown(null);
        } catch (err) { showToast(err.response?.data?.message || 'Failed to restore member', 'error'); }
    };

    const handleRemoveMember = async (userId) => {
        if (!window.confirm('Remove this member? This cannot be undone.')) return;
        try {
            await api.post(`/api/workspaces/${activeWorkspace.id}/remove-member`, { userId });
            showToast('Member removed', 'success'); fetchMembers(); setOpenMemberDropdown(null);
        } catch (err) { showToast(err.response?.data?.message || 'Failed to remove member', 'error'); }
    };

    const handleChangeRole = async (userId, currentRole) => {
        const newRole = currentRole === 'admin' ? 'member' : 'admin';
        if (!window.confirm(`${newRole === 'admin' ? 'Promote to Admin' : 'Demote to Member'}?`)) return;
        try {
            await api.post(`/api/workspaces/${activeWorkspace.id}/members/${userId}/change-role`, { newRole });
            showToast(`Member ${newRole === 'admin' ? 'promoted to Admin' : 'demoted to Member'}`, 'success');
            fetchMembers(); await refreshWorkspace(); setOpenMemberDropdown(null);
        } catch (err) { showToast(err.response?.data?.message || 'Failed to change role', 'error'); }
    };

    const MemberRow = ({ member }) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', transition: 'background 150ms ease' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
            {/* Avatar + info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                    {member.avatar ? (
                        <img src={member.avatar} alt={member.name} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-default)' }} />
                    ) : (
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-active)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>
                            {member.name.charAt(0).toUpperCase()}
                        </div>
                    )}
                    {member.status === 'online' && (
                        <div style={{ position: 'absolute', bottom: '-1px', right: '-1px', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--state-success)', border: '1.5px solid var(--bg-surface)' }} />
                    )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.name}</span>
                        {member.isCurrentUser && (
                            <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 5px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', color: 'var(--accent)', borderRadius: '2px', flexShrink: 0 }}>You</span>
                        )}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.email}</div>
                </div>
            </div>

            {/* Role + actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                {member.memberStatus === 'suspended' && (
                    <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 6px', color: '#e59e0c', background: 'rgba(229,158,12,0.1)', border: '1px solid rgba(229,158,12,0.3)', borderRadius: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Pause size={9} /> Suspended
                    </span>
                )}
                {roleBadge(member.role)}
                {isAdmin && !member.isCurrentUser && (
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setOpenMemberDropdown(openMemberDropdown === member.id ? null : member.id)}
                            disabled={!!memberActionLoading[member.id]}
                            style={{ width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', borderRadius: '2px', transition: '150ms ease' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                            <MoreVertical size={14} />
                        </button>
                        {openMemberDropdown === member.id && (
                            <>
                                <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpenMemberDropdown(null)} />
                                <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '2px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', zIndex: 50, overflow: 'hidden', minWidth: '160px', animation: 'wsFadeIn 0.12s ease' }}>
                                    {member.memberStatus === 'suspended' ? (
                                        <button style={{ ...menuBtn, color: 'var(--state-success)' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                            onClick={() => handleRestoreMember(member.id)}
                                        >
                                            <Play size={12} /> Restore Access
                                        </button>
                                    ) : (
                                        <>
                                            <button style={{ ...menuBtn, color: 'var(--text-secondary)' }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                                onClick={() => handleChangeRole(member.id, member.role)}
                                            >
                                                {member.role === 'admin' ? <><UserCheck size={12} /> Demote to Member</> : <><Shield size={12} /> Promote to Admin</>}
                                            </button>
                                            <button style={{ ...menuBtn, color: '#e59e0c' }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                                onClick={() => handleSuspendMember(member.id)}
                                            >
                                                <Pause size={12} /> Suspend Member
                                            </button>
                                            <button style={{ ...menuBtn, color: 'var(--state-danger)' }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                                onClick={() => handleRemoveMember(member.id)}
                                            >
                                                <Trash2 size={12} /> Remove Member
                                            </button>
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div style={{ fontFamily: 'var(--font)' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>Manage who has access to this workspace.</p>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: '16px' }}>
                <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input type="text" placeholder="Search members…"
                    style={{ width: '100%', padding: '8px 10px 8px 30px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '2px', fontSize: '12px', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font)', boxSizing: 'border-box' }}
                    onFocus={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
                    onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                />
            </div>

            {loadingMembers ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '32px', color: 'var(--text-muted)' }}>
                    <Loader size={18} className="animate-spin" style={{ color: 'var(--accent)' }} />
                    <span style={{ fontSize: '12px' }}>Loading members…</span>
                </div>
            ) : members.length > 0 ? (
                <div style={{ border: '1px solid var(--border-subtle)', borderRadius: '2px', overflow: 'hidden' }}>
                    {ROLE_GROUPS.map(({ role, label, Icon }) => {
                        const group = members.filter(m => m.role === role);
                        if (!group.length) return null;
                        return (
                            <div key={role}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 12px', background: 'var(--bg-active)', borderBottom: '1px solid var(--border-subtle)' }}>
                                    <Icon size={12} style={{ color: role === 'owner' ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0 }} />
                                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                                        {label}{group.length > 1 ? 's' : ''} ({group.length})
                                    </span>
                                </div>
                                {group.map(m => <MemberRow key={m.id} member={m} />)}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div style={{ padding: '32px', textAlign: 'center', border: '1px dashed var(--border-default)', borderRadius: '2px' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>No members found</p>
                </div>
            )}
        </div>
    );
};

export default MembersTab;
