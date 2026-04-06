import React, { useState, useEffect } from 'react';
import api from '@services/api';
import { Globe, MessageSquare, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const getPlanColor = (plan) => {
    if (plan === 'enterprise') return 'var(--accent)';
    if (plan === 'professional') return 'var(--state-success)';
    return 'var(--text-muted)';
};

const ActiveCompanies = () => {
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    useEffect(() => { fetchCompanies(); }, []);

    const fetchCompanies = async () => {
        try {
            const res = await api.get('/api/admin/active-companies');
            setCompanies(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const filtered = companies.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

    if (loading) return <LoadingSpinner />;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.015em', margin: 0 }}>Active Companies</h1>
                <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Search companies..." />
            </div>

            <div style={{ border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-active)', borderBottom: '1px solid var(--border-subtle)' }}>
                                {['Company', 'Plan', 'Admin', 'Joined', 'Actions'].map((col, i) => (
                                    <th key={col} style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: i === 4 ? 'right' : 'left' }}>{col}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(company => (
                                <CompanyRow key={company._id} company={company} navigate={navigate} />
                            ))}
                        </tbody>
                    </table>
                    {filtered.length === 0 && (
                        <div style={{ padding: '48px 24px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
                            No active companies found.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const CompanyRow = ({ company, navigate }) => {
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
                        {company.logo ? <img src={company.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : company.name.charAt(0)}
                    </div>
                    <div>
                        <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{company.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                            <Globe size={10} /> {company.domain || 'No domain'}
                        </div>
                    </div>
                </div>
            </td>
            <td style={{ padding: '14px 16px' }}>
                <span style={{
                    fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: getPlanColor(company.plan),
                    padding: '2px 8px',
                    border: `1px solid ${getPlanColor(company.plan)}`
                }}>
                    {company.plan || 'Free'}
                </span>
            </td>
            <td style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{company.admins[0]?.user?.username || 'Unknown'}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>{company.billingEmail}</div>
            </td>
            <td style={{ padding: '14px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                {new Date(company.createdAt).toLocaleDateString()}
            </td>
            <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                    <IconBtn icon={MessageSquare} title="Message Admin" onClick={() => navigate(`/chttrix-admin/dm/${company._id}`)} />
                    <PrimaryBtn label="Manage" />
                </div>
            </td>
        </tr>
    );
};

const IconBtn = ({ icon: Icon, title, onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} title={title} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{ width: '32px', height: '32px', background: hov ? 'var(--bg-hover)' : 'var(--bg-active)', border: '1px solid var(--border-default)', color: hov ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '2px', transition: 'all 150ms ease' }}>
            <Icon size={14} />
        </button>
    );
};

const PrimaryBtn = ({ label, onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{ padding: '6px 12px', background: hov ? 'var(--bg-hover)' : 'var(--bg-active)', border: '1px solid var(--border-default)', color: hov ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '12px', fontWeight: 500, borderRadius: '2px', cursor: 'pointer', transition: 'all 150ms ease' }}>
            {label}
        </button>
    );
};

const SearchInput = ({ value, onChange, placeholder }) => (
    <div style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={e => onChange(e.target.value)}
            style={{
                paddingLeft: '32px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px',
                background: 'var(--bg-input)', border: '1px solid var(--border-default)',
                color: 'var(--text-primary)', fontSize: '13px',
                outline: 'none', width: '220px',
                fontFamily: 'inherit'
            }}
        />
    </div>
);

const LoadingSpinner = () => (
    <div style={{ padding: '20px', background: 'var(--bg-base)' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <div className="sk" style={{ height: '32px', flex: 1 }} />
            <div className="sk" style={{ height: '32px', width: '120px' }} />
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', background: 'var(--bg-active)', borderBottom: '1px solid var(--border-subtle)', padding: '10px 16px', gap: '16px' }}>
                {[120,60,60,70,40].map((w,i) => <div key={i} className="sk" style={{ height: '8px', width: `${w}px` }} />)}
            </div>
            {[1,2,3,4,5].map(i => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '11px 16px', borderBottom: '1px solid var(--border-subtle)', gap: '16px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="sk" style={{ width: '28px', height: '28px', flexShrink: 0 }} />
                        <div><div className="sk" style={{ height: '10px', width: '120px', marginBottom: '4px' }} /><div className="sk" style={{ height: '8px', width: '80px' }} /></div>
                    </div>
                    <div className="sk" style={{ height: '18px', width: '60px' }} />
                    <div className="sk" style={{ height: '10px', width: '40px' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div className="sk" style={{ width: '6px', height: '6px', borderRadius: '50%' }} /><div className="sk" style={{ height: '8px', width: '40px' }} /></div>
                    <div style={{ display: 'flex', gap: '4px' }}><div className="sk" style={{ height: '22px', width: '22px' }} /><div className="sk" style={{ height: '22px', width: '22px' }} /></div>
                </div>
            ))}
        </div>
    </div>
);

export default ActiveCompanies;
