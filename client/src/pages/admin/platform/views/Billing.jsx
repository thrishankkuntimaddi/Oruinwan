import React, { useState, useEffect } from 'react';
import api from '@services/api';
import { DollarSign, TrendingUp, CreditCard, Calendar, Download, Search } from 'lucide-react';

const planColor = (plan) => {
    if (plan === 'enterprise') return 'var(--accent)';
    if (plan === 'professional') return 'var(--state-success)';
    if (plan === 'basic') return 'var(--text-secondary)';
    return 'var(--text-muted)';
};

const statusColor = (s) => {
    if (s === 'active') return 'var(--state-success)';
    if (s === 'pending') return 'var(--accent)';
    if (s === 'overdue') return 'var(--state-danger)';
    return 'var(--text-muted)';
};

const Billing = () => {
    const [stats, setStats] = useState({ totalRevenue: 0, monthlyRevenue: 0, avgPerCompany: 0, growthRate: 0, projectedRevenue: 0 });
    const [billingData, setBillingData] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchBillingData(); }, []);

    const fetchBillingData = async () => {
        try {
            const [statsRes, billingRes] = await Promise.all([
                api.get('/api/admin/billing/overview'),
                api.get('/api/admin/billing/companies')
            ]);
            setStats(statsRes.data);
            setBillingData(billingRes.data);
        } catch (err) {
            console.error('Failed to fetch billing data:', err);
        } finally { setLoading(false); }
    };

    const filtered = billingData.filter(item => {
        const matchesSearch = item.companyName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterStatus === 'all' || item.status === filterStatus;
        return matchesSearch && matchesFilter;
    });

    if (loading) return <Spinner />;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
            <div>
                <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.015em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <DollarSign size={18} style={{ color: 'var(--accent)' }} />
                    Revenue & Billing
                </h1>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Track revenue, billing, and financial analytics</p>
            </div>

            {}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--border-subtle)' }}>
                <StatCell icon={DollarSign} label="Total Revenue" value={`$${stats.totalRevenue.toLocaleString()}`} sub="All time" />
                <StatCell icon={Calendar} label="Monthly Revenue" value={`$${stats.monthlyRevenue.toLocaleString()}`} sub="Current month" trend={stats.growthRate} />
                <StatCell icon={TrendingUp} label="Avg Per Company" value={`$${stats.avgPerCompany.toLocaleString()}`} sub="Monthly average" />
                <StatCell icon={CreditCard} label="Projected" value={`$${stats.projectedRevenue.toLocaleString()}`} sub="Next month" />
            </div>

            {billingData.length === 0 && (
                <div style={{ padding: '20px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>📊 Billing System Ready</p>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No active billing records yet. Companies are currently on free tier.</p>
                </div>
            )}

            {}
            <div style={{ border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                {}
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Search companies..." />
                    <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                        {['all', 'active', 'pending', 'overdue'].map(s => (
                            <FilterBtn key={s} label={s.charAt(0).toUpperCase() + s.slice(1)} active={filterStatus === s} onClick={() => setFilterStatus(s)} />
                        ))}
                    </div>
                    <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'var(--bg-active)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', borderRadius: '2px' }}>
                        <Download size={13} /> Export
                    </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-active)', borderBottom: '1px solid var(--border-subtle)' }}>
                                {['Company', 'Plan', 'Amount', 'Billing Cycle', 'Next Payment', 'Status'].map((col, i) => (
                                    <th key={col} style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'left' }}>{col}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(item => <BillingRow key={item._id} item={item} />)}
                        </tbody>
                    </table>
                    {filtered.length === 0 && (
                        <div style={{ padding: '48px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>No billing records found</div>
                    )}
                </div>
            </div>
        </div>
    );
};

const BillingRow = ({ item }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <tr
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{ background: hov ? 'var(--bg-hover)' : 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', transition: 'background 150ms ease' }}
        >
            <td style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                        {item.companyName.charAt(0)}
                    </div>
                    <div>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{item.companyName}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.companyDomain}</div>
                    </div>
                </div>
            </td>
            <td style={{ padding: '14px 16px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: planColor(item.plan), padding: '2px 6px', border: `1px solid ${planColor(item.plan)}` }}>
                    {item.plan}
                </span>
            </td>
            <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>${item.amount.toLocaleString()}</td>
            <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{item.billingCycle}</td>
            <td style={{ padding: '14px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                {item.nextPaymentDate ? new Date(item.nextPaymentDate).toLocaleDateString() : 'N/A'}
            </td>
            <td style={{ padding: '14px 16px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: statusColor(item.status), padding: '2px 6px', border: `1px solid ${statusColor(item.status)}` }}>
                    {item.status}
                </span>
            </td>
        </tr>
    );
};

const StatCell = ({ icon: Icon, label, value, sub, trend }) => (
    <div style={{ background: 'var(--bg-surface)', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
            <Icon size={14} style={{ color: 'var(--text-muted)' }} />
            {trend !== undefined && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 700, color: trend >= 0 ? 'var(--state-success)' : 'var(--state-danger)' }}>
                    <TrendingUp size={11} />{Math.abs(trend)}%
                </div>
            )}
        </div>
        <div style={{ fontSize: '26px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '4px' }}>{value}</div>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '2px' }}>{label}</div>
        {sub && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
);

const SearchInput = ({ value, onChange, placeholder }) => (
    <div style={{ position: 'relative' }}>
        <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input type="text" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
            style={{ paddingLeft: '30px', paddingRight: '10px', paddingTop: '7px', paddingBottom: '7px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', width: '180px', fontFamily: 'inherit' }} />
    </div>
);

const FilterBtn = ({ label, active, onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ padding: '6px 10px', background: active ? 'var(--bg-active)' : 'transparent', border: active ? '1px solid var(--accent)' : '1px solid var(--border-default)', color: active ? 'var(--accent)' : hov ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '11px', fontWeight: active ? 700 : 400, borderRadius: '2px', cursor: 'pointer', transition: 'all 150ms ease' }}>
            {label}
        </button>
    );
};

const Spinner = () => (
    <div style={{ padding: '20px', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border-subtle)' }}>
            {[1,2,3].map(i => (
                <div key={i} style={{ background: 'var(--bg-surface)', padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px' }}><div className="sk" style={{ width: '12px', height: '12px' }} /><div className="sk" style={{ height: '8px', width: '90px' }} /></div>
                    <div className="sk" style={{ height: '24px', width: '80px', marginBottom: '5px' }} />
                    <div className="sk" style={{ height: '8px', width: '100px' }} />
                </div>
            ))}
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}><div className="sk" style={{ height: '10px', width: '80px' }} /></div>
            {[1,2,3,4].map(i => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 80px', padding: '11px 16px', borderBottom: '1px solid var(--border-subtle)', gap: '16px', alignItems: 'center' }}>
                    <div className="sk" style={{ height: '10px', width: '80%' }} />
                    <div className="sk" style={{ height: '10px', width: '70%' }} />
                    <div className="sk" style={{ height: '18px', width: '55px' }} />
                    <div className="sk" style={{ height: '26px', width: '100%' }} />
                </div>
            ))}
        </div>
    </div>
);

export default Billing;
