import React from 'react';
import api from '@services/api';
import { useNavigate } from 'react-router-dom';
import {
    Building2, Users, LifeBuoy, CreditCard, Activity, CheckCircle2, AlertTriangle,
    Megaphone, CheckSquare, ArrowRight, RefreshCcw, Clock,
} from 'lucide-react';
import {
    DashPage, PageHead, Section, Panel, KpiGrid, Kpi, Btn, Chip, EmptyState, ErrorState,
    LoadingState, useAsync, timeAgo, Grid,
} from '../../../../components/company-dash/dashUi';

const money = (n) => `$${Number(n || 0).toLocaleString()}`;

const Overview = () => {
    const navigate = useNavigate();
    const stats = useAsync(() => api.get('/api/admin/overview/stats').then((r) => r.data));
    const activity = useAsync(() => api.get('/api/admin/overview/activities').then((r) => (Array.isArray(r.data) ? r.data : [])));
    // Real liveness: the public health probe (API process + MongoDB connection).
    const health = useAsync(() => api.get('/api/health').then((r) => r.data));

    const s = stats.data || {};
    const healthy = health.data?.status === 'healthy' && health.data?.mongodb === 'connected';
    const growth = Number(s.companiesGrowth);

    const reload = () => { stats.reload(); activity.reload(); health.reload(); };

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow="Platform"
                    title="Overview"
                    lead="Companies, people and support across Oruinwan."
                    actions={<Btn icon={RefreshCcw} onClick={reload} loading={stats.loading && !!stats.data}>Refresh</Btn>}
                />
            )}
        >
            <div className="gl-card pf-banner" data-tone={health.loading ? undefined : healthy ? 'success' : 'danger'}>
                {health.loading ? <Clock size={18} className="cd-muted" />
                    : healthy ? <CheckCircle2 size={18} style={{ color: 'var(--state-success)' }} />
                        : <AlertTriangle size={18} style={{ color: 'var(--state-danger)' }} />}
                <div className="pf-grow">
                    <div className="pf-banner-title">
                        {health.loading ? 'Checking the API…' : healthy ? 'API and database are up' : 'The health check is failing'}
                    </div>
                    <div className="pf-banner-sub">
                        {health.data
                            ? `Database ${health.data.mongodb} · API up ${Math.round((health.data.uptime || 0) / 60)} min · checked ${new Date(health.data.timestamp).toLocaleTimeString()}`
                            : health.error || 'GET /api/health'}
                    </div>
                </div>
                <Btn size="sm" onClick={() => navigate('/platform-admin/health')}>System health <ArrowRight size={13} /></Btn>
            </div>

            {stats.error ? <ErrorState message={stats.error} onRetry={stats.reload} /> : (
                <KpiGrid>
                    <Kpi
                        label="Verified companies" icon={Building2} loading={stats.loading && !stats.data} value={s.totalCompanies}
                        hint={Number.isFinite(growth) && growth !== 0 ? 'vs. a month ago' : 'Approved and live'}
                        delta={Number.isFinite(growth) && growth !== 0 ? `${growth > 0 ? '+' : ''}${growth}%` : undefined}
                        deltaTone={growth > 0 ? 'up' : 'down'}
                        onClick={() => navigate('/platform-admin/companies')}
                    />
                    <Kpi label="Active accounts" icon={Users} loading={stats.loading && !stats.data} value={s.activeUsers} hint="Accounts with status active" />
                    <Kpi label="Open tickets" icon={LifeBuoy} loading={stats.loading && !stats.data} value={s.openTickets} hint="Waiting on support" onClick={() => navigate('/platform-admin/tickets')} />
                    <Kpi label="Monthly recurring" icon={CreditCard} loading={stats.loading && !stats.data} value={stats.data ? money(s.monthlyRevenue) : undefined} hint="Active monthly billing records" onClick={() => navigate('/platform-admin/billing')} />
                </KpiGrid>
            )}

            {s.pendingRequests > 0 && (
                <div className="gl-card pf-banner" data-tone="accent">
                    <AlertTriangle size={18} style={{ color: 'var(--accent)' }} />
                    <div className="pf-grow">
                        <div className="pf-banner-title">{s.pendingRequests} company registration{s.pendingRequests > 1 ? 's' : ''} waiting</div>
                        <div className="pf-banner-sub">Review documents and approve or reject.</div>
                    </div>
                    <Btn variant="primary" size="sm" onClick={() => navigate('/platform-admin/pending')}>Review <ArrowRight size={13} /></Btn>
                </div>
            )}

            <Grid cols="2">
                <Panel title="Recent activity" icon={Activity} flush action={<Chip>Latest 20</Chip>}>
                    {activity.loading && !activity.data ? <LoadingState /> : activity.error ? (
                        <ErrorState message={activity.error} onRetry={activity.reload} />
                    ) : (activity.data || []).length === 0 ? (
                        <EmptyState icon={Activity} title="No activity yet" text="Audit events from every company show up here." />
                    ) : (
                        <div className="cd-list" style={{ maxHeight: 380, overflowY: 'auto' }}>
                            {activity.data.map((a, i) => (
                                <div className="cd-list-row" key={`${a.timestamp}-${i}`}>
                                    <span className="cd-dot" data-tone="accent" />
                                    <div className="cd-grow">
                                        <div className="cd-cell-title" style={{ fontWeight: 500 }}>{a.description || a.type}</div>
                                        {a.description && <div className="cd-cell-sub">{a.type}</div>}
                                    </div>
                                    <span className="cd-muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }} title={new Date(a.timestamp).toLocaleString()}>{timeAgo(a.timestamp)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </Panel>

                <Section title="Quick actions">
                    <Grid min={180}>
                        {[
                            { icon: CheckSquare, title: 'Review requests', desc: 'Verify new companies', to: '/platform-admin/pending' },
                            { icon: Megaphone, title: 'Send a broadcast', desc: 'Announce to companies', to: '/platform-admin/broadcast' },
                            { icon: LifeBuoy, title: 'Support tickets', desc: 'Answer company issues', to: '/platform-admin/tickets' },
                            { icon: Activity, title: 'System health', desc: 'Host, database, data volume', to: '/platform-admin/health' },
                        ].map((q) => (
                            <button key={q.to} type="button" className="gl-card gl-card--interactive pf-action" onClick={() => navigate(q.to)}>
                                <q.icon size={16} />
                                <span className="pf-action-title">{q.title}</span>
                                <span className="pf-action-desc">{q.desc}</span>
                            </button>
                        ))}
                    </Grid>
                </Section>
            </Grid>
        </DashPage>
    );
};

export default Overview;
