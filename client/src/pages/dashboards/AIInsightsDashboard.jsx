import React, { useState, useEffect, useCallback } from 'react';
import {
    Sparkles, RefreshCcw, CheckCircle2, Percent,
    ShieldCheck, AlertTriangle, Activity,
} from 'lucide-react';
import { useOptionalWorkspace } from '../../contexts/WorkspaceContext';
import {
    DashPage, PageHead, Panel, KpiGrid, Kpi, Toolbar, FilterTabs, Btn, ErrorState,
} from '../../components/ui/page';
import '../toolkit/toolkit.css';

const apiFetch = async (path, token) => {
    const res = await fetch(path, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
};

/** Horizontal bars; lengths carry the data, colour is the theme accent. */

const stripEmoji = (s) => (s ? String(s).replace(/\s*[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim() : s);

/** Health line: one calm notice when all is well, one row per finding otherwise. */
const HealthPanel = ({ anomalies = [], loaded }) => {
    if (!loaded) return null;
    if (!anomalies.length) {
        return (
            <div className="tk-notice" data-tone="success">
                <ShieldCheck size={15} />
                <span>Nothing unusual in the last week. Activity looks healthy.</span>
            </div>
        );
    }
    return (
        <Panel flush title="Needs a look" icon={AlertTriangle}>
            <ul className="tk-list">
                {anomalies.map((a, i) => (
                    <li key={i} className="tk-row">
                        <div className="tk-row-main">
                            <span className="tk-mark" data-size="sm" style={a.severity === 'high' ? { color: 'var(--state-danger)', borderColor: 'color-mix(in srgb, var(--state-danger) 35%, transparent)', background: 'color-mix(in srgb, var(--state-danger) 10%, transparent)' } : undefined}>
                                <Activity size={14} />
                            </span>
                            <span className="tk-row-text">
                                <span className="tk-row-title">{stripEmoji(a.message)}</span>
                                <span className="tk-row-meta">{a.severity === 'high' ? 'High' : 'Medium'} priority</span>
                            </span>
                        </div>
                    </li>
                ))}
            </ul>
        </Panel>
    );
};

const PERIODS = [
    { value: 7, label: '7 days' },
    { value: 14, label: '14 days' },
    { value: 30, label: '30 days' },
];

export default function AIInsightsDashboard({ workspaceId, token }) {
    const ws = useOptionalWorkspace();
    const [days, setDays]           = useState(7);
    const [productivity, setProd]   = useState(null);
    const [anomalies, setAnomalies] = useState(null);
    const [loading, setLoading]     = useState(false);
    const [error, setError]         = useState(null);

    const loadAll = useCallback(async () => {
        if (!workspaceId || !token) return;
        setLoading(true); setError(null);
        const base = `/api/ai/insights`;
        try {
            // Work only: conversations are private, so nothing here counts or ranks messages.
            const [p, a] = await Promise.allSettled([
                apiFetch(`${base}/productivity?workspaceId=${workspaceId}&days=${days}`, token),
                apiFetch(`${base}/anomalies?workspaceId=${workspaceId}`, token),
            ]);
            if (p.status==='fulfilled') setProd(p.value);
            if (a.status==='fulfilled') setAnomalies(a.value);
            if ([p, a].every((r) => r.status === 'rejected')) setError('Could not load insights for this workspace');
        } catch (err) { setError('Could not load insights for this workspace'); }
        finally { setLoading(false); }
    }, [workspaceId, token, days]);

    useEffect(() => { loadAll(); }, [loadAll]);

    const first = loading && !productivity;
    const wsName = ws?.activeWorkspace?.name;

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow={wsName ? `${wsName} · Insights` : 'Insights'}
                    title="AI insights"
                    icon={Sparkles}
                    lead="How work is moving: task progress and anything unusual Oruinwan AI noticed."
                    actions={<Btn variant="ghost" icon={RefreshCcw} loading={loading} onClick={loadAll}>Refresh</Btn>}
                />
            )}
        >
            <Toolbar>
                <FilterTabs value={days} onChange={setDays} options={PERIODS} label="Period" />
            </Toolbar>

            {error ? (
                <Panel><ErrorState message={error} onRetry={loadAll} /></Panel>
            ) : (
                <>
                    <HealthPanel anomalies={anomalies?.anomalies || []} loaded={Boolean(anomalies)} />

                    <KpiGrid min={170}>
                        <Kpi label="Tasks done" value={productivity?.tasksCompleted} icon={CheckCircle2} tone="success" loading={first}
                            hint={productivity ? `of ${productivity.tasksCreated ?? 0} created` : undefined} />
                        <Kpi label="Completion" value={productivity?.completionRate != null ? `${productivity.completionRate}%` : null} icon={Percent} loading={first} hint="Of tasks created" />
                    </KpiGrid>

                    <p style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>
                        <ShieldCheck size={14} /> Conversations are private. Insights cover work only, never messages or who talks to whom.
                    </p>
                </>
            )}
        </DashPage>
    );
}
