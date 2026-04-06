// ManagerProjects — Monolith Flow Design System
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@services/api';
import { FolderKanban, ExternalLink, Users, Activity, CheckCircle2, Clock } from 'lucide-react';

export default function ManagerProjects() {
    const navigate = useNavigate();
    const [workspaces, setWorkspaces] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/api/manager-dashboard/my-workspaces')
            .then(r => setWorkspaces(r.data?.workspaces || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const COLORS = ['#b8956a', '#5aba8a', '#9b8ecf', '#5ab8ba', '#e05252'];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {/* Header */}
            <header style={{ height: '56px', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <FolderKanban size={16} style={{ color: 'var(--accent)' }} /> Projects & Workspaces
                    </h2>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px', marginLeft: '24px' }}>All workspaces and projects you are part of</p>
                </div>
                <OpenBtn onClick={() => navigate('/workspaces')} label="Open Workspaces" />
            </header>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }} className="custom-scrollbar">
                {loading && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px' }}>
                        {[1,2,3].map(i => (
                            <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderTop: '2px solid var(--border-accent)' }}>
                                <div style={{ padding: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
                                        <div className="sk" style={{ width: '32px', height: '32px' }} />
                                        <div className="sk" style={{ height: '16px', width: '52px' }} />
                                    </div>
                                    <div className="sk" style={{ height: '13px', width: '160px', marginBottom: '12px' }} />
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', marginBottom: '12px' }}>
                                        {[1,2,3].map(j => (
                                            <div key={j} style={{ textAlign: 'center' }}>
                                                <div className="sk" style={{ width: '11px', height: '11px', margin: '0 auto 4px' }} />
                                                <div className="sk" style={{ height: '14px', width: '30px', margin: '0 auto 4px' }} />
                                                <div className="sk" style={{ height: '9px', width: '40px', margin: '0 auto' }} />
                                            </div>
                                        ))}
                                    </div>
                                    <div className="sk" style={{ height: '3px', width: '100%', marginBottom: '12px' }} />
                                    <div className="sk" style={{ height: '30px', width: '100%' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {!loading && workspaces.length === 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '64px', textAlign: 'center', background: 'var(--bg-surface)', border: '1px dashed var(--border-accent)' }}>
                        <FolderKanban size={32} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                        <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>No Projects Yet</h3>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>You aren't part of any workspaces yet. Ask your admin to add you.</p>
                        <button onClick={() => navigate('/workspaces')} style={{ padding: '7px 16px', background: 'var(--accent)', border: 'none', color: 'var(--bg-base)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Go to Workspaces</button>
                    </div>
                )}

                {!loading && workspaces.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px' }}>
                        {workspaces.map((ws, idx) => {
                            const color = COLORS[idx % COLORS.length];
                            const completionRate = ws.activity?.tasksTotal > 0
                                ? Math.round((ws.activity.tasksCompleted / ws.activity.tasksTotal) * 100) : 0;
                            const isActive = ws.status === 'active';
                            return <ProjectCard key={ws._id} ws={ws} color={color} completionRate={completionRate} isActive={isActive} onOpen={() => navigate(`/workspace/${ws._id}/home`)} />;
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

const ProjectCard = ({ ws, color, completionRate, isActive, onOpen }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} onClick={onOpen}
            style={{ background: hov ? 'var(--bg-hover)' : 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderTop: `2px solid ${color}`, cursor: 'pointer', transition: 'background 150ms ease' }}>
            <div style={{ padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ width: '32px', height: '32px', background: 'var(--bg-active)', border: `1px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FolderKanban size={15} style={{ color }} />
                    </div>
                    <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 7px', border: `1px solid ${isActive ? 'var(--state-success)' : 'var(--border-accent)'}`, color: isActive ? 'var(--state-success)' : 'var(--text-muted)' }}>{ws.status}</span>
                </div>
                <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px', lineHeight: '1.3' }}>{ws.name}</h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                    {[
                        { Icon: Users, val: ws.memberCount || 0, label: 'Members' },
                        { Icon: Activity, val: ws.activity?.messages || 0, label: 'Messages' },
                        { Icon: CheckCircle2, val: ws.activity?.tasksActive || 0, label: 'Tasks' },
                    ].map(s => (
                        <div key={s.label} style={{ textAlign: 'center' }}>
                            <s.Icon size={11} style={{ color: 'var(--text-muted)', marginBottom: '2px', display: 'block', margin: '0 auto 2px' }} />
                            <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 1px' }}>{s.val}</p>
                            <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', margin: 0 }}>{s.label}</p>
                        </div>
                    ))}
                </div>

                {ws.activity?.tasksTotal > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}><Clock size={9} /> Task Completion</span>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)' }}>{completionRate}%</span>
                        </div>
                        <div style={{ height: '3px', background: 'var(--bg-active)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${completionRate}%`, background: color }} />
                        </div>
                    </div>
                )}

                <OpenBtn onClick={e => { e.stopPropagation(); onOpen(); }} label="Open Workspace" full />
            </div>
        </div>
    );
};

const OpenBtn = ({ onClick, label, full }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ width: full ? '100%' : 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '7px 14px', background: hov ? 'var(--accent)' : 'var(--bg-active)', border: '1px solid var(--border-default)', color: hov ? 'var(--bg-base)' : 'var(--text-secondary)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'all 150ms ease' }}>
            <ExternalLink size={11} /> {label}
        </button>
    );
};
