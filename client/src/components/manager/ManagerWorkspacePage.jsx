// client/src/components/manager/ManagerWorkspacePage.jsx — Monolith Flow Design System
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Users, CheckCircle2, MessageSquare, Globe, RefreshCw, AlertCircle, ArrowRight } from 'lucide-react';
import api from '@services/api';

export default function ManagerWorkspacePage() {
    const navigate = useNavigate();
    const [workspaces, setWorkspaces] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchWorkspaces = async () => {
        try {
            setError(null);
            const res = await api.get('/api/manager-dashboard/my-workspaces');
            setWorkspaces(res.data?.workspaces || []);
        } catch (err) {
            setError('Failed to load workspaces. Please try again.');
        } finally { setLoading(false); }
    };

    useEffect(() => { fetchWorkspaces(); }, []);

    const COLORS = ['#b8956a', '#5aba8a', '#9b8ecf', '#e05252', '#5ab8ba'];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {/* Header */}
            <header style={{ height: '56px', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <Globe size={16} style={{ color: 'var(--accent)' }} /> My Workspaces
                    </h2>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px', marginLeft: '24px' }}>All workspaces you're a member of</p>
                </div>
                <RefreshBtn onClick={() => { setLoading(true); fetchWorkspaces(); }} loading={loading} />
            </header>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }} className="custom-scrollbar">
                <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>

                    {loading && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {[1,2,3].map(i => (
                                <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderLeft: '2px solid var(--border-accent)' }}>
                                    <div style={{ padding: '16px 20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '14px' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                                    <div className="sk" style={{ height: '14px', width: '160px' }} />
                                                    <div className="sk" style={{ height: '14px', width: '52px' }} />
                                                </div>
                                                <div className="sk" style={{ height: '10px', width: '220px' }} />
                                            </div>
                                            <div className="sk" style={{ width: '72px', height: '30px', flexShrink: 0 }} />
                                        </div>
                                        <div style={{ display: 'flex', gap: '20px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                                            {[1,2,3].map(j => (
                                                <div key={j} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <div className="sk" style={{ width: '11px', height: '11px' }} />
                                                    <div className="sk" style={{ height: '10px', width: '50px' }} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {!loading && error && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '64px', textAlign: 'center' }}>
                            <AlertCircle size={24} style={{ color: 'var(--state-danger)' }} />
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{error}</p>
                            <button onClick={() => { setLoading(true); fetchWorkspaces(); }}
                                style={{ padding: '7px 16px', background: 'var(--accent)', border: 'none', color: 'var(--bg-base)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                                Try Again
                            </button>
                        </div>
                    )}

                    {!loading && !error && workspaces.length === 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '64px', textAlign: 'center', background: 'var(--bg-surface)', border: '1px dashed var(--border-accent)' }}>
                            <Briefcase size={28} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>No Workspaces Found</h3>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Ask your admin to add you to a workspace.</p>
                            <button onClick={() => navigate('/workspaces')}
                                style={{ padding: '7px 16px', background: 'var(--accent)', border: 'none', color: 'var(--bg-base)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Globe size={12} /> Browse Workspaces
                            </button>
                        </div>
                    )}

                    {!loading && !error && workspaces.map((ws, idx) => {
                        const accentColor = COLORS[idx % COLORS.length];
                        const isActive = ws.status === 'active';
                        return <WsCard key={ws._id} ws={ws} accentColor={accentColor} isActive={isActive} onOpen={() => navigate(`/workspace/${ws._id}/home`)} />;
                    })}
                </div>
            </div>
        </div>
    );
}

const WsCard = ({ ws, accentColor, isActive, onOpen }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ background: hov ? 'var(--bg-hover)' : 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderLeft: `2px solid ${accentColor}`, transition: 'background 150ms ease' }}>
            <div style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{ws.name}</h3>
                            <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 7px', border: `1px solid ${isActive ? 'var(--state-success)' : 'var(--border-accent)'}`, color: isActive ? 'var(--state-success)' : 'var(--text-muted)', flexShrink: 0 }}>{ws.status}</span>
                        </div>
                        {ws.description && <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.description}</p>}
                    </div>
                    <OpenBtn onClick={onOpen} color={accentColor} />
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: '20px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                    {[
                        { Icon: Users,        val: ws.memberCount ?? 0, label: 'Members',      color: accentColor },
                        { Icon: CheckCircle2, val: ws.activity?.tasksActive ?? 0, label: 'Active Tasks', color: 'var(--state-success)' },
                        { Icon: MessageSquare, val: ws.activity?.messages ?? 0, label: 'Msgs/wk',     color: 'var(--text-secondary)' },
                    ].map(s => (
                        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <s.Icon size={11} style={{ color: s.color }} />
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>{s.val}</span>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const OpenBtn = ({ onClick, color }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', background: hov ? color : 'var(--bg-active)', border: `1px solid ${color}`, color: hov ? 'var(--bg-base)' : color, fontSize: '12px', fontWeight: 700, cursor: 'pointer', flexShrink: 0, transition: 'all 150ms ease' }}>
            Open <ArrowRight size={12} />
        </button>
    );
};

const RefreshBtn = ({ onClick, loading: spin }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} disabled={spin} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: hov ? 'var(--bg-hover)' : 'var(--bg-active)', border: '1px solid var(--border-default)', color: 'var(--text-muted)', cursor: spin ? 'not-allowed' : 'pointer', borderRadius: '2px', transition: 'all 150ms ease' }}>
            <RefreshCw size={13} style={{ animation: spin ? 'spin 1s linear infinite' : 'none' }} />
        </button>
    );
};
