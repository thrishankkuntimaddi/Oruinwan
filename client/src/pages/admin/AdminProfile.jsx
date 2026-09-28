import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRound, KeyRound, Bell, Building, ShieldCheck, MonitorSmartphone } from 'lucide-react';
import api from '@services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { DashPage, PageHead, Grid, Panel, Btn, Chip, RoleChip, Avatar, LoadingState, useAsync, timeAgo } from '../../components/company-dash/dashUi';
import { idOf } from '../../components/company-dash/dashNav';
import { getDepartments } from '../../services/departmentService';
import './admin.css';

/**
 * The signed-in admin's profile inside the console: who they are in the company
 * and what they manage. Personal details, password and 2FA are edited in
 * Account settings (one place for every user), so this page links there.
 */
const AdminProfile = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { company } = useCompany();
    const me = idOf(user?._id || user?.id);

    const { data: me2, loading } = useAsync(() => api.get('/api/auth/me').then((r) => r.data?.user || r.data), []);
    const { data: depts } = useAsync(() => getDepartments(company?._id).then((r) => r.departments || []), [company?._id], { enabled: !!company?._id });

    const u = { ...user, ...(me2 || {}) };
    const mine = (depts || []).filter((d) => (d.members || []).some((m) => idOf(m) === me));
    const heads = (depts || []).filter((d) => idOf(d.head) === me);
    const twoFa = u.twoFactorEnabled ?? u.security?.twoFactorEnabled;

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow="Account"
                    title="My profile"
                    lead="Your identity in the company. Personal details and security live in account settings."
                    actions={<Btn variant="primary" icon={UserRound} onClick={() => navigate('/settings?tab=profile')}>Edit profile</Btn>}
                />
            )}
        >
            <div className="gl-card ad-card" style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                <Avatar user={u} size="lg" />
                <div style={{ minWidth: 0, flex: 1 }}>
                    <h2 className="ad-card-title" style={{ fontSize: 18 }}>{u.profile?.name || u.username || u.email}</h2>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
                        <RoleChip role={u.companyRole} />
                        <span className="cd-muted" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Building size={11} /> {company?.displayName || company?.name || '—'}</span>
                        <span className="cd-muted" style={{ fontSize: 12 }}>{u.email}</span>
                    </div>
                </div>
            </div>

            <Grid cols="2">
                <Panel title="Details" icon={UserRound}>
                    {loading && !me2 ? <LoadingState /> : (
                        <dl className="ad-kv" style={{ margin: 0 }}>
                            <dt>Name</dt><dd>{u.profile?.name || u.username || '—'}</dd>
                            <dt>Job title</dt><dd>{u.jobTitle || '—'}</dd>
                            <dt>Work email</dt><dd>{u.email || '—'}</dd>
                            <dt>Phone</dt><dd>{u.phone || '—'}</dd>
                            <dt>Member since</dt><dd>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</dd>
                            <dt>Last sign-in</dt><dd>{u.lastLoginAt ? timeAgo(u.lastLoginAt) : '—'}</dd>
                        </dl>
                    )}
                </Panel>
                <Panel title="In the company" icon={Building}>
                    <dl className="ad-kv" style={{ margin: 0 }}>
                        <dt>Role</dt><dd><RoleChip role={u.companyRole} /></dd>
                        <dt>Departments</dt>
                        <dd>{!depts ? '—' : mine.length ? <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>{mine.map((d) => <Chip key={d._id}>{d.name}</Chip>)}</span> : 'None'}</dd>
                        <dt>Head of</dt>
                        <dd>{!depts ? '—' : heads.length ? heads.map((d) => d.name).join(', ') : 'None'}</dd>
                        <dt>Workspaces</dt><dd>{Array.isArray(u.workspaces) ? u.workspaces.length : '—'}</dd>
                    </dl>
                </Panel>
            </Grid>

            <Panel title="Security & preferences" icon={ShieldCheck} flush>
                <div className="cd-list">
                    <div className="cd-list-row">
                        <KeyRound size={15} className="cd-muted" />
                        <div className="cd-grow">
                            <div className="cd-cell-title">Password & two-factor</div>
                            <div className="cd-cell-sub">{twoFa === undefined ? 'Manage your password and authenticator app' : twoFa ? 'Two-factor is on' : 'Two-factor is off — recommended for admins'}</div>
                        </div>
                        {twoFa === false && <Chip tone="warning">Action needed</Chip>}
                        <Btn size="sm" onClick={() => navigate('/settings?tab=security')}>Open</Btn>
                    </div>
                    <div className="cd-list-row">
                        <MonitorSmartphone size={15} className="cd-muted" />
                        <div className="cd-grow">
                            <div className="cd-cell-title">Sessions & devices</div>
                            <div className="cd-cell-sub">See where you are signed in and sign out elsewhere</div>
                        </div>
                        <Btn size="sm" onClick={() => navigate('/settings?tab=sessions')}>Open</Btn>
                    </div>
                    <div className="cd-list-row">
                        <Bell size={15} className="cd-muted" />
                        <div className="cd-grow">
                            <div className="cd-cell-title">Notifications</div>
                            <div className="cd-cell-sub">Email, push and in-app alerts</div>
                        </div>
                        <Btn size="sm" onClick={() => navigate('/settings?tab=notifications')}>Open</Btn>
                    </div>
                </div>
            </Panel>
        </DashPage>
    );
};

export default AdminProfile;
