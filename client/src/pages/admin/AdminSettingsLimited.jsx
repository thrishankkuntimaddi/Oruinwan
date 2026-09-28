import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Building, ShieldCheck, Bell, Check, X, UserRound, Settings } from 'lucide-react';
import { useCompany } from '../../contexts/CompanyContext';
import { DashPage, PageHead, Grid, Panel, Btn, Chip, LoadingState } from '../../components/company-dash/dashUi';
import './admin.css';

const yes = (v) => (v === undefined || v === null ? '—' : v ? 'On' : 'Off');

const CAN = [
    [true, 'Invite, onboard and import people (member, manager, guest)'],
    [true, 'Suspend, reactivate and remove managers, members and guests'],
    [true, 'Create departments, set heads and move people between them'],
    [true, 'Create workspaces and manage their members'],
    [true, 'Read audit, security and compliance logs'],
    [false, 'Grant or remove the admin role, or act on other admins'],
    [false, 'Change billing, plan, domain, SSO or company-wide security'],
    [false, 'Transfer or delete the company'],
];

/**
 * Admin "settings": the company configuration is owner-controlled, so admins
 * get a read-only view of it, what their role can do, and links to the
 * settings they do own (their account and notifications).
 */
const AdminSettingsLimited = () => {
    const navigate = useNavigate();
    const { company, loading } = useCompany();
    const s = company?.settings || {};
    const sec = company?.securitySettings || {};

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow="System"
                    title="Settings"
                    lead="Company settings are managed by the owner. Here is how they are set, and what you can change."
                    actions={<Btn icon={UserRound} onClick={() => navigate('/admin/profile')}>My admin profile</Btn>}
                />
            )}
        >
            <Grid cols="2">
                <Panel title="Company" icon={Building}>
                    {loading && !company ? <LoadingState /> : (
                        <dl className="ad-kv" style={{ margin: 0 }}>
                            <dt>Name</dt><dd>{company?.displayName || company?.name || '—'}</dd>
                            <dt>Domain</dt><dd>{company?.domain ? <>{company.domain} {company.domainVerified ? <Chip tone="success">verified</Chip> : <Chip tone="warning">unverified</Chip>}</> : '—'}</dd>
                            <dt>Plan</dt><dd style={{ textTransform: 'capitalize' }}>{company?.plan || '—'}</dd>
                            <dt>Time zone</dt><dd>{s.timezone || '—'}</dd>
                            <dt>Default role for invites</dt><dd style={{ textTransform: 'capitalize' }}>{company?.invitePolicy?.defaultRole || '—'}</dd>
                            <dt>Auto-join by domain</dt><dd>{yes(company?.autoJoinByDomain)}</dd>
                            <dt>Members can create workspaces</dt><dd>{yes(s.allowMemberWorkspaceCreation)}</dd>
                            <dt>Limits</dt><dd>{s.maxUsers ? `${s.maxUsers} people · ${s.maxWorkspaces ?? '—'} workspaces` : '—'}</dd>
                        </dl>
                    )}
                </Panel>
                <Panel title="Security policy" icon={ShieldCheck}>
                    {loading && !company ? <LoadingState /> : (
                        <dl className="ad-kv" style={{ margin: 0 }}>
                            <dt>Two-factor required</dt><dd>{yes(sec.mfaRequired)}</dd>
                            <dt>Minimum password length</dt><dd>{sec.passwordMinLength ?? '—'}</dd>
                            <dt>Session timeout</dt><dd>{sec.sessionTimeoutMinutes ? `${Math.round(sec.sessionTimeoutMinutes / 60)} h` : '—'}</dd>
                            <dt>Enforce SSO</dt><dd>{yes(sec.enforceSSO)}</dd>
                            <dt>SSO</dt><dd>{yes(company?.ssoEnabled)}</dd>
                        </dl>
                    )}
                </Panel>
            </Grid>

            <Grid cols="2">
                <Panel title="What admins can do" icon={ShieldCheck} flush>
                    <div className="cd-list">
                        {CAN.map(([ok, text]) => (
                            <div className="cd-list-row" key={text}>
                                {ok ? <Check size={14} style={{ color: 'var(--state-success)', flexShrink: 0 }} /> : <X size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />}
                                <span className="cd-grow" style={{ color: ok ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{text}</span>
                            </div>
                        ))}
                    </div>
                </Panel>
                <Panel title="Your settings" icon={Settings}>
                    <p className="cd-hint" style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.6 }}>
                        Email and push notifications, appearance, security and sessions are per person — change yours in account settings.
                    </p>
                    <div className="cd-head-actions">
                        <Btn icon={Bell} onClick={() => navigate('/settings?tab=notifications')}>Notifications</Btn>
                        <Btn icon={Settings} onClick={() => navigate('/settings')}>Account settings</Btn>
                    </div>
                </Panel>
            </Grid>
        </DashPage>
    );
};

export default AdminSettingsLimited;
