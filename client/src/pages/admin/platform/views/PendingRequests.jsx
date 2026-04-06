import React, { useState, useEffect } from 'react';
import api from '@services/api';
import { Check, X, Globe, ExternalLink } from 'lucide-react';
import { useToast } from '../../../../contexts/ToastContext';

const PendingRequests = () => {
    const [companies, setCompanies] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [reason, setReason] = useState('');
    const { showToast } = useToast();

    useEffect(() => { fetchPending(); }, []);

    const fetchPending = async () => {
        try {
            const res = await api.get('/api/admin/pending-companies');
            setCompanies(res.data);
        } catch (err) {
            console.error('❌ Error fetching pending companies:', err);
        }
    };

    const handleApprove = async (id) => {
        try {
            await api.post(`/api/admin/approve-company/${id}`, { message: reason });
            showToast('Company Approved! Email sent.', 'success');
            setCompanies(prev => prev.filter(c => c._id !== id));
            setSelectedCompany(null);
            setReason('');
        } catch { showToast('Failed to approve', 'error'); }
    };

    const handleReject = async (id) => {
        if (!reason.trim()) { showToast('Please provide a rejection reason', 'error'); return; }
        try {
            await api.post(`/api/admin/reject-company/${id}`, { message: reason });
            showToast('Company Rejected', 'info');
            setCompanies(prev => prev.filter(c => c._id !== id));
            setSelectedCompany(null);
            setReason('');
        } catch { showToast('Failed to reject', 'error'); }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.015em', margin: 0 }}>Pending Registrations</h1>

            {companies.length === 0 ? (
                <div style={{ padding: '64px 24px', textAlign: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <Check size={32} style={{ color: 'var(--state-success)', margin: '0 auto 12px' }} />
                    <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>All Caught Up!</h2>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No pending verifications.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1px', background: 'var(--border-subtle)' }}>
                    {companies.map(company => (
                        <CompanyCard key={company._id} company={company} onReview={() => setSelectedCompany(company)} />
                    ))}
                </div>
            )}

            {selectedCompany && (
                <ReviewModal
                    company={selectedCompany}
                    reason={reason}
                    setReason={setReason}
                    onClose={() => { setSelectedCompany(null); setReason(''); }}
                    onApprove={() => handleApprove(selectedCompany._id)}
                    onReject={() => handleReject(selectedCompany._id)}
                />
            )}
        </div>
    );
};

const CompanyCard = ({ company, onReview }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <div
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{ background: hov ? 'var(--bg-hover)' : 'var(--bg-surface)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', transition: 'background 150ms ease' }}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ width: '36px', height: '36px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700, color: 'var(--accent)' }}>
                    {company.name.charAt(0)}
                </div>
                <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)', padding: '2px 6px', border: '1px solid var(--accent)' }}>Pending</span>
            </div>

            <div>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{company.name}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    <Globe size={11} /> {company.domain || 'No Domain'}
                </div>
            </div>

            <div style={{ background: 'var(--bg-active)', border: '1px solid var(--border-subtle)', padding: '10px 12px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>Documents</div>
                {company.documents?.length > 0 ? company.documents.map((doc, i) => (
                    <a key={i} href={doc.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--accent)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <ExternalLink size={11} /> {doc.name}
                    </a>
                )) : <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No docs uploaded</span>}
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Submitted: {new Date(company.createdAt).toLocaleDateString()}</div>

            <button
                onClick={onReview}
                style={{ width: '100%', padding: '10px', background: 'var(--bg-active)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', borderRadius: '2px', transition: 'background 150ms ease' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-active)'}
            >
                Review Application
            </button>
        </div>
    );
};

const ReviewModal = ({ company, reason, setReason, onClose, onApprove, onReject }) => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', overflowY: 'auto' }}>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', width: '100%', maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto', padding: '32px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }} className="custom-scrollbar">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Review Application</h2>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Detailed verification for <strong style={{ color: 'var(--text-primary)' }}>{company.name}</strong></p>
                </div>
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
                    <X size={20} />
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                <InfoBlock title="Company Information" fields={[
                    { label: 'Company Name', value: company.name },
                    { label: 'Domain', value: company.domain || 'N/A' },
                    { label: 'Company Email', value: company.billingEmail || 'N/A' },
                    { label: 'Phone', value: company.settings?.phone || company.ownerPhone || 'N/A' },
                ]} />
                <InfoBlock title="Admin Information" fields={[
                    { label: 'Full Name', value: company.admins[0]?.user?.username || company.admins[0]?.user?.name || 'N/A' },
                    { label: 'Personal Email', value: company.admins[0]?.user?.personalEmail || company.admins[0]?.user?.email || 'N/A' },
                    { label: 'Job Title', value: company.admins[0]?.user?.jobTitle || 'Admin' },
                    { label: 'Phone', value: company.admins[0]?.user?.phone || 'N/A' },
                ]} />
            </div>

            <div style={{ marginBottom: '24px' }}>
                <SectionLabel text="Supporting Documents" />
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {company.documents?.length > 0 ? company.documents.map((doc, i) => (
                        <a key={i} href={doc.url} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: 'var(--bg-active)', border: '1px solid var(--border-default)', color: 'var(--accent)', fontSize: '12px', fontWeight: 500, textDecoration: 'none' }}>
                            <ExternalLink size={13} /> {doc.name || `Document ${i + 1}`}
                        </a>
                    )) : <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No documents provided.</p>}
                </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Message to User
                </label>
                <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="e.g. 'Congratulations! Welcome to Chttrix.' or 'Please upload a valid business license.'"
                    rows={4}
                    style={{ width: '100%', padding: '12px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>This message will be included in the email sent to the user.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)' }}>
                <button onClick={onReject} style={{ padding: '14px', background: 'none', border: '1px solid var(--state-danger)', color: 'var(--state-danger)', fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '2px', transition: 'background 150ms ease' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(224,82,82,0.07)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <X size={16} /> Reject Application
                </button>
                <button onClick={onApprove} style={{ padding: '14px', background: 'var(--accent)', border: 'none', color: 'var(--bg-base)', fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '2px', transition: 'background 150ms ease' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--accent)'}>
                    <Check size={16} /> Approve & Onboard
                </button>
            </div>
        </div>
    </div>
);

const InfoBlock = ({ title, fields }) => (
    <div>
        <SectionLabel text={title} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
            {fields.map(f => (
                <div key={f.label}>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '2px' }}>{f.label}</p>
                    <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{f.value}</p>
                </div>
            ))}
        </div>
    </div>
);

const SectionLabel = ({ text }) => (
    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.13em', textTransform: 'uppercase', padding: '0 0 8px', marginBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
        {text}
    </div>
);

export default PendingRequests;
