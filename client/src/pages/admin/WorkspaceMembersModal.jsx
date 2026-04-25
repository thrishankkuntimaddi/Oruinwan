import React, { useState, useEffect, useCallback } from 'react';
import { X, Users, UserPlus, Search, Shield, Crown, UserMinus, ChevronDown, Check } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';

const ACCENT_COLORS = ['#b8956a', '#5aba8a', '#7a5af8', '#e05252', '#38bdf8', '#f59e0b'];

const RoleBadge = ({ role }) => {
    const cfg = {
        owner: { color: 'var(--accent)', label: 'Owner' },
        admin: { color: '#7a5af8', label: 'Admin' },
        member: { color: 'var(--text-secondary)', label: 'Member' },
        manager: { color: 'var(--state-success)', label: 'Manager' },
        guest: { color: 'var(--text-muted)', label: 'Guest' },
    };
    const c = cfg[role] || cfg.member;
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 6px', fontSize: '10px', fontWeight: 700, color: c.color, border: `1px solid ${c.color}` }}>
            {role === 'owner' && <Crown size={9} />}
            {role === 'admin' && <Shield size={9} />}
            {c.label}
        </span>
    );
};

const Avatar = ({ user }) => {
    if (user.profilePicture) return <img src={user.profilePicture} alt={user.username} style={{ width: '32px', height: '32px', borderRadius: '0', objectFit: 'cover', flexShrink: 0 }} />;
    const initials = (user.username || '?').charAt(0).toUpperCase();
    const bg = ACCENT_COLORS[initials.charCodeAt(0) % ACCENT_COLORS.length];
    return (
        <div style={{ width: '32px', height: '32px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#000', flexShrink: 0 }}>{initials}</div>
    );
};

const RoleSelector = ({ value, onChange }) => {
    const [open, setOpen] = useState(false);
    const roles = [{ value: 'member', label: 'Member' }, { value: 'admin', label: 'Admin' }];
    return (
        <div style={{ position: 'relative' }}>
            <button type="button" onClick={() => setOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', background: 'var(--bg-active)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', borderRadius: '2px' }}>
                {roles.find(r => r.value === value)?.label} <ChevronDown size={11} />
            </button>
            {open && (
                <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '2px', width: '120px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', zIndex: 50 }}>
                    {roles.map(r => (
                        <button key={r.value} type="button" onClick={() => { onChange(r.value); setOpen(false); }}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'none', border: 'none', color: value === r.value ? 'var(--accent)' : 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textAlign: 'left', transition: 'all 150ms ease' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
                            {r.label} {value === r.value && <Check size={11} style={{ color: 'var(--accent)' }} />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const inputSt = {
    background: 'var(--bg-input)', border: '1px solid var(--border-default)',
    color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
    fontFamily: 'Inter, system-ui, sans-serif', padding: '7px 10px 7px 28px',
    width: '100%', boxSizing: 'border-box',
};

const WorkspaceMembersModal = ({ workspace, onClose, onMemberCountChange }) => {
    const { showToast } = useToast();
    const [tab, setTab] = useState('members');
    const [members, setMembers] = useState([]);
    const [companyMembers, setCompanyMembers] = useState([]);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [loadingCompany, setLoadingCompany] = useState(false);
    const [search, setSearch] = useState('');
    const [addSearch, setAddSearch] = useState('');
    const [addingId, setAddingId] = useState(null);
    const [removingId, setRemovingId] = useState(null);
    const [roleMap, setRoleMap] = useState({});

    const fetchMembers = useCallback(async () => {
        setLoadingMembers(true);
        try {
            const res = await api.get(`/api/admin-dashboard/workspaces/${workspace._id}/members`);
            setMembers(res.data.members || []);
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to load members', 'error');
        } finally { setLoadingMembers(false); }
    }, [workspace._id, showToast]);

    const fetchCompanyMembers = useCallback(async () => {
        setLoadingCompany(true);
        try {
            const res = await api.get('/api/admin-dashboard/company-members');
            setCompanyMembers(res.data.members || []);
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to load company members', 'error');
        } finally { setLoadingCompany(false); }
    }, [showToast]);

    useEffect(() => { fetchMembers(); fetchCompanyMembers(); }, [fetchMembers, fetchCompanyMembers]);

    const handleAdd = async (userId) => {
        setAddingId(userId);
        try {
            const role = roleMap[userId] || 'member';
            const res = await api.post(`/api/admin-dashboard/workspaces/${workspace._id}/members`, { userId, role });
            setMembers(prev => [...prev, res.data.member]);
            showToast(res.data.message, 'success');
            onMemberCountChange?.(members.length + 1);
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to add member', 'error');
        } finally { setAddingId(null); }
    };

    const handleRemove = async (userId) => {
        setRemovingId(userId);
        try {
            await api.delete(`/api/admin-dashboard/workspaces/${workspace._id}/members/${userId}`);
            setMembers(prev => prev.filter(m => String(m._id) !== String(userId)));
            showToast('Member removed', 'success');
            onMemberCountChange?.(members.length - 1);
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to remove member', 'error');
        } finally { setRemovingId(null); }
    };

    const memberIds = new Set(members.map(m => String(m._id)));
    const addableMembers = companyMembers.filter(m => !memberIds.has(String(m._id)));
    const filteredMembers = members.filter(m => m.username?.toLowerCase().includes(search.toLowerCase()) || m.email?.toLowerCase().includes(search.toLowerCase()));
    const filteredAddable = addableMembers.filter(m => m.username?.toLowerCase().includes(addSearch.toLowerCase()) || m.email?.toLowerCase().includes(addSearch.toLowerCase()));

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.6)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={{ width: '100%', maxWidth: '480px', height: '100%', background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>
                {}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', background: workspace.color || 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Users size={15} style={{ color: '#000' }} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{workspace.name}</h2>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Workspace Members · {members.length} total</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ padding: '6px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', borderRadius: '2px', transition: 'color 150ms ease' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                        <X size={16} />
                    </button>
                </div>

                {}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                    {[{ key: 'members', label: 'Members', icon: Users, count: members.length }, { key: 'add', label: 'Add Members', icon: UserPlus, count: addableMembers.length }].map(t => {
                        const active = tab === t.key;
                        return (
                            <button key={t.key} onClick={() => setTab(t.key)}
                                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`, color: active ? 'var(--accent)' : 'var(--text-muted)', fontSize: '12px', fontWeight: active ? 600 : 400, cursor: 'pointer', transition: 'all 150ms ease' }}>
                                <t.icon size={13} /> {t.label}
                                <span style={{ padding: '1px 6px', background: active ? 'var(--bg-active)' : 'var(--border-subtle)', color: active ? 'var(--accent)' : 'var(--text-muted)', fontSize: '10px', fontWeight: 700, borderRadius: '2px' }}>{t.count}</span>
                            </button>
                        );
                    })}
                </div>

                {}
                {tab === 'members' && (
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, position: 'relative' }}>
                            <Search size={12} style={{ position: 'absolute', left: '22px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                            <input type="text" placeholder="Search members…" value={search} onChange={e => setSearch(e.target.value)} style={inputSt} />
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }} className="custom-scrollbar">
                            {loadingMembers ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                                    <div style={{ width: '24px', height: '24px', border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                </div>
                            ) : filteredMembers.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                                    <Users size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                                    <p style={{ fontSize: '12px' }}>{search ? 'No members match your search' : 'No members yet'}</p>
                                </div>
                            ) : filteredMembers.map(m => (
                                <div key={m._id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', transition: 'background 150ms ease', position: 'relative' }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.querySelector('.remove-btn')?.classList.add('visible'); }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.querySelector('.remove-btn')?.classList.remove('visible'); }}>
                                    <div style={{ position: 'relative' }}>
                                        <Avatar user={m} />
                                        <span style={{ position: 'absolute', bottom: '-1px', right: '-1px', width: '8px', height: '8px', borderRadius: '50%', background: m.isOnline ? 'var(--state-success)' : 'var(--border-accent)', border: '2px solid var(--bg-surface)' }} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.username}</p>
                                            <RoleBadge role={m.workspaceRole} />
                                        </div>
                                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.companyEmail || m.email}</p>
                                    </div>
                                    {m.workspaceRole !== 'owner' && (
                                        <button className="remove-btn" onClick={() => handleRemove(m._id)} disabled={removingId === m._id} title="Remove from workspace"
                                            style={{ opacity: 0, padding: '4px', background: 'none', border: 'none', color: 'var(--state-danger)', cursor: 'pointer', borderRadius: '2px', transition: 'opacity 150ms ease' }}>
                                            {removingId === m._id
                                                ? <div style={{ width: '12px', height: '12px', border: '2px solid var(--state-danger)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                                : <UserMinus size={13} />}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {}
                {tab === 'add' && (
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                        <div style={{ margin: '10px 12px', padding: '10px 12px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'flex-start', gap: '8px', flexShrink: 0 }}>
                            <Shield size={12} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '1px' }} />
                            <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Only <strong style={{ color: 'var(--text-primary)' }}>company members</strong> can be added. External users are never shown.</p>
                        </div>
                        <div style={{ padding: '0 12px 10px', flexShrink: 0, position: 'relative' }}>
                            <Search size={12} style={{ position: 'absolute', left: '22px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                            <input type="text" placeholder="Search company members…" value={addSearch} onChange={e => setAddSearch(e.target.value)} style={inputSt} />
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }} className="custom-scrollbar">
                            {loadingCompany ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                                    <div style={{ width: '24px', height: '24px', border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                </div>
                            ) : filteredAddable.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '48px 16px' }}>
                                    <UserPlus size={28} style={{ color: 'var(--text-muted)', opacity: 0.4, margin: '0 auto 8px' }} />
                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{addSearch ? 'No company members match your search' : 'All company members are already in this workspace'}</p>
                                </div>
                            ) : filteredAddable.map(m => (
                                <div key={m._id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', transition: 'background 150ms ease' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                    <Avatar user={m} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.username}</p>
                                            <RoleBadge role={m.companyRole} />
                                        </div>
                                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.companyEmail || m.jobTitle || m.email}</p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                        <RoleSelector value={roleMap[m._id] || 'member'} onChange={role => setRoleMap(p => ({ ...p, [m._id]: role }))} />
                                        <button onClick={() => handleAdd(m._id)} disabled={addingId === m._id}
                                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', background: addingId === m._id ? 'var(--bg-active)' : 'var(--accent)', border: 'none', color: addingId === m._id ? 'var(--text-muted)' : 'var(--bg-base)', fontSize: '11px', fontWeight: 700, cursor: addingId === m._id ? 'not-allowed' : 'pointer', borderRadius: '2px', transition: 'all 150ms ease' }}>
                                            {addingId === m._id ? <div style={{ width: '10px', height: '10px', border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> : <UserPlus size={11} />}
                                            Add
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WorkspaceMembersModal;
