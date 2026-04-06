// client/src/components/manager/ManagerOverview.jsx — Monolith Flow Design System
import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Users, Activity, CheckCircle2, Clock, TrendingUp, MessageSquare, Calendar, LayoutGrid, RefreshCw, Shield, Briefcase } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';

const T = { ff: 'Inter, system-ui, sans-serif' };

export default function ManagerOverview() {
    const { selectedDepartment } = useOutletContext();
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const { showToast } = useToast();
    const navigate = useNavigate();

    const fetchMetrics = useCallback(async () => {
        const deptId = selectedDepartment?._id;
        if (!deptId || !/^[a-f\d]{24}$/i.test(String(deptId))) return;
        try {
            setLoading(true);
            const res = await api.get(`/api/manager/dashboard/metrics/${deptId}`);
            setMetrics(res.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [selectedDepartment]);

    useEffect(() => {
        if (selectedDepartment?._id && /^[a-f\d]{24}$/i.test(String(selectedDepartment._id))) fetchMetrics();
        else setLoading(false);
    }, [selectedDepartment, fetchMetrics]);

    const handleRefresh = async () => {
        if (refreshing) return;
        setRefreshing(true);
        await fetchMetrics();
        setRefreshing(false);
        showToast('Dashboard refreshed', 'success');
    };

    // No dept guard
    if (!selectedDepartment || !selectedDepartment._id || !/^[a-f\d]{24}$/i.test(String(selectedDepartment._id))) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', padding: '48px', textAlign: 'center', fontFamily: T.ff }}>
                <div style={{ width: '52px', height: '52px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Briefcase size={22} style={{ color: 'var(--accent)' }} />
                </div>
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>No Department Assigned</h2>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '340px', lineHeight: '1.6', margin: 0 }}>
                    You haven't been assigned as a department head yet. Ask your company admin to assign you to a department.
                </p>
            </div>
        );
    }

    // Loading state
    if (loading && !metrics) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, sans-serif' }}>
                {/* Header skeleton */}
                <div style={{ height: '56px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <div><div className="sk" style={{ height: '14px', width: '160px', marginBottom: '6px' }} /><div className="sk" style={{ height: '10px', width: '240px' }} /></div>
                    <div className="sk" style={{ width: '32px', height: '32px' }} />
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
                    {/* Section label */}
                    <div style={{ marginBottom: '10px' }}><div className="sk" style={{ height: '10px', width: '100px', marginBottom: '4px' }} /><div className="sk" style={{ height: '9px', width: '200px' }} /></div>
                    {/* 4 metric tiles */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--border-subtle)', marginBottom: '24px' }}>
                        {[1,2,3,4].map(i => (
                            <div key={i} style={{ background: 'var(--bg-surface)', padding: '18px 20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}><div className="sk" style={{ width: '14px', height: '14px' }} /><div className="sk" style={{ height: '9px', width: '80px' }} /></div>
                                <div className="sk" style={{ height: '32px', width: '60px', marginBottom: '6px' }} />
                                <div className="sk" style={{ height: '9px', width: '100px' }} />
                            </div>
                        ))}
                    </div>
                    {/* Section 2 label */}
                    <div style={{ marginBottom: '10px' }}><div className="sk" style={{ height: '10px', width: '140px', marginBottom: '4px' }} /><div className="sk" style={{ height: '9px', width: '220px' }} /></div>
                    {/* 3 activity tiles */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border-subtle)', marginBottom: '24px' }}>
                        {[1,2,3].map(i => (
                            <div key={i} style={{ background: 'var(--bg-surface)', padding: '18px 20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}><div className="sk" style={{ width: '14px', height: '14px' }} /><div className="sk" style={{ height: '9px', width: '80px' }} /></div>
                                <div className="sk" style={{ height: '32px', width: '50px', marginBottom: '6px' }} />
                                <div className="sk" style={{ height: '9px', width: '90px' }} />
                            </div>
                        ))}
                    </div>
                    {/* 2 bottom cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        {[1,2].map(i => (
                            <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
                                    <div className="sk" style={{ width: '28px', height: '28px' }} />
                                    <div><div className="sk" style={{ height: '10px', width: '120px', marginBottom: '4px' }} /><div className="sk" style={{ height: '8px', width: '80px' }} /></div>
                                </div>
                                {[80, 60, 100].map((w, j) => <div key={j} className="sk" style={{ height: '10px', width: `${w}%`, marginBottom: '10px' }} />)}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const dm = metrics || {
        team: { total: 0, active: 0, pending: 0, managers: 0 },
        activity: { messagesThisWeek: 0, tasksThisWeek: 0, meetingsThisWeek: 0 },
        department: { name: selectedDepartment?.name || '—', description: '', head: null }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', fontFamily: T.ff }}>
            {/* Header */}
            <header style={{ height: '56px', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <LayoutGrid size={16} style={{ color: 'var(--accent)' }} /> Manager Overview
                    </h2>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px', marginLeft: '24px' }}>Team Performance & Workspace Health · {dm.department?.name}</p>
                </div>
                <RefreshBtn onClick={handleRefresh} loading={refreshing || loading} />
            </header>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }} className="custom-scrollbar">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1280px', margin: '0 auto' }}>

                    {/* Team Snapshot */}
                    <Section label="Team Snapshot" sub="Member distribution & operational status">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1px', background: 'var(--border-subtle)' }}>
                            {[
                                { Icon: Users,        color: '#5ab8ba', label: 'Total Members',  value: dm.team?.total || 0,    sub: 'In department' },
                                { Icon: CheckCircle2, color: 'var(--state-success)', label: 'Active Members',  value: dm.team?.active || 0,   sub: 'Currently active' },
                                { Icon: Clock,        color: 'var(--accent)',        label: 'Pending Invites', value: dm.team?.pending || 0,  sub: 'Awaiting acceptance' },
                                { Icon: Shield,       color: '#9b8ecf',              label: 'Managers',        value: dm.team?.managers || 0, sub: 'Department leads' },
                            ].map(m => <MetricTile key={m.label} {...m} />)}
                        </div>
                    </Section>

                    {/* Department Activity */}
                    <Section label="Department Activity" sub="Weekly productivity & engagement metrics">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1px', background: 'var(--border-subtle)' }}>
                            {[
                                { Icon: MessageSquare, color: 'var(--accent)',         label: 'Messages Sent',   value: dm.activity?.messagesThisWeek || 0, sub: 'This week' },
                                { Icon: Activity,      color: 'var(--state-success)',  label: 'Tasks Completed', value: dm.activity?.tasksThisWeek || 0,    sub: 'Productivity on track' },
                                { Icon: Calendar,      color: 'var(--state-danger)',   label: 'Meetings',        value: dm.activity?.meetingsThisWeek || 0, sub: 'Scheduled this week' },
                            ].map(m => <MetricTile key={m.label} {...m} />)}
                        </div>
                    </Section>

                    {/* Details + Quick Actions */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        {/* Department Details */}
                        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '20px' }}>
                            <SectionHeader icon={Briefcase} label="Department Details" sub="Core information" />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                                <div>
                                    <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: '4px' }}>Department Name</p>
                                    <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{dm.department?.name}</p>
                                </div>
                                {dm.department?.description && (
                                    <div style={{ background: 'var(--bg-active)', border: '1px solid var(--border-subtle)', padding: '10px 12px' }}>
                                        <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: '4px' }}>Description</p>
                                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{dm.department.description}</p>
                                    </div>
                                )}
                                {dm.department?.head && (
                                    <div>
                                        <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: '8px' }}>Department Head</p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--bg-active)', border: '1px solid var(--border-subtle)' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(184,149,106,0.1)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>
                                                {dm.department.head.username?.charAt(0)?.toUpperCase()}
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{dm.department.head.username}</p>
                                                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{dm.department.head.email}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '20px' }}>
                            <SectionHeader icon={Activity} label="Quick Actions" sub="Frequent management tasks" />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '16px' }}>
                                {[
                                    { label: 'View Team', sub: 'Manage workload', icon: Users, path: '/manager/dashboard/allocation', color: 'var(--accent)' },
                                    { label: 'Projects', sub: 'Track progress', icon: CheckCircle2, path: '/manager/dashboard/projects', color: 'var(--state-success)' },
                                    { label: 'Reports', sub: 'View insights', icon: TrendingUp, path: '/manager/dashboard/reports', color: '#9b8ecf' },
                                    { label: 'Tasks', sub: 'TaskMaster', icon: Activity, path: '/manager/dashboard/tasks', color: '#5ab8ba' },
                                ].map(a => <QuickAction key={a.label} {...a} onClick={() => navigate(a.path)} />)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────
const MetricTile = ({ Icon, color, label, value, sub }) => (
    <div style={{ background: 'var(--bg-surface)', padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Icon size={14} style={{ color }} />
            <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>{label}</p>
        </div>
        <p style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '4px' }}>{value}</p>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sub}</p>
    </div>
);

const Section = ({ label, sub, children }) => (
    <div>
        <div style={{ marginBottom: '10px' }}>
            <h3 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', margin: 0 }}>{label}</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{sub}</p>
        </div>
        {children}
    </div>
);

const SectionHeader = ({ icon: Icon, label, sub }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ width: '28px', height: '28px', background: 'var(--bg-active)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={13} style={{ color: 'var(--text-muted)' }} />
        </div>
        <div>
            <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{sub}</p>
        </div>
    </div>
);

const QuickAction = ({ label, sub, icon: Icon, color, onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ padding: '12px', background: hov ? 'var(--bg-hover)' : 'var(--bg-active)', border: `1px solid ${hov ? color : 'var(--border-subtle)'}`, cursor: 'pointer', textAlign: 'left', transition: 'all 150ms ease', borderRadius: '0' }}>
            <Icon size={14} style={{ color, marginBottom: '6px' }} />
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>{label}</p>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{sub}</p>
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
