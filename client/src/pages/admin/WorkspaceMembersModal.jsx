import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { UserPlus, UserMinus, Crown, Shield } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';
import {
    Dialog, Btn, IconBtn, Chip, RoleChip, FilterTabs, SearchBox, EmptyState, LoadingState, ErrorState, Avatar, errorMessage,
} from '../../components/company-dash/dashUi';
import './admin.css';

const WS_ROLE = {
    owner: <Chip tone="accent"><Crown size={11} /> Owner</Chip>,
    admin: <Chip tone="accent"><Shield size={11} /> Admin</Chip>,
};

/** Add / remove company people in one workspace (admin-dashboard endpoints). */
const WorkspaceMembersModal = ({ workspace, onClose, onMemberCountChange }) => {
    const { showToast } = useToast();
    const [tab, setTab] = useState('members');
    const [members, setMembers] = useState(null);
    const [company, setCompany] = useState(null);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');
    const [busyId, setBusyId] = useState(null);
    const [roleMap, setRoleMap] = useState({});

    const load = useCallback(async () => {
        setError(null);
        try {
            const [m, c] = await Promise.all([
                api.get(`/api/admin-dashboard/workspaces/${workspace._id}/members`),
                api.get('/api/admin-dashboard/company-members'),
            ]);
            setMembers(m.data.members || []);
            setCompany(c.data.members || []);
        } catch (err) {
            setError(errorMessage(err, 'Could not load members'));
        }
    }, [workspace._id]);

    useEffect(() => { load(); }, [load]);

    const q = search.trim().toLowerCase();
    const match = (m) => !q || m.username?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q);
    const memberIds = useMemo(() => new Set((members || []).map((m) => String(m._id))), [members]);
    const shownMembers = (members || []).filter(match);
    const addable = (company || []).filter((m) => !memberIds.has(String(m._id)) && (m.accountStatus || 'active') === 'active').filter(match);

    const add = async (u) => {
        setBusyId(u._id);
        try {
            const res = await api.post(`/api/admin-dashboard/workspaces/${workspace._id}/members`, { userId: u._id, role: roleMap[u._id] || 'member' });
            const next = [...(members || []), res.data.member || { ...u, workspaceRole: roleMap[u._id] || 'member' }];
            setMembers(next);
            onMemberCountChange?.(next.length);
            showToast(`${u.username} added to ${workspace.name}`, 'success');
        } catch (err) {
            showToast(errorMessage(err, 'Could not add member'), 'error');
        } finally { setBusyId(null); }
    };

    const remove = async (u) => {
        setBusyId(u._id);
        try {
            await api.delete(`/api/admin-dashboard/workspaces/${workspace._id}/members/${u._id}`);
            const next = (members || []).filter((m) => String(m._id) !== String(u._id));
            setMembers(next);
            onMemberCountChange?.(next.length);
            showToast(`${u.username} removed`, 'success');
        } catch (err) {
            showToast(errorMessage(err, 'Could not remove member'), 'error');
        } finally { setBusyId(null); }
    };

    return (
        <Dialog open size="lg" title={workspace.name} lead="Workspace members" onClose={onClose}>
            <FilterTabs
                value={tab}
                onChange={(v) => { setTab(v); setSearch(''); }}
                label="Members sections"
                options={[
                    { value: 'members', label: 'Members', count: members ? members.length : undefined },
                    { value: 'add', label: 'Add people', count: company ? (company.filter((m) => !memberIds.has(String(m._id))).length) : undefined },
                ]}
            />
            <SearchBox value={search} onChange={setSearch} placeholder="Search by name or email…" />
            {error ? <ErrorState message={error} onRetry={load} /> : !members || !company ? <LoadingState /> : tab === 'members' ? (
                shownMembers.length === 0 ? <EmptyState title={q ? 'No match' : 'No members yet'} /> : (
                    <div className="gl-card cd-list" style={{ maxHeight: 380, overflowY: 'auto' }}>
                        {shownMembers.map((m) => (
                            <div className="cd-list-row" key={m._id}>
                                <Avatar user={m} size="sm" />
                                <div className="cd-grow">
                                    <div className="cd-cell-title">{m.username}</div>
                                    <div className="cd-cell-sub">{m.email}</div>
                                </div>
                                {WS_ROLE[m.workspaceRole] || null}
                                <span className="cd-hide-sm"><RoleChip role={m.companyRole} /></span>
                                {m.workspaceRole !== 'owner' && (
                                    <IconBtn label={`Remove ${m.username}`} disabled={busyId === m._id} onClick={() => remove(m)}>
                                        <UserMinus size={15} />
                                    </IconBtn>
                                )}
                            </div>
                        ))}
                    </div>
                )
            ) : (
                addable.length === 0 ? <EmptyState title={q ? 'No match' : 'Everyone is already a member'} /> : (
                    <div className="gl-card cd-list" style={{ maxHeight: 380, overflowY: 'auto' }}>
                        {addable.map((u) => (
                            <div className="cd-list-row" key={u._id}>
                                <Avatar user={u} size="sm" />
                                <div className="cd-grow">
                                    <div className="cd-cell-title">{u.username}</div>
                                    <div className="cd-cell-sub">{u.jobTitle || u.email}</div>
                                </div>
                                <select
                                    className="gl-input cd-select"
                                    aria-label={`Workspace role for ${u.username}`}
                                    value={roleMap[u._id] || 'member'}
                                    onChange={(e) => setRoleMap((r) => ({ ...r, [u._id]: e.target.value }))}
                                    style={{ width: 110, height: 28 }}
                                >
                                    <option value="member">Member</option>
                                    <option value="admin">Admin</option>
                                </select>
                                <Btn size="sm" icon={UserPlus} loading={busyId === u._id} onClick={() => add(u)}>Add</Btn>
                            </div>
                        ))}
                    </div>
                )
            )}
        </Dialog>
    );
};

export default WorkspaceMembersModal;
