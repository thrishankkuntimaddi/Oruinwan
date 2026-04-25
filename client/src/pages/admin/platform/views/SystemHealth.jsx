import React, { useState, useEffect } from 'react';
import api from '@services/api';
import { Activity, Cpu, Database, HardDrive, Zap, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

const SystemHealth = () => {
    const [metrics, setMetrics] = useState({
        server: { cpuUsage: 0, memoryUsage: 0, diskUsage: 0, uptime: 0 },
        database: { connections: 0, size: 0, collections: 0, queryPerformance: 0 },
        api: { responseTime: { p50: 0, p95: 0, p99: 0 }, errorRate: 0, requestsPerMinute: 0 },
        errors: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchMetrics();
        const interval = setInterval(fetchMetrics, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchMetrics = async () => {
        try {
            const res = await api.get('/api/admin/health/metrics');
            setMetrics(res.data);
        } catch (err) {
            console.error('Failed to fetch system health:', err);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (pct) => pct < 60 ? 'var(--state-success)' : pct < 80 ? 'var(--accent)' : 'var(--state-danger)';

    if (loading) return <Spinner />;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
            <div>
                <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.015em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Activity size={20} style={{ color: 'var(--accent)' }} />
                    System Health
                </h1>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Monitor server performance and system metrics</p>
            </div>

            {}
            <div style={{ padding: '16px 20px', background: 'var(--bg-surface)', border: '1px solid var(--state-success)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <CheckCircle size={16} style={{ color: 'var(--state-success)', flexShrink: 0 }} />
                <div>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>All Systems Operational</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Last checked: {new Date().toLocaleTimeString()}</div>
                </div>
            </div>

            {}
            <div>
                <SectionHeader label="Server Metrics" />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border-subtle)' }}>
                    <GaugeCard icon={Cpu} label="CPU Usage" value={metrics.server.cpuUsage} max={100} unit="%" getStatusColor={getStatusColor} />
                    <GaugeCard icon={HardDrive} label="Memory Usage" value={metrics.server.memoryUsage} max={100} unit="%" getStatusColor={getStatusColor} />
                    <GaugeCard icon={Database} label="Disk Usage" value={metrics.server.diskUsage} max={100} unit="%" getStatusColor={getStatusColor} />
                </div>
            </div>

            {}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border-subtle)' }}>
                {}
                <div style={{ background: 'var(--bg-surface)', padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <Database size={14} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Database Statistics</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border-subtle)' }}>
                        <MetricCell icon={Zap} label="Active Connections" value={metrics.database.connections} />
                        <MetricCell icon={Database} label="Database Size" value={`${metrics.database.size} MB`} />
                        <MetricCell icon={HardDrive} label="Collections" value={metrics.database.collections} />
                        <MetricCell icon={Clock} label="Avg Query Time" value={`${metrics.database.queryPerformance}ms`} />
                    </div>
                </div>

                {}
                <div style={{ background: 'var(--bg-surface)', padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <Zap size={14} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>API Performance</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <ProgressBar label="Response Time (p50)" value={metrics.api.responseTime.p50} max={200} color="var(--state-success)" unit="ms" />
                        <ProgressBar label="Response Time (p95)" value={metrics.api.responseTime.p95} max={500} color="var(--accent)" unit="ms" />
                        <ProgressBar label="Response Time (p99)" value={metrics.api.responseTime.p99} max={1000} color="var(--state-danger)" unit="ms" />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                            <StatCell label="Error Rate" value={`${metrics.api.errorRate}%`} />
                            <StatCell label="Requests/Min" value={metrics.api.requestsPerMinute} />
                        </div>
                    </div>
                </div>
            </div>

            {}
            <div style={{ border: '1px solid var(--border-subtle)' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Database size={14} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Database Entities</span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Real-time entity counts</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--border-subtle)', padding: '1px' }}>
                    {[
                        { key: 'Users', val: metrics.entities?.users?.total || 0, sub: `${metrics.entities?.users?.active || 0} active` },
                        { key: 'Companies', val: metrics.entities?.companies?.total || 0, sub: `${metrics.entities?.companies?.verified || 0} verified` },
                        { key: 'Departments', val: metrics.entities?.departments || 0 },
                        { key: 'Workspaces', val: metrics.entities?.workspaces || 0 },
                        { key: 'Channels', val: metrics.entities?.channels || 0 },
                        { key: 'Messages', val: metrics.entities?.messages || 0 },
                        { key: 'Tasks', val: metrics.entities?.tasks || 0 },
                        { key: 'Notes', val: metrics.entities?.notes || 0 },
                    ].map(e => (
                        <div key={e.key} style={{ background: 'var(--bg-surface)', padding: '16px' }}>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px' }}>{e.key}</div>
                            <div style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.015em' }}>{e.val}</div>
                            {e.sub && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{e.sub}</div>}
                        </div>
                    ))}
                </div>
            </div>

            {}
            {metrics.errors.length > 0 && (
                <div style={{ border: '1px solid var(--state-danger)' }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertTriangle size={14} style={{ color: 'var(--state-danger)' }} />
                        <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--state-danger)' }}>Recent Errors</span>
                    </div>
                    <div style={{ maxHeight: '220px', overflowY: 'auto' }} className="custom-scrollbar">
                        {metrics.errors.map((error, i) => (
                            <div key={i} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--state-danger)' }}>{error.message}</span>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0, marginLeft: '8px' }}>{new Date(error.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{error.stack}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const GaugeCard = ({ icon: Icon, label, value, max, unit, getStatusColor }) => {
    const pct = Math.round((value / max) * 100);
    const color = getStatusColor(pct);
    const r = 56, circ = 2 * Math.PI * r;
    return (
        <div style={{ background: 'var(--bg-surface)', padding: '20px', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Icon size={14} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{label}</span>
                </div>
                {pct < 80 ? <CheckCircle size={14} style={{ color: 'var(--state-success)' }} /> : <AlertTriangle size={14} style={{ color: 'var(--state-danger)' }} />}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                <div style={{ position: 'relative', width: '100px', height: '100px' }}>
                    <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                        <circle cx={50} cy={50} r={r * 100 / 128} stroke="var(--border-accent)" strokeWidth={7} fill="none" />
                        <circle cx={50} cy={50} r={r * 100 / 128} stroke={color} strokeWidth={7} fill="none"
                            strokeDasharray={circ * 100 / 128}
                            strokeDashoffset={(circ * 100 / 128) * (1 - pct / 100)}
                            strokeLinecap="round"
                        />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '20px', fontWeight: 600, color, letterSpacing: '-0.015em' }}>{pct}%</span>
                    </div>
                </div>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{value?.toFixed?.(2) || value} {unit} / {max} {unit}</p>
        </div>
    );
};

const MetricCell = ({ icon: Icon, label, value }) => (
    <div style={{ background: 'var(--bg-active)', padding: '12px 14px' }}>
        <Icon size={12} style={{ color: 'var(--text-muted)', marginBottom: '4px' }} />
        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '2px' }}>{label}</div>
        <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{value}</div>
    </div>
);

const ProgressBar = ({ label, value, max, color, unit }) => (
    <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{label}</span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{value}{unit}</span>
        </div>
        <div style={{ width: '100%', height: '2px', background: 'var(--border-accent)' }}>
            <div style={{ width: `${Math.min((value / max) * 100, 100)}%`, height: '100%', background: color, transition: 'width 400ms ease' }} />
        </div>
    </div>
);

const StatCell = ({ label, value }) => (
    <div>
        <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '2px' }}>{label}</p>
        <p style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.015em' }}>{value}</p>
    </div>
);

const SectionHeader = ({ label }) => (
    <h2 style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>{label}</h2>
);

const Spinner = () => (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-base)' }}>
        {[1,2,3,4,5,6].map(i => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                <div className="sk" style={{ width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0 }} />
                <div style={{ flex: 1 }}><div className="sk" style={{ height: '11px', width: '140px', marginBottom: '5px' }} /><div className="sk" style={{ height: '3px', width: `${50 + i * 8}%` }} /></div>
                <div className="sk" style={{ height: '9px', width: '60px', flexShrink: 0 }} />
                <div className="sk" style={{ height: '18px', width: '55px', flexShrink: 0 }} />
            </div>
        ))}
    </div>
);

export default SystemHealth;
