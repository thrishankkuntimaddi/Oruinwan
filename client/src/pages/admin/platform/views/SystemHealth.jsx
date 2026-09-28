import React, { useEffect } from 'react';
import api from '@services/api';
import {
    Cpu, MemoryStick, Database, Clock, RefreshCcw, CheckCircle2, AlertTriangle, Info,
    Users, Building2, Layers, Globe, Hash, MessageSquare, CheckSquare, FileText,
} from 'lucide-react';
import {
    DashPage, PageHead, Section, Panel, KpiGrid, Kpi, Grid, Meter, Btn, ErrorState, LoadingState, useAsync,
} from '../../../../components/company-dash/dashUi';

const toneFor = (pct) => (pct >= 85 ? 'danger' : pct >= 65 ? undefined : 'success');
const fmtUptime = (min) => {
    if (min === null || min === undefined) return '—';
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    return h < 48 ? `${h} h ${min % 60} min` : `${Math.floor(h / 24)} d ${h % 24} h`;
};

const SystemHealth = () => {
    const metrics = useAsync(() => api.get('/api/admin/health/metrics').then((r) => r.data));
    const probe = useAsync(() => api.get('/api/health').then((r) => r.data));

    useEffect(() => {
        const t = setInterval(() => { metrics.reload(); probe.reload(); }, 30000);
        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const m = metrics.data;
    const e = m?.entities || {};
    const healthy = probe.data?.status === 'healthy' && probe.data?.mongodb === 'connected';
    const refresh = () => { metrics.reload(); probe.reload(); };

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow="System"
                    title="System health"
                    lead="Live readings from the API host and database. Refreshes every 30 seconds."
                    actions={<Btn icon={RefreshCcw} onClick={refresh} loading={metrics.loading && !!m}>Refresh</Btn>}
                />
            )}
        >
            <div className="gl-card pf-banner" data-tone={probe.loading && !probe.data ? undefined : healthy ? 'success' : 'danger'}>
                {healthy ? <CheckCircle2 size={18} style={{ color: 'var(--state-success)' }} /> : <AlertTriangle size={18} style={{ color: probe.loading ? 'var(--text-secondary)' : 'var(--state-danger)' }} />}
                <div className="pf-grow">
                    <div className="pf-banner-title">
                        {probe.loading && !probe.data ? 'Checking…' : healthy ? 'API and database are up' : 'Health check failing'}
                    </div>
                    <div className="pf-banner-sub">
                        {probe.data ? `${probe.data.environment || ''} · database ${probe.data.mongodb} · checked ${new Date(probe.data.timestamp).toLocaleTimeString()}` : probe.error || '—'}
                    </div>
                </div>
            </div>

            {metrics.loading && !m ? <LoadingState /> : metrics.error ? (
                <ErrorState message={metrics.error} onRetry={metrics.reload} />
            ) : (
                <>
                    <Section title="Host" lead="Readings from the machine running this API process.">
                        <Grid min={220}>
                            <Panel title="CPU" icon={Cpu}>
                                <div className="pf-bar-row">
                                    <div className="pf-bar-top"><span>Average busy time since boot</span><strong>{m.server?.cpuUsage ?? '—'}%</strong></div>
                                    <Meter value={m.server?.cpuUsage} tone={toneFor(m.server?.cpuUsage)} label="CPU usage" />
                                </div>
                            </Panel>
                            <Panel title="Memory" icon={MemoryStick}>
                                <div className="pf-bar-row">
                                    <div className="pf-bar-top"><span>Host memory in use</span><strong>{m.server?.memoryUsage ?? '—'}%</strong></div>
                                    <Meter value={m.server?.memoryUsage} tone={toneFor(m.server?.memoryUsage)} label="Memory usage" />
                                </div>
                            </Panel>
                        </Grid>
                        <KpiGrid>
                            <Kpi label="API uptime" icon={Clock} value={fmtUptime(m.server?.uptime)} hint="Since the process started" />
                            <Kpi label="Database" icon={Database} tone={m.database?.connections ? 'success' : 'danger'} value={m.database?.connections ? 'Connected' : 'Down'} hint="MongoDB connection" />
                            <Kpi label="Data size" icon={Database} value={m.database?.size !== undefined ? `${m.database.size} MB` : undefined} hint="Stored documents" />
                            <Kpi label="Collections" icon={Layers} value={m.database?.collections} />
                        </KpiGrid>
                    </Section>

                    <Section title="Data volume" lead="Counts across every company.">
                        <KpiGrid min={170}>
                            <Kpi label="Users" icon={Users} value={e.users?.total} hint={e.users ? `${e.users.active} active` : undefined} />
                            <Kpi label="Companies" icon={Building2} value={e.companies?.total} hint={e.companies ? `${e.companies.verified} verified · ${e.companies.pending} pending` : undefined} />
                            <Kpi label="Departments" icon={Layers} value={e.departments} />
                            <Kpi label="Workspaces" icon={Globe} value={e.workspaces} />
                            <Kpi label="Channels" icon={Hash} value={e.channels} />
                            <Kpi label="Messages" icon={MessageSquare} value={e.messages} />
                            <Kpi label="Tasks" icon={CheckSquare} value={e.tasks} />
                            <Kpi label="Notes" icon={FileText} value={e.notes} />
                        </KpiGrid>
                    </Section>

                    <div className="gl-card pf-banner" style={{ alignItems: 'flex-start' }}>
                        <Info size={15} className="cd-muted" />
                        <div className="pf-grow pf-banner-sub" style={{ marginTop: 0 }}>
                            Request latency, error rate, requests per minute and disk usage are not collected yet, so they are not shown.
                        </div>
                    </div>

                    {Array.isArray(m.errors) && m.errors.length > 0 && (
                        <Panel title="Recent errors" icon={AlertTriangle} flush>
                            <div className="cd-list">
                                {m.errors.map((err, i) => (
                                    <div className="cd-list-row" key={i} style={{ alignItems: 'flex-start' }}>
                                        <div className="cd-grow">
                                            <div className="cd-cell-title" style={{ color: 'var(--state-danger)' }}>{err.message}</div>
                                            {err.stack && <div className="cd-cell-sub" style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{err.stack}</div>}
                                        </div>
                                        <span className="cd-muted" style={{ fontSize: 12 }}>{err.timestamp ? new Date(err.timestamp).toLocaleTimeString() : ''}</span>
                                    </div>
                                ))}
                            </div>
                        </Panel>
                    )}
                </>
            )}
        </DashPage>
    );
};

export default SystemHealth;
