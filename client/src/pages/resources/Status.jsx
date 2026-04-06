// Status.jsx — Monolith Flow Design System
import React, { useState, useEffect } from 'react';
import PublicPageShell from '../../components/layout/PublicPageShell';
import { CheckCircle2, AlertTriangle, XCircle, Activity, Clock, RefreshCw } from 'lucide-react';

const SERVICES = [
    { name: 'Web Application',            status: 'operational',  uptime: '99.98%', latency: '142ms' },
    { name: 'Real-time Messaging (WS)',   status: 'operational',  uptime: '99.97%', latency: '38ms' },
    { name: 'File Storage & Uploads',     status: 'operational',  uptime: '99.99%', latency: '210ms' },
    { name: 'Chttrix AI (Intelligence)',  status: 'operational',  uptime: '99.92%', latency: '680ms' },
    { name: 'Video Huddles',              status: 'operational',  uptime: '99.91%', latency: '55ms' },
    { name: 'Authentication & Sessions',  status: 'operational',  uptime: '100%',   latency: '95ms' },
    { name: 'Notifications (Email/Push)', status: 'operational',  uptime: '99.95%', latency: '320ms' },
    { name: 'Search & Indexing',          status: 'operational',  uptime: '99.89%', latency: '180ms' },
    { name: 'Admin Dashboard API',        status: 'operational',  uptime: '99.96%', latency: '115ms' },
    { name: 'Third-party Integrations',   status: 'operational',  uptime: '99.80%', latency: '490ms' },
];

const INCIDENTS = [
    { date: 'Apr 3, 2026', title: 'Elevated latency — AI (resolved)', status: 'resolved', duration: '14 min', desc: 'Chttrix AI responses experienced elevated latency due to a traffic spike. Auto-scaling resolved the issue.' },
    { date: 'Mar 28, 2026', title: 'Delayed email notifications (resolved)', status: 'resolved', duration: '38 min', desc: 'A provider-side queue backlog caused email notifications to be delayed by up to 40 minutes.' },
    { date: 'Mar 15, 2026', title: 'Scheduled maintenance — Database', status: 'maintenance', duration: '2 hr', desc: 'Planned zero-downtime database migration completed successfully.' },
];

const StatusDot = ({ s }) => {
    const map = { operational: '#5aba8a', degraded: '#c9a87c', outage: '#e05252', maintenance: '#6ea8fe' };
    return <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: map[s] || '#5aba8a', flexShrink: 0, display: 'inline-block' }} />;
};

const IncidentIcon = ({ s }) => {
    if (s === 'resolved') return <CheckCircle2 size={14} style={{ color: '#5aba8a' }} />;
    if (s === 'maintenance') return <Clock size={14} style={{ color: '#6ea8fe' }} />;
    return <AlertTriangle size={14} style={{ color: '#c9a87c' }} />;
};

export default function Status() {
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [spinning, setSpinning] = useState(false);

    const refresh = () => {
        setSpinning(true);
        setTimeout(() => { setLastUpdated(new Date()); setSpinning(false); }, 800);
    };

    return (
        <PublicPageShell title="Status">
            {/* Hero */}
            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '72px 0 56px' }}>
                <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '0 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
                        <div>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: 'rgba(90,186,138,0.08)', border: '1px solid rgba(90,186,138,0.25)', marginBottom: '20px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#5aba8a', animation: 'pulse 2s ease-in-out infinite' }} />
                                <span style={{ fontSize: '12px', fontWeight: 700, color: '#5aba8a', letterSpacing: '0.03em' }}>All Systems Operational</span>
                            </div>
                            <h1 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 700, color: '#e4e4e4', letterSpacing: '-0.03em', marginBottom: '10px' }}>System Status</h1>
                            <p style={{ fontSize: '14px', color: 'rgba(228,228,228,0.4)' }}>Real-time status for all Chttrix services</p>
                        </div>
                        <button onClick={refresh}
                            style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(228,228,228,0.5)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 150ms ease' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#e4e4e4'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(228,228,228,0.5)'; }}>
                            <RefreshCw size={12} style={{ animation: spinning ? 'spin 0.8s linear infinite' : 'none' }} />
                            Refresh
                        </button>
                    </div>
                    <style>{`@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.4)} } @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }`}</style>
                </div>
            </div>

            <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '56px 24px' }}>
                {/* Services */}
                <div style={{ marginBottom: '56px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(184,149,106,0.7)' }}>Services</p>
                        <p style={{ fontSize: '11px', color: 'rgba(228,228,228,0.25)', fontFamily: 'monospace' }}>
                            Last updated: {lastUpdated.toLocaleTimeString()}
                        </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'rgba(255,255,255,0.05)' }}>
                        {SERVICES.map(svc => (
                            <div key={svc.name} style={{ background: '#111', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <StatusDot s={svc.status} />
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#e4e4e4' }}>{svc.name}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                                    <div style={{ textAlign: 'right' }}>
                                        <p style={{ fontSize: '10px', color: 'rgba(228,228,228,0.3)', marginBottom: '1px' }}>30d uptime</p>
                                        <p style={{ fontSize: '12px', fontWeight: 700, color: '#5aba8a', fontFamily: 'monospace' }}>{svc.uptime}</p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <p style={{ fontSize: '10px', color: 'rgba(228,228,228,0.3)', marginBottom: '1px' }}>Latency</p>
                                        <p style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(228,228,228,0.5)', fontFamily: 'monospace' }}>{svc.latency}</p>
                                    </div>
                                    <div style={{ padding: '3px 8px', background: 'rgba(90,186,138,0.08)', border: '1px solid rgba(90,186,138,0.2)', fontSize: '10px', fontWeight: 700, color: '#5aba8a', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: '90px', textAlign: 'center' }}>
                                        Operational
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Incident history */}
                <div>
                    <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(184,149,106,0.7)', marginBottom: '20px' }}>Recent Incidents & Maintenance</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'rgba(255,255,255,0.05)' }}>
                        {INCIDENTS.map(inc => (
                            <div key={inc.title} style={{ background: '#111', padding: '20px 24px' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                    <IncidentIcon s={inc.status} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                                            <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#e4e4e4' }}>{inc.title}</h3>
                                            <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'rgba(228,228,228,0.35)' }}>
                                                <span>{inc.date}</span>
                                                <span>Duration: {inc.duration}</span>
                                            </div>
                                        </div>
                                        <p style={{ fontSize: '12px', color: 'rgba(228,228,228,0.45)', lineHeight: '1.7' }}>{inc.desc}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <p style={{ fontSize: '12px', color: 'rgba(228,228,228,0.2)', marginTop: '16px' }}>
                        No incidents currently active. Subscribe to status updates at <span style={{ color: 'rgba(184,149,106,0.6)', fontFamily: 'monospace' }}>status@chttrix.io</span>
                    </p>
                </div>
            </div>
        </PublicPageShell>
    );
}
