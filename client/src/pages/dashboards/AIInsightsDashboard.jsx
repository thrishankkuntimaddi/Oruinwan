// client/src/pages/dashboards/AIInsightsDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const apiFetch = async (path, token) => {
    const res = await fetch(path, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
};

// ─── CSS Bar Chart (no external libs) ─────────────────────────────────────────
const BarChart = ({ data = [], label, color = '#8b5cf6' }) => {
    const max = Math.max(...data.map(d => d.value), 1);
    return (
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {data.map((d, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ width:90, fontSize:11, color:'#94a3b8', textOverflow:'ellipsis', overflow:'hidden', whiteSpace:'nowrap', flexShrink:0 }}>
                        {d.label}
                    </span>
                    <div style={{ flex:1, background:'rgba(255,255,255,0.06)', borderRadius:4, height:16, overflow:'hidden' }}>
                        <div style={{
                            width:`${(d.value/max)*100}%`, height:'100%',
                            background:`linear-gradient(90deg, ${color}, ${color}99)`,
                            borderRadius:4, transition:'width 0.6s ease',
                        }}/>
                    </div>
                    <span style={{ width:30, fontSize:11, color:'#64748b', textAlign:'right', flexShrink:0 }}>{d.value}</span>
                </div>
            ))}
        </div>
    );
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ icon, label, value, sub, color='#8b5cf6' }) => (
    <div style={{
        background:'rgba(255,255,255,0.04)', border:`1px solid ${color}33`,
        borderRadius:12, padding:'16px 18px', flex:1, minWidth:120,
    }}>
        <div style={{ fontSize:22, marginBottom:6 }}>{icon}</div>
        <div style={{ fontSize:26, fontWeight:800, color, marginBottom:2 }}>{value ?? '–'}</div>
        <div style={{ fontSize:12, fontWeight:600, color:'#e2e8f0', marginBottom:2 }}>{label}</div>
        {sub && <div style={{ fontSize:11, color:'#64748b' }}>{sub}</div>}
    </div>
);

// ─── Anomaly Banner ───────────────────────────────────────────────────────────
const AnomalyBanner = ({ anomalies=[], summary }) => {
    if (!anomalies.length) return (
        <div style={{ padding:'10px 14px', background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.25)', borderRadius:8, fontSize:13, color:'#6ee7b7' }}>
            🟢 {summary || 'No anomalies detected — workspace looks healthy!'}
        </div>
    );
    return (
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {anomalies.map((a, i) => (
                <div key={i} style={{
                    padding:'10px 14px', borderRadius:8, fontSize:13,
                    background: a.severity==='high' ? 'rgba(239,68,68,0.1)' : 'rgba(251,191,36,0.1)',
                    border: `1px solid ${a.severity==='high' ? 'rgba(239,68,68,0.3)' : 'rgba(251,191,36,0.3)'}`,
                    color: a.severity==='high' ? '#fca5a5' : '#fde68a',
                }}>
                    {a.severity==='high' ? '🔴' : '🟡'} {a.message}
                </div>
            ))}
        </div>
    );
};

// ─── Section Wrapper ──────────────────────────────────────────────────────────
const Section = ({ title, children, action }) => (
    <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:'18px 20px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <h3 style={{ margin:0, fontSize:14, fontWeight:700, color:'#e2e8f0' }}>{title}</h3>
            {action}
        </div>
        {children}
    </div>
);

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function AIInsightsDashboard({ workspaceId, token }) {
    const [days, setDays]           = useState(7);
    const [productivity, setProd]   = useState(null);
    const [collab, setCollab]       = useState(null);
    const [engagement, setEng]      = useState(null);
    const [anomalies, setAnomalies] = useState(null);
    const [loading, setLoading]     = useState(false);
    const [error, setError]         = useState(null);

    const loadAll = useCallback(async () => {
        if (!workspaceId || !token) return;
        setLoading(true); setError(null);
        const base = `/api/ai/insights`;
        try {
            const [p, c, e, a] = await Promise.allSettled([
                apiFetch(`${base}/productivity?workspaceId=${workspaceId}&days=${days}`, token),
                apiFetch(`${base}/collaboration?workspaceId=${workspaceId}&days=${days}`, token),
                apiFetch(`${base}/engagement?workspaceId=${workspaceId}&days=${days}`, token),
                apiFetch(`${base}/anomalies?workspaceId=${workspaceId}`, token),
            ]);
            if (p.status==='fulfilled') setProd(p.value);
            if (c.status==='fulfilled') setCollab(c.value);
            if (e.status==='fulfilled') setEng(e.value);
            if (a.status==='fulfilled') setAnomalies(a.value);
        } catch (err) { setError('Failed to load insights'); }
        finally { setLoading(false); }
    }, [workspaceId, token, days]);

    useEffect(() => { loadAll(); }, [loadAll]);

    const pageStyle = {
        padding:'28px 32px', minHeight:'100vh',
        background:'var(--bg-primary, #0f0e1a)',
        color:'#f1f5f9', fontFamily:'Inter, system-ui, sans-serif',
    };

    const channelBars = (collab?.topChannels || []).slice(0,6).map((c,i) => ({
        label: `Channel ${i+1}`, value: c.messageCount,
    }));

    const topContributorBars = (engagement?.topContributors || []).slice(0,8).map((u,i) => ({
        label: `User ${u.rank || i+1}`, value: u.messages,
    }));

    return (
        <div style={pageStyle}>
            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28 }}>
                <div>
                    <h1 style={{ margin:0, fontSize:24, fontWeight:800, background:'linear-gradient(135deg,#8b5cf6,#6366f1)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
                        AI Insights
                    </h1>
                    <p style={{ margin:'4px 0 0 0', fontSize:13, color:'#64748b' }}>
                        Workspace analytics powered by Chttrix AI
                    </p>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    {[7,14,30].map(d => (
                        <button key={d} onClick={() => setDays(d)} style={{
                            padding:'6px 14px', borderRadius:7, cursor:'pointer',
                            background: days===d ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${days===d ? '#8b5cf6' : 'rgba(255,255,255,0.1)'}`,
                            color: days===d ? '#a78bfa' : '#64748b',
                            fontSize:12, fontWeight:600, fontFamily:'inherit', transition:'all 0.15s',
                        }}>{d}d</button>
                    ))}
                    <button onClick={loadAll} disabled={loading} style={{
                        padding:'6px 12px', borderRadius:7, cursor:'pointer',
                        background:'rgba(139,92,246,0.15)', border:'1px solid rgba(139,92,246,0.3)',
                        color:'#a78bfa', fontSize:12, fontFamily:'inherit',
                    }}>
                        {loading ? '↺' : '↺ Refresh'}
                    </button>
                </div>
            </div>

            {error && <div style={{ marginBottom:16, padding:'10px 14px', background:'rgba(239,68,68,0.12)', borderRadius:8, fontSize:13, color:'#fca5a5' }}>⚠️ {error}</div>}

            {/* Anomalies */}
            <div style={{ marginBottom:20 }}>
                <AnomalyBanner anomalies={anomalies?.anomalies||[]} summary={anomalies?.summary} />
            </div>

            {/* Stats Row */}
            <div style={{ display:'flex', gap:14, flexWrap:'wrap', marginBottom:20 }}>
                <StatCard icon="💬" label="Messages" value={productivity?.messageCount ?? '…'} sub={productivity?.period} color="#8b5cf6" />
                <StatCard icon="👥" label="Active Users" value={productivity?.activeUsers ?? '…'} sub={productivity?.period} color="#6366f1" />
                <StatCard icon="✅" label="Tasks Done" value={productivity?.tasksCompleted ?? '…'} sub={`of ${productivity?.tasksCreated ?? '?'} created`} color="#34d399" />
                <StatCard icon="📊" label="Completion" value={productivity?.completionRate != null ? `${productivity.completionRate}%` : '…'} sub="Task completion rate" color="#f59e0b" />
                <StatCard icon="🔀" label="Threads" value={collab?.activeThreads ?? '…'} sub={`${collab?.totalReplies ?? '?'} total replies`} color="#ec4899" />
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                {/* Channel Activity */}
                <Section title="📢 Channel Activity">
                    {channelBars.length > 0
                        ? <BarChart data={channelBars} color="#8b5cf6" />
                        : <p style={{ color:'#475569', fontSize:13, margin:0 }}>No channel data for this period.</p>
                    }
                </Section>

                {/* Top Contributors */}
                <Section title="🏆 Top Contributors">
                    {topContributorBars.length > 0
                        ? <BarChart data={topContributorBars} color="#6366f1" />
                        : <p style={{ color:'#475569', fontSize:13, margin:0 }}>No contributor data for this period.</p>
                    }
                </Section>
            </div>

            {/* Loading overlay */}
            {loading && (
                <div style={{ position:'fixed', bottom:24, right:24, padding:'10px 16px', background:'rgba(139,92,246,0.2)', border:'1px solid rgba(139,92,246,0.4)', borderRadius:8, fontSize:13, color:'#c4b5fd' }}>
                    ↺ Loading insights…
                </div>
            )}
        </div>
    );
}
