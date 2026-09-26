import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Activity } from 'lucide-react';
import PublicPageShell from '../../components/layout/PublicPageShell';
import { PageHero, Block, Callout } from '../../components/public/PublicKit';
import { API_BASE } from '../../services/api';

// Live checks run from the visitor's browser. Nothing here is recorded over time,
// so the page shows current state and measured response time only (no uptime
// history or incident log until a real monitor feeds them).

const TIMEOUT_MS = 8000;
const AUTO_REFRESH_MS = 30000;

async function timed(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const started = performance.now();
    try {
        const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        const ms = Math.round(performance.now() - started);
        return { res, ms };
    } finally {
        clearTimeout(timer);
    }
}

async function runChecks() {
    const results = {};

    try {
        const { res, ms } = await timed(`${API_BASE}/api/health`);
        const body = await res.json().catch(() => ({}));
        results.api = { status: res.status < 500 ? 'operational' : 'outage', latency: ms };
        results.database = {
            status: body.mongodb === 'connected' ? 'operational' : body.mongodb ? 'degraded' : 'outage',
            detail: body.mongodb || 'unknown',
        };
    } catch {
        results.api = { status: 'outage' };
        results.database = { status: 'unknown', detail: 'API unreachable' };
    }

    try {
        // The Socket.IO handshake answers before authentication, so it shows the
        // real-time endpoint is accepting connections.
        const { res, ms } = await timed(`${API_BASE}/socket.io/?EIO=4&transport=polling&t=${Date.now()}`);
        results.realtime = { status: res.ok ? 'operational' : 'outage', latency: ms };
    } catch {
        results.realtime = { status: 'outage' };
    }

    return results;
}

const CHECKS = [
    { key: 'api', name: 'Web API' },
    { key: 'database', name: 'Database' },
    { key: 'realtime', name: 'Real-time messaging (WebSocket)' },
];

// Maps each check state to the kit's status-dot modifier and a label.
const STATUS_STYLE = {
    operational: { tone: 'ok', label: 'Operational' },
    degraded: { tone: 'warn', label: 'Degraded' },
    outage: { tone: 'down', label: 'Unavailable' },
    unknown: { tone: 'idle', label: 'Unknown' },
    checking: { tone: 'idle', label: 'Checking…' },
};

function overall(results) {
    if (!results) return { status: 'checking', text: 'Checking systems…' };
    const states = CHECKS.map(c => results[c.key]?.status);
    if (states.every(s => s === 'operational')) return { status: 'operational', text: 'All Systems Operational' };
    if (states.includes('outage')) return { status: 'outage', text: 'Service Disruption' };
    return { status: 'degraded', text: 'Partial Degradation' };
}

export default function Status() {
    const [results, setResults] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [spinning, setSpinning] = useState(false);

    const refresh = useCallback(async () => {
        setSpinning(true);
        const next = await runChecks();
        setResults(next);
        setLastUpdated(new Date());
        setSpinning(false);
    }, []);

    useEffect(() => {
        refresh();
        const t = setInterval(refresh, AUTO_REFRESH_MS);
        return () => clearInterval(t);
    }, [refresh]);

    const summary = overall(results);
    const summaryTone = STATUS_STYLE[summary.status].tone;

    return (
        <PublicPageShell title="Status">
            <PageHero
                crumb="Status"
                eyebrow="System status"
                icon={Activity}
                title={<>System <span className="orw-gloss-text">status.</span></>}
                lead="Live checks run from your browser, refreshed every 30 seconds."
                actions={
                    <button type="button" className="orw-btn orw-btn--ghost" onClick={refresh} disabled={spinning} aria-busy={spinning}>
                        <RefreshCw size={14} aria-hidden="true" />
                        {spinning ? 'Checking…' : 'Refresh now'}
                    </button>
                }
            />

            <Block>
                <div className="orw-glass" data-reveal aria-live="polite"
                    style={{ padding: 'clamp(24px, 4vw, 40px)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
                    <div>
                        <p className="orw-eyebrow">Overall</p>
                        <h2 className="orw-h2" style={{ fontSize: 'clamp(24px, 3.4vw, 36px)' }}>
                            <span className={`orw-status orw-status--${summaryTone}`} style={{ font: 'inherit', gap: 14 }}>
                                <span data-testid="status-summary">{summary.text}</span>
                            </span>
                        </h2>
                    </div>
                    <p className="orw-hint">
                        {lastUpdated ? `Last checked ${lastUpdated.toLocaleTimeString()}` : 'Running first check…'}
                    </p>
                </div>
            </Block>

            <Block eyebrow="Services" title="Component checks" slab>
                <div className="orw-rows" data-reveal>
                    {CHECKS.map(({ key, name }) => {
                        const r = results?.[key] || { status: 'checking' };
                        const st = STATUS_STYLE[r.status] || STATUS_STYLE.unknown;
                        return (
                            <div key={key} className="orw-row" data-testid={`status-${key}`}>
                                <div>
                                    <h3>{name}</h3>
                                    {r.detail && r.status !== 'operational' && <p>{r.detail}</p>}
                                    {r.latency != null && (
                                        <div className="orw-row__meta">
                                            <span className="orw-tag">Response time <span className="orw-code" style={{ marginLeft: 6 }}>{r.latency}ms</span></span>
                                        </div>
                                    )}
                                </div>
                                <span className={`orw-status orw-status--${st.tone}`}>{st.label}</span>
                            </div>
                        );
                    })}
                </div>
                <Callout>
                    These checks show whether the service is reachable from where you are right now. Nothing is recorded over time, so there is no uptime history here. If something looks wrong, contact support from inside the app.
                </Callout>
            </Block>
        </PublicPageShell>
    );
}
