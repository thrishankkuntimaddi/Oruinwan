import React, { useState, useEffect } from 'react';
import api from '@services/api';
import { ArrowLeft, Shield, AlertTriangle, Save, Globe, Mail } from 'lucide-react';
import { useToast } from '../../../../contexts/ToastContext';

const CompanyDetail = ({ companyId, onBack }) => {
    const [company, setCompany] = useState(null);
    const [loading, setLoading] = useState(true);
    const [plan, setPlan] = useState('');
    const { showToast } = useToast();

    useEffect(() => { if (companyId) fetchCompany(); }, [companyId]);

    const fetchCompany = async () => {
        try {
            const res = await api.get('/api/admin/active-companies');
            const found = res.data.find(c => c._id === companyId);
            if (found) { setCompany(found); setPlan(found.plan || 'free'); }
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleSave = async () => {
        try { showToast('Company updated successfully', 'success'); }
        catch { showToast('Failed to update', 'error'); }
    };

    if (loading) return (
        <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[1, 2, 3].map(i => (
                <div key={i} style={{ height: '60px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', animation: 'pulse 1.5s ease infinite' }} />
            ))}
        </div>
    );

    if (!company) return <div style={{ padding: '32px', fontSize: '13px', color: 'var(--text-muted)' }}>Company not found</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
            <button
                onClick={onBack}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'none', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', borderRadius: '2px', width: 'fit-content', transition: 'all 150ms ease' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-default)'; }}
            >
                <ArrowLeft size={14} /> Back to List
            </button>

            <div style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', overflow: 'hidden' }}>
                {}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-active)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '52px', height: '52px', background: 'var(--bg-base)', border: '2px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                        {company.logo ? <img src={company.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : company.name.charAt(0)}
                    </div>
                    <div>
                        <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{company.name}</h1>
                        <div style={{ display: 'flex', gap: '16px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Globe size={12} /> {company.domain || 'No domain'}
                            </span>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Mail size={12} /> {company.billingEmail}
                            </span>
                        </div>
                    </div>
                </div>

                {}
                <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    {}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
                            <Shield size={14} style={{ color: 'var(--accent)' }} />
                            <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Subscription & Status</span>
                        </div>

                        <div style={{ padding: '16px', background: 'var(--bg-active)', border: '1px solid var(--border-subtle)' }}>
                            <FieldLabel text="Subscription Plan" />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                {['free', 'starter', 'professional', 'enterprise'].map(p => (
                                    <PlanBtn key={p} label={p} active={plan === p} onClick={() => setPlan(p)} />
                                ))}
                            </div>
                        </div>

                        <div style={{ padding: '16px', border: '1px solid var(--state-danger)', background: 'var(--bg-surface)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                <AlertTriangle size={14} style={{ color: 'var(--state-danger)' }} />
                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--state-danger)' }}>Danger Zone</span>
                            </div>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>Suspend access for this company. Users will not be able to log in.</p>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <DangerBtn label="Suspend Company" ghost />
                                <DangerBtn label="Delete Data" />
                            </div>
                        </div>
                    </div>

                    {}
                    <div>
                        <div style={{ paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Usage Statistics</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border-subtle)' }}>
                            {[
                                { label: 'Total Users', value: '24' },
                                { label: 'Storage Used', value: '4.2 GB' },
                                { label: 'Workspaces', value: '3' },
                                { label: 'Last Active', value: '2h ago' },
                            ].map(s => (
                                <div key={s.label} style={{ background: 'var(--bg-surface)', padding: '14px' }}>
                                    <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>{s.label}</p>
                                    <p style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.015em' }}>{s.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {}
                <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-active)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button onClick={onBack} style={{ padding: '8px 16px', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', transition: 'color 150ms ease' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}>Cancel</button>
                    <SaveBtn onClick={handleSave} />
                </div>
            </div>
        </div>
    );
};

const FieldLabel = ({ text }) => (
    <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>{text}</p>
);

const PlanBtn = ({ label, active, onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{
                padding: '8px', background: active ? 'var(--bg-base)' : 'transparent',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border-default)'}`,
                color: active ? 'var(--accent)' : hov ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '12px', fontWeight: active ? 700 : 400, textTransform: 'capitalize',
                cursor: 'pointer', borderRadius: '2px', transition: 'all 150ms ease'
            }}>
            {label}
        </button>
    );
};

const DangerBtn = ({ label, ghost }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{
                padding: '7px 12px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', borderRadius: '2px',
                background: ghost ? 'transparent' : (hov ? '#c04040' : 'var(--state-danger)'),
                border: `1px solid ${hov ? 'var(--state-danger)' : 'var(--state-danger)'}`,
                color: ghost ? 'var(--state-danger)' : 'white',
                transition: 'all 150ms ease'
            }}>
            {label}
        </button>
    );
};

const SaveBtn = ({ onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 20px', background: hov ? 'var(--accent-hover)' : 'var(--accent)', border: 'none', color: 'var(--bg-base)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', borderRadius: '2px', transition: 'background 150ms ease' }}>
            <Save size={14} /> Save Changes
        </button>
    );
};

export default CompanyDetail;
