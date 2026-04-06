import React, { useState, useEffect, useCallback } from 'react';
import {
    CreditCard, Download, TrendingUp, AlertCircle,
    Users, DollarSign, RefreshCw, CheckCircle, XCircle,
    Clock, ArrowUpRight, ArrowDownRight, FileText
} from 'lucide-react';
import { useCompany } from '../../contexts/CompanyContext';
import { useToast } from '../../contexts/ToastContext';
import { getBillingSummary } from '../../services/ownerDashboardService';
import api from '@services/api';

const OwnerBilling = () => {
    const { isCompanyOwner } = useCompany();
    const { showToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [billingData, setBillingData] = useState(null);
    const [invoices, setInvoices] = useState([]);
    const [paymentMethod, setPaymentMethod] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            const [billing, invoicesRes, paymentRes] = await Promise.all([
                getBillingSummary(),
                api.get('/api/owner-dashboard/invoices?limit=10'),
                api.get('/api/owner-dashboard/payment-methods')
            ]);
            setBillingData(billing);
            setInvoices(invoicesRes.data.invoices || []);
            setPaymentMethod(paymentRes.data.paymentMethod || { type: 'card', last4: '4242', brand: 'visa' });
        } catch {
            showToast('Failed to load billing data', 'error');
            setInvoices([]);
            setPaymentMethod({ type: 'card', last4: '4242', brand: 'visa' });
        }
    }, [showToast]);

    useEffect(() => {
        if (!isCompanyOwner()) return;
        const load = async () => { setLoading(true); await fetchData(); setLoading(false); };
        load();
    }, [isCompanyOwner, fetchData]);

    const handleRefresh = async () => {
        if (refreshing) return;
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
        showToast('Billing data refreshed', 'success');
    };

    const handleUpgradePlan = () => showToast('Upgrade functionality coming soon', 'info');
    const handleDownloadInvoice = (id) => showToast(`Downloading invoice ${id}...`, 'info');

    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <div style={{ height: '56px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div><div className="sk" style={{ height: '13px', width: '130px', marginBottom: '5px' }} /><div className="sk" style={{ height: '9px', width: '240px' }} /></div>
                <div style={{ display: 'flex', gap: '8px' }}><div className="sk" style={{ height: '30px', width: '100px' }} /><div className="sk" style={{ height: '30px', width: '80px' }} /></div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
                {/* 3 billing stat tiles */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border-subtle)', marginBottom: '16px' }}>
                    {[1,2,3].map(i => (
                        <div key={i} style={{ background: 'var(--bg-surface)', padding: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}><div className="sk" style={{ width: '14px', height: '14px' }} /><div className="sk" style={{ height: '9px', width: '100px' }} /></div>
                            <div className="sk" style={{ height: '32px', width: '100px', marginBottom: '8px' }} />
                            <div className="sk" style={{ height: '9px', width: '140px' }} />
                        </div>
                    ))}
                </div>
                {/* Plan + payment row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    {[1,2].map(i => (
                        <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '20px' }}>
                            <div className="sk" style={{ height: '12px', width: '120px', marginBottom: '16px' }} />
                            <div className="sk" style={{ height: '24px', width: '160px', marginBottom: '10px' }} />
                            <div className="sk" style={{ height: '9px', width: '200px', marginBottom: '6px' }} />
                            <div className="sk" style={{ height: '9px', width: '160px', marginBottom: '16px' }} />
                            <div className="sk" style={{ height: '30px', width: '120px' }} />
                        </div>
                    ))}
                </div>
                {/* Invoice table */}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}><div className="sk" style={{ height: '12px', width: '100px' }} /></div>
                    {[1,2,3,4].map(i => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 80px', padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)', gap: '16px', alignItems: 'center' }}>
                            <div className="sk" style={{ height: '10px', width: '80%' }} />
                            <div className="sk" style={{ height: '10px', width: '70%' }} />
                            <div className="sk" style={{ height: '10px', width: '60%' }} />
                            <div className="sk" style={{ height: '18px', width: '60px' }} />
                            <div className="sk" style={{ height: '26px', width: '100%' }} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const seatPct = billingData?.seatUsage?.percentage || 0;
    const renewalDate = billingData?.renewalDate
        ? new Date(billingData.renewalDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'N/A';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, sans-serif' }}>

            {/* Header */}
            <header style={{
                height: '56px', padding: '0 28px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)',
                flexShrink: 0, zIndex: 5,
            }}>
                <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <CreditCard size={16} style={{ color: 'var(--accent)' }} />
                        Billing &amp; Plan Management
                    </h2>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px', marginLeft: '24px' }}>
                        Subscription, invoices, and payment history
                    </p>
                </div>
                <HBtn onClick={handleRefresh} disabled={refreshing} label={refreshing ? 'Refreshing...' : 'Refresh'}
                    icon={<RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />} />
            </header>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }} className="custom-scrollbar">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1280px', margin: '0 auto' }}>

                    {/* Plan + Seat */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1px', background: 'var(--border-subtle)' }}>
                        {/* Plan Card — accent-tinted */}
                        <div style={{ background: 'var(--bg-surface)', padding: '28px 32px', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'var(--accent)' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                                <div>
                                    <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--accent)', marginBottom: '6px' }}>Current Plan</p>
                                    <h3 style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                                        {billingData?.currentPlan || 'Free'}
                                    </h3>
                                </div>
                                <CreditCard size={32} style={{ color: 'var(--text-muted)', opacity: 0.35 }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                                <div>
                                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Monthly Cost</p>
                                    <p style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)' }}>${billingData?.monthlyCost || 0}</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Renewal Date</p>
                                    <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{renewalDate}</p>
                                </div>
                            </div>
                            <UpgradeBtn onClick={handleUpgradePlan} />
                        </div>

                        {/* Seat Usage */}
                        <div style={{ background: 'var(--bg-surface)', padding: '28px 24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                                <Users size={16} style={{ color: 'var(--accent)' }} />
                                <div>
                                    <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>Seat Usage</p>
                                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Active users</p>
                                </div>
                            </div>
                            <div style={{ marginBottom: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>{billingData?.seatUsage?.used || 0}</span>
                                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>/ {billingData?.seatUsage?.total || 10}</span>
                                </div>
                                <div style={{ height: '6px', background: 'var(--bg-active)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${seatPct}%`, background: seatPct > 80 ? 'var(--state-danger)' : 'var(--accent)', transition: 'width 400ms ease' }} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Utilization</span>
                                <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{seatPct}%</span>
                            </div>
                            {seatPct > 80 && (
                                <div style={{ marginTop: '12px', padding: '10px 12px', background: 'var(--bg-active)', border: '1px solid var(--state-danger)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                    <AlertCircle size={13} style={{ color: 'var(--state-danger)', flexShrink: 0, marginTop: '1px' }} />
                                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>Approaching seat limit. Consider upgrading.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Spending Overview */}
                    <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <TrendingUp size={14} style={{ color: 'var(--accent)' }} />
                            <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Spending Overview</h3>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0' }}>
                            {[
                                { label: 'This Month', value: billingData?.monthlyCost || 0, delta: '+0%', up: true },
                                { label: 'Last 3 Months', value: (billingData?.monthlyCost || 0) * 3, delta: '-5%', up: false },
                                { label: 'This Year', value: (billingData?.monthlyCost || 0) * 12, delta: '+12%', up: true },
                                { label: 'Projected (Annual)', value: (billingData?.monthlyCost || 0) * 12, delta: 'Estimate', up: null },
                            ].map((item, i) => (
                                <div key={i} style={{ padding: '20px', borderRight: i < 3 ? '1px solid var(--border-subtle)' : 'none' }}>
                                    <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '6px' }}>{item.label}</p>
                                    <p style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>${item.value}</p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '4px' }}>
                                        {item.up === true && <ArrowUpRight size={11} style={{ color: 'var(--state-success)' }} />}
                                        {item.up === false && <ArrowDownRight size={11} style={{ color: 'var(--state-danger)' }} />}
                                        {item.up === null && <DollarSign size={11} style={{ color: 'var(--text-muted)' }} />}
                                        <span style={{ fontSize: '11px', color: item.up === true ? 'var(--state-success)' : item.up === false ? 'var(--state-danger)' : 'var(--text-muted)', fontWeight: 600 }}>{item.delta}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Payment History */}
                    <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FileText size={14} style={{ color: 'var(--accent)' }} />
                                <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Payment History &amp; Invoices</h3>
                            </div>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        {['Invoice', 'Date', 'Plan', 'Seats', 'Amount', 'Status', 'Actions'].map(col => (
                                            <th key={col} style={{ padding: '10px 16px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', textAlign: col === 'Amount' || col === 'Actions' ? 'right' : col === 'Status' ? 'center' : 'left' }}>{col}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoices.length === 0 ? (
                                        <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>No invoices found</td></tr>
                                    ) : invoices.map(inv => (
                                        <InvoiceRow key={inv._id || inv.invoiceNumber} inv={inv} onDownload={handleDownloadInvoice} />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* Payment Method + Billing Contact */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border-subtle)' }}>
                        <div style={{ background: 'var(--bg-surface)', padding: '20px' }}>
                            <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px' }}>Payment Method</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: 'var(--bg-active)', border: '1px solid var(--border-default)' }}>
                                <div style={{ width: '40px', height: '40px', background: 'var(--bg-surface)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <CreditCard size={18} style={{ color: 'var(--accent)' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>**** **** **** {paymentMethod?.last4 || '4242'}</p>
                                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Expires {paymentMethod?.expiryMonth || 12}/{paymentMethod?.expiryYear || 2027}</p>
                                </div>
                                <TextBtn label="Update" />
                            </div>
                        </div>
                        <div style={{ background: 'var(--bg-surface)', padding: '20px' }}>
                            <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px' }}>Billing Contact</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Email</span>
                                    <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>{billingData?.billingContact?.email || 'Not configured'}</span>
                                </div>
                                {billingData?.billingContact?.address && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Address</span>
                                        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>{billingData.billingContact.address}</span>
                                    </div>
                                )}
                                <TextBtn label="Update Details" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─ Sub-components ────────────────────────────────────────────────────────────

const InvoiceRow = ({ inv, onDownload }) => {
    const [hov, setHov] = React.useState(false);
    const statusBadge = (status) => {
        const map = {
            paid: { bg: 'rgba(90,186,138,0.12)', border: 'var(--state-success)', color: 'var(--state-success)', icon: <CheckCircle size={10} />, label: 'Paid' },
            pending: { bg: 'rgba(184,149,106,0.12)', border: 'var(--accent)', color: 'var(--accent)', icon: <Clock size={10} />, label: 'Pending' },
        };
        const s = map[status] || { bg: 'rgba(224,82,82,0.12)', border: 'var(--state-danger)', color: 'var(--state-danger)', icon: <XCircle size={10} />, label: status };
        return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', background: s.bg, border: `1px solid ${s.border}`, color: s.color, fontSize: '10px', fontWeight: 700 }}>
                {s.icon}{s.label}
            </span>
        );
    };
    return (
        <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: hov ? 'var(--bg-hover)' : 'transparent', transition: 'background 150ms ease' }}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
            <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{inv.invoiceNumber || 'N/A'}</td>
            <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                {new Date(inv.issueDate || inv.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </td>
            <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{inv.planName || 'N/A'}</td>
            <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>{inv.seatsUsed || 0} seats</td>
            <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right' }}>${inv.total || inv.amount || 0}</td>
            <td style={{ padding: '12px 16px', textAlign: 'center' }}>{statusBadge(inv.status)}</td>
            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                <button onClick={() => onDownload(inv.invoiceNumber)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: 'var(--accent)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', padding: '4px 0' }}>
                    <Download size={12} /> Download
                </button>
            </td>
        </tr>
    );
};

const UpgradeBtn = ({ onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ width: '100%', padding: '10px', background: hov ? 'var(--accent-hover)' : 'var(--accent)', border: 'none', color: 'var(--bg-base)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', transition: 'background 150ms ease', borderRadius: '0' }}>
            Upgrade Plan
        </button>
    );
};

const TextBtn = ({ label }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ background: 'none', border: 'none', color: hov ? 'var(--accent-hover)' : 'var(--accent)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', padding: '2px 0', transition: 'color 150ms ease' }}>
            {label}
        </button>
    );
};

const HBtn = ({ onClick, disabled, label, icon }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} disabled={disabled} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '5px', background: hov && !disabled ? 'var(--bg-hover)' : 'var(--bg-active)', border: '1px solid var(--border-default)', color: disabled ? 'var(--text-muted)' : hov ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '12px', fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1, transition: 'all 150ms ease', borderRadius: '0' }}>
            {icon}{label}
        </button>
    );
};

export default OwnerBilling;
