import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../contexts/CompanyContext';
import { useToast } from '../../contexts/ToastContext';
import { RefreshCw, Crown, Shield, ArrowRight, BarChart2, CreditCard, Lock } from 'lucide-react';

import OrganizationOverview from './OrganizationOverview';
import ActivityHealth from './ActivityHealth';

import {
    getOwnerOverview,
    getActivityHealth
} from '../../services/ownerDashboardService';

const OwnerDashboard = () => {
    const { isCompanyOwner } = useCompany();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [overviewData, setOverviewData] = useState(null);
    const [activityData, setActivityData] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            const [overview, activity] = await Promise.all([
                getOwnerOverview(),
                getActivityHealth()
            ]);
            setOverviewData(overview);
            setActivityData(activity);
        } catch (error) {
            console.error("Error fetching owner dashboard data:", error);
            showToast("Failed to load dashboard data", "error");
        }
    }, [showToast]);

    useEffect(() => {
        if (!isCompanyOwner()) return;
        const loadInitialData = async () => {
            setLoading(true);
            await fetchData();
            setLoading(false);
        };
        loadInitialData();
    }, [isCompanyOwner, fetchData]);

    const handleRefresh = async () => {
        if (refreshing) return;
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
        showToast("Dashboard refreshed", "success");
    };

    if (!isCompanyOwner()) {
        return (
            <div style={{
                minHeight: '100vh',
                background: 'var(--bg-base)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 16px',
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <Crown size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
                    <h2 style={{
                        fontSize: '22px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        marginBottom: '8px',
                        letterSpacing: '-0.015em'
                    }}>Access Denied</h2>
                    <p style={{
                        fontSize: '14px',
                        color: 'var(--text-secondary)',
                        marginBottom: '24px',
                        lineHeight: '1.6'
                    }}>
                        Only the Company Owner can view this strategic overview.
                    </p>
                    <button
                        onClick={() => navigate('/admin/dashboard')}
                        style={{
                            padding: '8px 20px',
                            background: 'var(--bg-active)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-default)',
                            borderRadius: '2px',
                            fontSize: '14px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'background 150ms ease'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-active)'}
                    >
                        Go to Admin Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            background: 'var(--bg-base)',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
        }}>
            {/* Header */}
            <header style={{
                height: '64px',
                padding: '0 32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-surface)',
                borderBottom: '1px solid var(--border-subtle)',
                flexShrink: 0,
                zIndex: 10
            }}>
                <div>
                    <h2 style={{
                        fontSize: '18px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        letterSpacing: '-0.015em',
                        margin: 0
                    }}>
                        <Crown size={18} style={{ color: 'var(--accent)' }} />
                        Owner Overview
                    </h2>
                    <p style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        marginTop: '2px',
                        marginLeft: '26px'
                    }}>
                        Strategic Health & Growth · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                        onClick={() => navigate('/admin/dashboard')}
                        style={{
                            padding: '7px 14px',
                            background: 'var(--bg-active)',
                            border: '1px solid var(--border-default)',
                            color: 'var(--text-secondary)',
                            fontSize: '13px',
                            fontWeight: 500,
                            borderRadius: '2px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'color 150ms ease, background 150ms ease'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-active)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    >
                        <Shield size={14} />
                        Admin Console
                    </button>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing || loading}
                        style={{
                            padding: '7px 14px',
                            background: 'var(--bg-active)',
                            border: '1px solid var(--border-default)',
                            color: 'var(--text-secondary)',
                            fontSize: '13px',
                            fontWeight: 500,
                            borderRadius: '2px',
                            cursor: refreshing || loading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            opacity: refreshing || loading ? 0.5 : 1,
                            transition: 'color 150ms ease, background 150ms ease'
                        }}
                        onMouseEnter={e => { if (!refreshing && !loading) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-active)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    >
                        <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                        {refreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>
            </header>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }} className="custom-scrollbar">
                {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '1280px', margin: '0 auto' }}>
                        {/* Org Overview skeleton */}
                        <div>
                            <div className="sk" style={{ height: '10px', width: '120px', marginBottom: '12px' }} />
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--border-subtle)', marginBottom: '16px' }}>
                                {[1,2,3,4].map(i => (
                                    <div key={i} style={{ background: 'var(--bg-surface)', padding: '20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}><div className="sk" style={{ width: '14px', height: '14px' }} /><div className="sk" style={{ height: '9px', width: '90px' }} /></div>
                                        <div className="sk" style={{ height: '36px', width: '60px', marginBottom: '6px' }} />
                                        <div className="sk" style={{ height: '9px', width: '110px' }} />
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                {[1,2].map(i => (
                                    <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '20px' }}>
                                        <div className="sk" style={{ height: '11px', width: '150px', marginBottom: '16px' }} />
                                        {[1,2,3,4].map(j => (
                                            <div key={j} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                                                <div className="sk" style={{ height: '10px', width: '120px' }} />
                                                <div className="sk" style={{ height: '10px', width: '40px' }} />
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Activity Health skeleton */}
                        <div>
                            <div className="sk" style={{ height: '10px', width: '110px', marginBottom: '12px' }} />
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '20px' }}>
                                    <div className="sk" style={{ height: '11px', width: '140px', marginBottom: '16px' }} />
                                    <div className="sk" style={{ height: '140px', width: '100%' }} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {[1,2,3].map(i => (
                                        <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '16px', flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}><div className="sk" style={{ width: '12px', height: '12px' }} /><div className="sk" style={{ height: '8px', width: '80px' }} /></div>
                                            <div className="sk" style={{ height: '24px', width: '50px' }} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        {/* Quick Links skeleton */}
                        <div>
                            <div className="sk" style={{ height: '10px', width: '80px', marginBottom: '12px' }} />
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                {[1,2,3].map(i => (
                                    <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><div className="sk" style={{ width: '32px', height: '32px' }} /><div className="sk" style={{ height: '11px', width: '100px' }} /></div>
                                        <div className="sk" style={{ width: '16px', height: '16px' }} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '1280px', margin: '0 auto' }}>
                        <OrganizationOverview data={overviewData} />
                        <ActivityHealth data={activityData} />

                        {/* Quick Links */}
                        <section>
                            <div style={{ marginBottom: '16px' }}>
                                <h3 style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    color: 'var(--text-muted)',
                                    letterSpacing: '0.13em',
                                    textTransform: 'uppercase',
                                    margin: '0 0 4px'
                                }}>Deep Dive</h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                                    Access detailed views and management
                                </p>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border-subtle)' }}>
                                <QuickLinkCard
                                    title="Analytics & Insights"
                                    description="Historical trends, charts & growth metrics"
                                    link="/owner/analytics"
                                    icon={BarChart2}
                                />
                                <QuickLinkCard
                                    title="Billing & Plan"
                                    description="Subscription, invoices & usage details"
                                    link="/owner/billing"
                                    icon={CreditCard}
                                />
                                <QuickLinkCard
                                    title="Security & Risk"
                                    description="Sessions, compliance & audit logs"
                                    link="/owner/security"
                                    icon={Lock}
                                />
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </div>
    );
};

const QuickLinkCard = ({ title, description, link, icon: Icon }) => {
    const navigate = useNavigate();
    const [hovered, setHovered] = React.useState(false);

    return (
        <button
            onClick={() => navigate(link)}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                background: hovered ? 'var(--bg-hover)' : 'var(--bg-surface)',
                padding: '20px 24px',
                border: 'none',
                textAlign: 'left',
                width: '100%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'background 150ms ease',
                outline: 'none'
            }}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <Icon size={16} style={{ color: hovered ? 'var(--accent)' : 'var(--text-muted)', marginTop: '2px', transition: 'color 150ms ease' }} />
                <div>
                    <div style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: hovered ? 'var(--text-primary)' : 'var(--text-secondary)',
                        marginBottom: '4px',
                        transition: 'color 150ms ease'
                    }}>{title}</div>
                    <div style={{
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        lineHeight: '1.6'
                    }}>{description}</div>
                </div>
            </div>
            <ArrowRight size={14} style={{
                color: hovered ? 'var(--accent)' : 'var(--text-muted)',
                transform: hovered ? 'translateX(2px)' : 'translateX(0)',
                transition: 'color 150ms ease, transform 150ms ease',
                flexShrink: 0
            }} />
        </button>
    );
};

export default OwnerDashboard;
