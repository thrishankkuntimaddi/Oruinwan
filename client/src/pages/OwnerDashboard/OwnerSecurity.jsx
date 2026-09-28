import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Shield, AlertTriangle, CheckCircle, XCircle, AlertCircle, Activity, RefreshCw, Monitor, Globe,
    Download, FileText, ClipboardList, ShieldCheck, Lock, Settings, AtSign,
} from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';
import { getSecurityRisk } from '../../services/ownerDashboardService';
import {
    DashPage, PageHead, Section, KpiGrid, Kpi, Panel, Grid, FilterTabs, Btn, Chip, DataTable, Avatar,
    LoadingState, ErrorState, EmptyState, useAsync, timeAgo, errorMessage,
} from '../../components/company-dash/dashUi';
import './owner.css';

const EVENT_ICON = { success: CheckCircle, warning: AlertTriangle, critical: XCircle, info: AlertCircle };
const EVENT_FILTERS = [
    { value: 'all', label: 'All' },
    { value: 'login', label: 'Sign-ins' },
    { value: 'access', label: 'Access' },
    { value: 'changes', label: 'Changes' },
];

/** Owner security: real sessions, security events and audit counts. */
const OwnerSecurity = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [eventType, setEventType] = useState('all');
    const [exporting, setExporting] = useState(false);

    const risk = useAsync(() => getSecurityRisk(), []);
    const sessions = useAsync(() => api.get('/api/owner-dashboard/active-sessions').then((r) => r.data.sessions || []), []);
    const events = useAsync(
        () => api.get('/api/owner-dashboard/security-events', { params: { limit: 50, type: eventType } }).then((r) => r.data.events || []),
        [eventType],
    );

    const refresh = useCallback(() => { risk.reload(); sessions.reload(); events.reload(); }, [risk, sessions, events]);

    const exportAudit = async () => {
        setExporting(true);
        try {
            const res = await api.get('/api/company/audit-logs/export', { params: { format: 'csv' }, responseType: 'blob' });
            const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) {
            showToast(errorMessage(err, 'Could not export the audit log'), 'error');
        } finally {
            setExporting(false);
        }
    };

    const audit = risk.data?.auditSummary || {};
    const domain = risk.data?.emailDomain;

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow="Owner console"
                    icon={Shield}
                    title="Security & risk"
                    lead="Who is signed in, and what sensitive changes happened this week"
                    actions={(
                        <>
                            <Btn icon={Download} loading={exporting} onClick={exportAudit}>Export audit log</Btn>
                            <Btn icon={RefreshCw} onClick={refresh}>Refresh</Btn>
                        </>
                    )}
                />
            )}
        >
            {risk.error ? <ErrorState message={risk.error} onRetry={risk.reload} /> : (
                <KpiGrid>
                    <Kpi label="Signed in · 24h" icon={Activity} value={risk.data?.activeSessions} loading={risk.loading} hint="people who logged in today" />
                    <Kpi
                        label="Critical actions"
                        icon={AlertTriangle}
                        tone={audit.critical ? 'danger' : 'muted'}
                        value={audit.critical}
                        loading={risk.loading}
                        hint="suspensions, removals, role changes · 7 days"
                    />
                    <Kpi label="Audit events" icon={FileText} value={audit.lastWeek} loading={risk.loading} hint="recorded in the last 7 days" />
                    <Kpi
                        label="Active sessions"
                        icon={Monitor}
                        value={sessions.data?.length}
                        loading={sessions.loading}
                        hint="devices active in the last 24h"
                    />
                </KpiGrid>
            )}

            <Section title="Active sessions" lead="Devices that used Oruinwan in the last 24 hours">
                {sessions.loading ? <LoadingState /> : sessions.error ? <ErrorState message={sessions.error} onRetry={sessions.reload} /> : (
                    <DataTable
                        caption="Active sessions"
                        maxHeight={360}
                        rows={sessions.data || []}
                        rowKey={(s) => s.id}
                        empty={<EmptyState icon={Monitor} title="No active sessions" text="Nobody has an active session in the last 24 hours." />}
                        columns={[
                            {
                                key: 'user',
                                label: 'Person',
                                render: (s) => (
                                    <div className="cd-cell-user">
                                        <Avatar name={s.user} size="sm" />
                                        <div>
                                            <div className="cd-cell-title">{s.user}</div>
                                            <div className="cd-cell-sub">{s.email}</div>
                                        </div>
                                    </div>
                                ),
                            },
                            { key: 'device', label: 'Device', render: (s) => [s.device, s.browser, s.os].filter(Boolean).join(' · ') || '—' },
                            { key: 'location', label: 'Location', className: 'cd-hide-sm', render: (s) => <span className="cd-muted"><Globe size={11} /> {s.location || '—'}</span> },
                            { key: 'ip', label: 'IP', className: 'cd-hide-sm', render: (s) => <span className="od-mono">{s.ip || '—'}</span> },
                            { key: 'lastActive', label: 'Last active', render: (s) => <span className="cd-muted">{timeAgo(s.lastActive)}</span> },
                        ]}
                    />
                )}
            </Section>

            <Section title="Failed sign-ins" lead="Accounts with failed password attempts in the last 24 hours">
                {risk.loading ? <LoadingState /> : risk.error ? null : (
                    <DataTable
                        caption="Failed sign-ins"
                        maxHeight={300}
                        rows={risk.data?.suspiciousLogins || []}
                        rowKey={(r) => `${r.email}-${r.at}`}
                        empty={<EmptyState icon={ShieldCheck} title="No failed sign-ins" text="Nobody in your company failed to sign in during the last 24 hours." />}
                        columns={[
                            { key: 'email', label: 'Account', render: (r) => r.email || '—' },
                            { key: 'attempts', label: 'Attempts', className: 'cd-num', render: (r) => <Chip tone={r.attempts >= 5 ? 'danger' : 'warning'}>{r.attempts ?? '—'}</Chip> },
                            { key: 'ip', label: 'IP', className: 'cd-hide-sm', render: (r) => <span className="od-mono">{r.ipAddress || '—'}</span> },
                            { key: 'at', label: 'Last attempt', render: (r) => <span className="cd-muted">{timeAgo(r.at)}</span> },
                        ]}
                    />
                )}
            </Section>

            <Section
                title="Security events"
                lead="Sign-ins, access and account changes from the last 7 days"
                action={<FilterTabs label="Event type" value={eventType} onChange={setEventType} options={EVENT_FILTERS} />}
            >
                <Panel flush>
                    {events.loading ? <LoadingState /> : events.error ? <ErrorState message={events.error} onRetry={events.reload} />
                        : (events.data || []).length === 0 ? (
                            <EmptyState icon={ShieldCheck} title="No security events" text="Nothing matching this filter was recorded in the last 7 days." />
                        ) : (
                            <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                                {events.data.map((ev) => {
                                    const Icon = EVENT_ICON[ev.type] || AlertCircle;
                                    return (
                                        <div key={ev.id} className="od-event">
                                            <span className="od-event-icon" data-tone={ev.type}><Icon size={15} /></span>
                                            <div className="od-event-main">
                                                <div className="od-event-title">{ev.event}</div>
                                                <div className="od-event-text">{ev.details}</div>
                                                <div className="od-event-meta">
                                                    <span>by {ev.user}</span>
                                                    <span>{ev.timestamp ? new Date(ev.timestamp).toLocaleString() : '—'}</span>
                                                    {ev.ipAddress && ev.ipAddress !== 'N/A' && <span className="od-mono">{ev.ipAddress}</span>}
                                                </div>
                                            </div>
                                            <Chip tone={ev.type === 'critical' ? 'danger' : ev.type === 'warning' ? 'warning' : ev.type === 'success' ? 'success' : undefined}>{ev.type}</Chip>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                </Panel>
            </Section>

            <Grid cols="2">
                <Panel title="Access control" icon={Lock}>
                    <div className="od-kv">
                        <div className="od-kv-row">
                            <span><AtSign size={12} /> Company email domain</span>
                            <span>{risk.loading ? '…' : domain ? `@${domain}` : 'Not set'}</span>
                        </div>
                        <div className="od-kv-row">
                            <span>Roles</span>
                            <span>Owner · Admin · Manager · Member · Guest</span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                        <Btn size="sm" icon={Settings} onClick={() => navigate('/owner/settings')}>Company settings</Btn>
                        <Btn size="sm" icon={Shield} onClick={() => navigate('/owner/permission-matrix')}>Permission matrix</Btn>
                    </div>
                </Panel>
                <Panel title="Records" icon={ClipboardList}>
                    <p className="cd-muted" style={{ fontSize: 12.5, margin: '0 0 12px', lineHeight: 1.55 }}>
                        Full, searchable history of administrative actions and compliance events for your company.
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Btn size="sm" icon={ClipboardList} onClick={() => navigate('/owner/audit-logs')}>Audit logs</Btn>
                        <Btn size="sm" icon={ShieldCheck} onClick={() => navigate('/owner/compliance-logs')}>Compliance logs</Btn>
                        <Btn size="sm" icon={Activity} onClick={() => navigate('/owner/analytics')}>Activity health</Btn>
                    </div>
                </Panel>
            </Grid>
        </DashPage>
    );
};

export default OwnerSecurity;
