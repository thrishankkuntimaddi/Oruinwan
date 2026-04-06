import React, { useState, useEffect } from 'react';
import api from '@services/api';
import { useNavigate } from 'react-router-dom';
import {
    Building2, Users, Ticket, DollarSign, TrendingUp, TrendingDown,
    Activity, CheckCircle, AlertCircle, Megaphone, ArrowRight
} from 'lucide-react';

/* ─── Shared tokens ─── */
const T = {
    label: { fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.13em', textTransform: 'uppercase', margin: '0 0 4px' },
    subtext: { fontSize: '13px', color: 'var(--text-secondary)', margin: 0 },
    title: { fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.015em', margin: 0 },
};

const Overview = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({ totalCompanies: 0, activeUsers: 0, openTickets: 0, monthlyRevenue: 0, pendingRequests: 0, growthRate: 0 });
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchOverviewData(); }, []);

    const fetchOverviewData = async () => {
        try {
            const [statsRes, activitiesRes] = await Promise.all([
                api.get('/api/admin/overview/stats'),
                api.get('/api/admin/overview/activities')
            ]);
            setStats(statsRes.data);
            setActivities(activitiesRes.data);
        } catch (err) {
            console.error('Failed to fetch overview data:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <LoadingSpinner />;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
            {/* Header */}
            <div>
                <h1 style={{ fontSize: '26px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '4px' }}>
                    Platform Overview
                </h1>
                <p style={T.subtext}>Monitor your platform's health and activity</p>
            </div>

            {/* Status Banner */}
            <div style={{
                padding: '20px 24px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--state-success)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <CheckCircle size={18} style={{ color: 'var(--state-success)', flexShrink: 0 }} />
                    <div>
                        <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>All Systems Operational</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            All services running smoothly · Last checked: {new Date().toLocaleTimeString()}
                        </div>
                    </div>
                </div>
                <ViewDetailsBtn onClick={() => navigate('/chttrix-admin/health')} />
            </div>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--border-subtle)' }}>
                <StatCard icon={Building2} label="Total Companies" value={stats.totalCompanies} change={stats.companiesGrowth} trend={stats.companiesGrowth >= 0 ? 'up' : 'down'} onClick={() => navigate('/chttrix-admin/companies')} />
                <StatCard icon={Users} label="Active Users" value={stats.activeUsers} change={stats.usersGrowth} trend={stats.usersGrowth >= 0 ? 'up' : 'down'} />
                <StatCard icon={Ticket} label="Open Tickets" value={stats.openTickets} onClick={() => navigate('/chttrix-admin/tickets')} />
                <StatCard icon={DollarSign} label="Monthly Revenue" value={`$${(stats.monthlyRevenue || 0).toLocaleString()}`} change={stats.revenueGrowth} trend={stats.revenueGrowth >= 0 ? 'up' : 'down'} onClick={() => navigate('/chttrix-admin/billing')} />
            </div>

            {/* Pending Requests Alert */}
            {stats.pendingRequests > 0 && (
                <div style={{
                    padding: '20px 24px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <AlertCircle size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                        <div>
                            <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                                {stats.pendingRequests} Pending Company Registration{stats.pendingRequests > 1 ? 's' : ''}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Companies waiting for verification</div>
                        </div>
                    </div>
                    <ReviewBtn onClick={() => navigate('/chttrix-admin/pending')} />
                </div>
            )}

            {/* Recent Activity */}
            <div style={{ border: '1px solid var(--border-subtle)' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Activity size={16} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Recent Activity</span>
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--state-success)', textTransform: 'uppercase', padding: '2px 6px', border: '1px solid var(--state-success)' }}>Live</span>
                </div>
                <div style={{ maxHeight: '320px', overflowY: 'auto' }} className="custom-scrollbar">
                    {activities.length > 0 ? activities.map((activity, index) => (
                        <ActivityItem key={index} activity={activity} />
                    )) : (
                        <div style={{ padding: '32px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>No recent activity</div>
                    )}
                </div>
            </div>

            {/* Quick Actions */}
            <div>
                <h2 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '12px' }}>Quick Actions</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--border-subtle)' }}>
                    <QuickAction icon={CheckCircle} title="Review Requests" desc="Manage company verifications" onClick={() => navigate('/chttrix-admin/pending')} />
                    <QuickAction icon={Megaphone} title="Send Broadcast" desc="Notify all companies" onClick={() => navigate('/chttrix-admin/broadcast')} />
                    <QuickAction icon={Ticket} title="View Tickets" desc="Resolve support issues" onClick={() => navigate('/chttrix-admin/tickets')} />
                    <QuickAction icon={Activity} title="System Health" desc="Monitor platform status" onClick={() => navigate('/chttrix-admin/health')} />
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ icon: Icon, label, value, change, trend, onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <div
            onClick={onClick}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                background: hov && onClick ? 'var(--bg-hover)' : 'var(--bg-surface)',
                padding: '20px',
                cursor: onClick ? 'pointer' : 'default',
                transition: 'background 150ms ease'
            }}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                <Icon size={16} style={{ color: 'var(--text-muted)' }} />
                {change !== undefined && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: trend === 'up' ? 'var(--state-success)' : 'var(--state-danger)' }}>
                        {trend === 'up' ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        {Math.abs(change)}%
                    </div>
                )}
            </div>
            <div style={{ fontSize: '26px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{value}</div>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '4px' }}>{label}</div>
        </div>
    );
};

const ActivityItem = ({ activity }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <div
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                display: 'flex', alignItems: 'flex-start', gap: '12px',
                padding: '12px 20px',
                borderBottom: '1px solid var(--border-subtle)',
                background: hov ? 'var(--bg-hover)' : 'transparent',
                transition: 'background 150ms ease'
            }}
        >
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--border-accent)', flexShrink: 0, marginTop: '6px' }} />
            <div style={{ flex: 1 }}>
                <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>{activity.description}</p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{new Date(activity.timestamp).toLocaleString()}</p>
            </div>
        </div>
    );
};

const QuickAction = ({ icon: Icon, title, desc, onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                background: hov ? 'var(--bg-hover)' : 'var(--bg-surface)',
                padding: '20px', border: 'none', cursor: 'pointer', textAlign: 'left',
                transition: 'background 150ms ease', width: '100%'
            }}
        >
            <Icon size={16} style={{ color: hov ? 'var(--accent)' : 'var(--text-muted)', marginBottom: '12px', transition: 'color 150ms ease' }} />
            <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>{title}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{desc}</div>
        </button>
    );
};

const ViewDetailsBtn = ({ onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{ padding: '6px 12px', background: hov ? 'var(--bg-hover)' : 'var(--bg-active)', border: '1px solid var(--border-default)', color: hov ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '12px', fontWeight: 500, borderRadius: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 150ms ease' }}>
            View Details <ArrowRight size={13} />
        </button>
    );
};

const ReviewBtn = ({ onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{ padding: '8px 16px', background: hov ? 'var(--accent-hover)' : 'var(--accent)', border: 'none', color: 'var(--bg-base)', fontSize: '13px', fontWeight: 700, borderRadius: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'background 150ms ease' }}>
            Review Now <ArrowRight size={14} />
        </button>
    );
};

const LoadingSpinner = () => (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-base)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--border-subtle)' }}>
            {[1,2,3,4].map(i => (
                <div key={i} style={{ background: 'var(--bg-surface)', padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px' }}><div className="sk" style={{ width: '12px', height: '12px' }} /><div className="sk" style={{ height: '8px', width: '70px' }} /></div>
                    <div className="sk" style={{ height: '28px', width: '50px', marginBottom: '5px' }} />
                    <div className="sk" style={{ height: '8px', width: '80px' }} />
                </div>
            ))}
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            {[1,2,3,4,5].map(i => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div className="sk" style={{ width: '28px', height: '28px', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}><div className="sk" style={{ height: '10px', width: '140px', marginBottom: '4px' }} /><div className="sk" style={{ height: '8px', width: '100px' }} /></div>
                    <div className="sk" style={{ height: '18px', width: '55px', flexShrink: 0 }} />
                </div>
            ))}
        </div>
    </div>
);

export default Overview;
