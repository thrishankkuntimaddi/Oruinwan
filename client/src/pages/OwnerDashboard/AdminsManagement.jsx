import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, UserPlus, Crown, Shield, Users, Wifi, ClipboardList, UserMinus } from 'lucide-react';
import api from '@services/api';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getCompanyMembers } from '../../services/companyService';
import {
    DashPage, PageHead, KpiGrid, Kpi, Toolbar, SearchBox, Btn, RoleChip, Dot, DataTable, Avatar, Dialog, Confirm, Field,
    LoadingState, ErrorState, EmptyState, useAsync, timeAgo, errorMessage,
} from '../../components/company-dash/dashUi';
import { idOf } from '../../components/company-dash/dashNav';
import './owner.css';

const isAdminRole = (m) => m.companyRole === 'owner' || m.companyRole === 'admin';

/**
 * Owner-only: who administers the company. Promote a member to admin, or
 * return an admin to member (PATCH /api/company/members/:id/role).
 */
const AdminsManagement = () => {
    const navigate = useNavigate();
    const { company } = useCompany();
    const { user } = useAuth();
    const { showToast } = useToast();
    const companyId = company?._id;

    const members = useAsync(
        () => getCompanyMembers(companyId).then((r) => r.members || []),
        [companyId],
        { enabled: !!companyId },
    );
    const [query, setQuery] = useState('');
    const [addOpen, setAddOpen] = useState(false);
    const [pick, setPick] = useState('');
    const [revoke, setRevoke] = useState(null);
    const [busy, setBusy] = useState(false);

    const all = useMemo(() => members.data || [], [members.data]);
    const admins = useMemo(() => all.filter(isAdminRole), [all]);
    const candidates = useMemo(
        () => all.filter((m) => !isAdminRole(m) && m.accountStatus !== 'removed' && m.companyRole !== 'guest'),
        [all],
    );
    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? admins.filter((a) => `${a.username} ${a.email}`.toLowerCase().includes(q)) : admins;
    }, [admins, query]);

    const setRole = async (member, newRole) => {
        setBusy(true);
        try {
            await api.patch(`/api/company/members/${member._id}/role`, { newRole });
            members.setData((list) => (list || []).map((m) => (m._id === member._id ? { ...m, companyRole: newRole } : m)));
            showToast(newRole === 'admin' ? `${member.username} is now an admin` : `${member.username} is no longer an admin`, 'success');
            return true;
        } catch (err) {
            showToast(errorMessage(err, 'Could not change the role'), 'error');
            return false;
        } finally {
            setBusy(false);
        }
    };

    const promote = async () => {
        const member = candidates.find((m) => m._id === pick);
        if (!member) return;
        if (await setRole(member, 'admin')) { setAddOpen(false); setPick(''); }
    };

    const owners = admins.filter((a) => a.companyRole === 'owner').length;
    const online = admins.filter((a) => a.isOnline).length;
    const me = idOf(user?._id || user?.id);

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow="Owner console"
                    icon={ShieldCheck}
                    title="Admins"
                    lead="People who can manage users, departments and workspaces"
                    actions={<Btn variant="primary" icon={UserPlus} onClick={() => setAddOpen(true)} disabled={!candidates.length}>Add admin</Btn>}
                />
            )}
        >
            {members.error ? <ErrorState message={members.error} onRetry={members.reload} /> : (
                <>
                    <KpiGrid>
                        <Kpi label="Administrators" icon={Shield} value={members.loading ? undefined : admins.length} loading={members.loading} hint="owners and admins" />
                        <Kpi label="Owners" icon={Crown} value={members.loading ? undefined : owners} loading={members.loading} hint="full control, including billing" />
                        <Kpi label="Online now" icon={Wifi} tone="success" value={members.loading ? undefined : online} loading={members.loading} hint="administrators signed in" />
                        <Kpi label="People" icon={Users} value={members.loading ? undefined : all.length} loading={members.loading} hint="in the whole company" />
                    </KpiGrid>

                    <Toolbar>
                        <SearchBox value={query} onChange={setQuery} placeholder="Search admins…" />
                    </Toolbar>

                    {members.loading ? <LoadingState /> : (
                        <DataTable
                            caption="Administrators"
                            rows={shown}
                            empty={<EmptyState icon={ShieldCheck} title={query ? 'No matching admins' : 'No administrators'} />}
                            columns={[
                                {
                                    key: 'name',
                                    label: 'Person',
                                    render: (a) => (
                                        <div className="cd-cell-user">
                                            <Avatar name={a.username} src={a.profilePicture} size="sm" />
                                            <div>
                                                <div className="cd-cell-title">{a.username}{idOf(a._id) === me ? ' (you)' : ''}</div>
                                                <div className="cd-cell-sub">{a.email}</div>
                                            </div>
                                        </div>
                                    ),
                                },
                                { key: 'role', label: 'Role', render: (a) => <RoleChip role={a.companyRole} /> },
                                {
                                    key: 'status',
                                    label: 'Status',
                                    className: 'cd-hide-sm',
                                    render: (a) => (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} className="cd-muted">
                                            <Dot tone={a.isOnline ? 'success' : undefined} />
                                            {a.isOnline ? 'Online' : a.lastLoginAt ? `Seen ${timeAgo(a.lastLoginAt)}` : 'Never signed in'}
                                        </span>
                                    ),
                                },
                                {
                                    key: 'actions',
                                    label: '',
                                    className: 'cd-num',
                                    render: (a) => (
                                        <span style={{ display: 'inline-flex', gap: 4 }}>
                                            <Btn size="sm" variant="ghost" icon={ClipboardList} onClick={() => navigate('/owner/audit-logs')} title="Open audit logs">
                                                <span className="cd-hide-sm">Activity</span>
                                            </Btn>
                                            {a.companyRole === 'admin' && (
                                                <Btn size="sm" variant="danger" icon={UserMinus} onClick={() => setRevoke(a)}>
                                                    <span className="cd-hide-sm">Remove admin</span>
                                                </Btn>
                                            )}
                                        </span>
                                    ),
                                },
                            ]}
                        />
                    )}
                </>
            )}

            <Dialog
                open={addOpen}
                title="Add an admin"
                lead="Admins can manage people, departments, workspaces and security logs. Billing stays with owners."
                onClose={() => setAddOpen(false)}
                busy={busy}
                footer={(
                    <>
                        <Btn variant="ghost" onClick={() => setAddOpen(false)} disabled={busy}>Cancel</Btn>
                        <Btn variant="primary" loading={busy} disabled={!pick} onClick={promote}>Make admin</Btn>
                    </>
                )}
            >
                {candidates.length === 0 ? (
                    <p className="cd-muted" style={{ margin: 0, fontSize: 13 }}>Everyone in the company is already an admin.</p>
                ) : (
                    <Field label="Person" htmlFor="admin-pick">
                        <select id="admin-pick" className="gl-input cd-select" value={pick} onChange={(e) => setPick(e.target.value)}>
                            <option value="">Choose a member…</option>
                            {candidates.map((m) => <option key={m._id} value={m._id}>{m.username} · {m.email} ({m.companyRole})</option>)}
                        </select>
                    </Field>
                )}
            </Dialog>

            <Confirm
                open={!!revoke}
                title="Remove admin rights?"
                tone="danger"
                confirmLabel="Remove admin"
                busy={busy}
                onClose={() => setRevoke(null)}
                onConfirm={async () => { if (await setRole(revoke, 'member')) setRevoke(null); }}
            >
                {revoke?.username} will become a regular member and lose access to the admin console.
            </Confirm>
        </DashPage>
    );
};

export default AdminsManagement;
