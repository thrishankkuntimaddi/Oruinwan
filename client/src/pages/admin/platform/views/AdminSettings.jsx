import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, ShieldCheck, UserRound, KeyRound } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { DashPage, PageHead, Panel, Grid, Btn, Chip, Avatar } from '../../../../components/company-dash/dashUi';

/**
 * The signed-in staff member's own account. Profile, password, 2FA and
 * sessions are edited in the shared account settings (/settings).
 */
const AdminSettings = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const roles = (user?.roles || []).filter(Boolean);

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow="System"
                    title="My account"
                    lead="Your platform staff account."
                    actions={<Btn variant="primary" icon={Settings} onClick={() => navigate('/settings')}>Account settings</Btn>}
                />
            )}
        >
            <Panel>
                <div className="cd-cell-user" style={{ gap: 14 }}>
                    <Avatar user={user} size="lg" />
                    <div>
                        <div className="cd-cell-title" style={{ fontSize: 16 }}>{user?.profile?.name || user?.username || '—'}</div>
                        <div className="cd-cell-sub">{user?.email}</div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                            <Chip tone="accent"><ShieldCheck size={11} /> Platform staff</Chip>
                            {user?.verified && <Chip tone="success">Email verified</Chip>}
                        </div>
                    </div>
                </div>
            </Panel>
            <Grid cols="2">
                <Panel title="Account" icon={UserRound}>
                    <dl className="pf-facts">
                        <div><dt>Username</dt><dd>{user?.username || '—'}</dd></div>
                        <div><dt>Email</dt><dd>{user?.email || '—'}</dd></div>
                        <div><dt>Roles</dt><dd>{roles.length ? roles.join(', ') : '—'}</dd></div>
                        <div><dt>Account type</dt><dd>{user?.userType || '—'}</dd></div>
                    </dl>
                </Panel>
                <Panel title="Security" icon={KeyRound}>
                    <p className="cd-muted" style={{ fontSize: 13, margin: '0 0 12px', lineHeight: 1.6 }}>
                        Change your password, turn on two-factor authentication and review signed-in devices in account settings.
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Btn onClick={() => navigate('/settings?tab=security')}>Security</Btn>
                        <Btn onClick={() => navigate('/settings?tab=profile')}>Profile</Btn>
                    </div>
                </Panel>
            </Grid>
        </DashPage>
    );
};

export default AdminSettings;
