import React, { useState, useEffect, useCallback } from 'react';
import PublicPageShell from '../../components/layout/PublicPageShell';
import { RefreshCw } from 'lucide-react';
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

const STATUS_STYLE = {
    operational: { color: '#5aba8a', label: 'Operational' },
    degraded: { color: '#c9a87c', label: 'Degraded' },
    outage: { color: '#e05252', label: 'Unavailable' },
    unknown: { color: '#7a7a7a', label: 'Unknown' },
    checking: { color: '#7a7a7a', label: 'Checking…' },
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
    const summaryColor = STATUS_STYLE[summary.status].color;

    return (
        <PublicPageShell title="Status">
            <div style={{ borderBottom: '1px solid var(--border-subtle)', padding: '72px 0 56px' }}>
                <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '0 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
                        <div>
                            <div data-testid="status-summary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: `${summaryColor}14`, border: `1px solid ${summaryColor}40`, marginBottom: '20px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: summaryColor, animation: summary.status === 'operational' ? 'pulse 2s ease-in-out infinite' : 'none' }} />
                                <span style={{ fontSize: '12px', fontWeight: 700, color: summaryColor, letterSpacing: '0.03em' }}>{summary.text}</span>
                            </div>
                            <h1 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: '10px' }}>System Status</h1>
                            <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Live checks run from your browser, refreshed every 30 seconds</p>
                        </div>
                        <button onClick={refresh} disabled={spinning}
                            style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 16px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, cursor: spinning ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                            <RefreshCw size={12} style={{ animation: spinning ? 'spin 0.8s linear infinite' : 'none' }} />
                            Refresh
                        </button>
                    </div>
                    <style>{`@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.4)} } @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }`}</style>
                </div>
            </div>

            <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '56px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(184,149,106,0.7)' }}>Services</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {lastUpdated ? `Last checked: ${lastUpdated.toLocaleTimeString()}` : 'Checking…'}
                    </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--bg-hover)' }}>
                    {CHECKS.map(({ key, name }) => {
                        const r = results?.[key] || { status: 'checking' };
                        const st = STATUS_STYLE[r.status] || STATUS_STYLE.unknown;
                        return (
                            <div key={key} data-testid={`status-${key}`} style={{ background: 'var(--bg-surface)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: st.color, flexShrink: 0, display: 'inline-block' }} />
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{name}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                                    {r.latency != null && (
                                        <div style={{ textAlign: 'right' }}>
                                            <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '1px' }}>Response time</p>
                                            <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{r.latency}ms</p>
                                        </div>
                                    )}
                                    {r.detail && r.status !== 'operational' && (
                                        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.detail}</p>
                                    )}
                                    <div style={{ padding: '3px 8px', border: `1px solid ${st.color}40`, fontSize: '10px', fontWeight: 700, color: st.color, textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: '90px', textAlign: 'center' }}>
                                        {st.label}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '16px', lineHeight: 1.7 }}>
                    These checks show whether the service is reachable from where you are right now. If something looks wrong, contact support from inside the app.
                </p>
            </div>
        </PublicPageShell>
    );
}
