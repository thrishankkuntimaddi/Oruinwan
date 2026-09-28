import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, MessageSquare } from 'lucide-react';
import { Dialog, Btn, Chip, Avatar } from '../../../../components/company-dash/dashUi';

const ownerOf = (c) => (c?.admins || []).find((a) => a.role === 'owner')?.user || c?.admins?.[0]?.user || null;
const yes = (v) => (v ? 'Yes' : 'No');

/**
 * Read-only company facts for platform staff, from the /api/admin/active-companies
 * record. Plan changes and suspension have no platform API yet, so they are not offered.
 */
const CompanyDetail = ({ company, onClose }) => {
    const navigate = useNavigate();
    const c = company;
    const owner = ownerOf(c);
    const limits = c?.settings || {};
    const admins = (c?.admins || []).filter((a) => a.user);

    return (
        <Dialog
            open={!!c}
            size="lg"
            title={c?.displayName || c?.name || 'Company'}
            lead={c?.domain || 'No domain'}
            onClose={onClose}
            footer={c && (
                <>
                    <Btn icon={ClipboardList} onClick={() => navigate(`/platform-admin/logs?companyId=${c._id}`)}>Audit logs</Btn>
                    {owner?._id && <Btn icon={MessageSquare} onClick={() => navigate(`/platform-admin/dm/user/${owner._id}`)}>Message owner</Btn>}
                    <Btn variant="primary" onClick={onClose}>Done</Btn>
                </>
            )}
        >
            {c && (
                <>
                    <div className="cd-cell-user">
                        <Avatar name={c.name} src={c.logo} size="lg" />
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <Chip tone="accent">{(c.plan || 'free').replace(/^./, (m) => m.toUpperCase())}</Chip>
                            {c.isActive === false ? <Chip tone="danger">Suspended</Chip> : <Chip tone="success">Active</Chip>}
                            {c.isSetupComplete ? <Chip>Setup complete</Chip> : <Chip tone="warning">Setup step {c.setupStep || 0} of 4</Chip>}
                            {c.domainVerified && <Chip tone="success">Domain verified</Chip>}
                        </div>
                    </div>
                    <dl className="pf-facts">
                        <div><dt>Owner</dt><dd>{owner ? `${owner.username || owner.name} · ${owner.email}` : '—'}</dd></div>
                        <div><dt>Billing email</dt><dd>{c.billingEmail || '—'}</dd></div>
                        <div><dt>Registered</dt><dd>{new Date(c.createdAt).toLocaleString()}</dd></div>
                        <div><dt>Timezone</dt><dd>{limits.timezone || '—'}</dd></div>
                        <div><dt>Invite only</dt><dd>{yes(c.invitePolicy?.requireInvite)}</dd></div>
                        <div><dt>Auto-join by domain</dt><dd>{yes(c.autoJoinByDomain)}</dd></div>
                        <div><dt>SSO</dt><dd>{c.ssoEnabled ? (c.ssoProvider || 'Enabled') : 'Off'}</dd></div>
                        <div><dt>MFA required</dt><dd>{yes(c.securitySettings?.mfaRequired)}</dd></div>
                    </dl>
                    <div className="cd-field">
                        <span className="cd-label">Plan limits</span>
                        <dl className="pf-facts">
                            <div><dt>Users</dt><dd>{limits.maxUsers ?? '—'}</dd></div>
                            <div><dt>Workspaces</dt><dd>{limits.maxWorkspaces ?? '—'}</dd></div>
                            <div><dt>Channels / workspace</dt><dd>{limits.maxChannelsPerWorkspace ?? '—'}</dd></div>
                            <div><dt>Data retention</dt><dd>{limits.dataRetentionDays ? `${limits.dataRetentionDays} days` : '—'}</dd></div>
                        </dl>
                    </div>
                    <div className="cd-field">
                        <span className="cd-label">Company admins ({admins.length})</span>
                        <div className="cd-list gl-card">
                            {admins.length === 0 ? <div className="cd-list-row cd-muted">No admins recorded</div> : admins.map((a) => (
                                <div className="cd-list-row" key={a.user._id || a.user}>
                                    <Avatar user={a.user} size="sm" />
                                    <div className="cd-grow">
                                        <div className="cd-cell-title" style={{ fontWeight: 500 }}>{a.user.username || a.user.name || '—'}</div>
                                        <div className="cd-cell-sub">{a.user.email}</div>
                                    </div>
                                    <Chip tone={a.role === 'owner' ? 'accent' : undefined}>{a.role}</Chip>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </Dialog>
    );
};

export default CompanyDetail;
