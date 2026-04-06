import React, { useState, useEffect } from 'react';
import api from '@services/api';
import { Megaphone, Send, Calendar, Users, Check } from 'lucide-react';
import { useToast } from '../../../../contexts/ToastContext';

const Broadcast = () => {
    const [activeTab, setActiveTab] = useState('compose');
    const [formData, setFormData] = useState({ subject: '', message: '', targetType: 'all', targetCompanies: [], scheduleType: 'now' });
    const [companies, setCompanies] = useState([]);
    const [broadcastHistory, setBroadcastHistory] = useState([]);
    const [sending, setSending] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        if (formData.targetType === 'specific') fetchCompanies();
        if (activeTab === 'history') fetchHistory();
    }, [formData.targetType, activeTab]);

    const fetchCompanies = async () => {
        try { const res = await api.get('/api/admin/active-companies'); setCompanies(res.data); }
        catch (err) { console.error('Failed to fetch companies:', err); }
    };
    const fetchHistory = async () => {
        try { const res = await api.get('/api/admin/broadcast/history'); setBroadcastHistory(res.data); }
        catch (err) { console.error('Failed to fetch history:', err); }
    };
    const handleCompanyToggle = (id) => {
        setFormData(prev => ({ ...prev, targetCompanies: prev.targetCompanies.includes(id) ? prev.targetCompanies.filter(x => x !== id) : [...prev.targetCompanies, id] }));
    };
    const handleSend = async () => {
        if (!formData.subject.trim() || !formData.message.trim()) { showToast('Please fill in subject and message', 'error'); return; }
        if (formData.targetType === 'specific' && formData.targetCompanies.length === 0) { showToast('Please select at least one company', 'error'); return; }
        setSending(true);
        try {
            await api.post('/api/admin/broadcast/send', formData);
            showToast('Broadcast sent successfully!', 'success');
            setFormData({ subject: '', message: '', targetType: 'all', targetCompanies: [], scheduleType: 'now' });
            setActiveTab('history');
        } catch (err) { showToast(err.response?.data?.message || 'Failed to send broadcast', 'error'); }
        finally { setSending(false); }
    };
    const getTargetCount = () => formData.targetType === 'specific' ? formData.targetCompanies.length : formData.targetType === 'all' ? companies.length : '?';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
            {/* Header */}
            <div>
                <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.015em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Megaphone size={18} style={{ color: 'var(--accent)' }} />
                    Broadcast Messages
                </h1>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Send announcements to companies</p>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border-subtle)' }}>
                {['compose', 'history'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            padding: '10px 20px',
                            background: 'none', border: 'none',
                            borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                            color: activeTab === tab ? 'var(--accent)' : 'var(--text-muted)',
                            fontSize: '13px', fontWeight: activeTab === tab ? 700 : 400,
                            cursor: 'pointer', textTransform: 'capitalize',
                            transition: 'color 150ms ease'
                        }}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Compose Tab */}
            {activeTab === 'compose' && (
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', alignItems: 'start' }}>
                    {/* Form */}
                    <div style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <FormField label="Subject *">
                            <input
                                type="text"
                                value={formData.subject}
                                onChange={e => setFormData(p => ({ ...p, subject: e.target.value }))}
                                placeholder="e.g., New Feature Announcement"
                                style={inputStyle}
                            />
                        </FormField>
                        <FormField label="Message *">
                            <textarea
                                value={formData.message}
                                onChange={e => setFormData(p => ({ ...p, message: e.target.value }))}
                                placeholder="Write your broadcast message here..."
                                rows={8}
                                style={{ ...inputStyle, resize: 'none' }}
                            />
                        </FormField>
                        <FormField label="Send To *">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                {[
                                    { value: 'all', label: 'All Companies', icon: Users },
                                    { value: 'active', label: 'Active Only', icon: Check },
                                    { value: 'pending', label: 'Pending Only', icon: Calendar },
                                    { value: 'specific', label: 'Specific Companies', icon: Users },
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setFormData(p => ({ ...p, targetType: opt.value }))}
                                        style={{
                                            padding: '12px',
                                            background: formData.targetType === opt.value ? 'var(--bg-active)' : 'transparent',
                                            border: `1px solid ${formData.targetType === opt.value ? 'var(--accent)' : 'var(--border-default)'}`,
                                            cursor: 'pointer', textAlign: 'left',
                                            transition: 'all 150ms ease'
                                        }}
                                    >
                                        <opt.icon size={14} style={{ color: formData.targetType === opt.value ? 'var(--accent)' : 'var(--text-muted)', marginBottom: '6px' }} />
                                        <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>{opt.label}</p>
                                    </button>
                                ))}
                            </div>
                        </FormField>
                        {formData.targetType === 'specific' && (
                            <FormField label={`Select Companies (${formData.targetCompanies.length} selected)`}>
                                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-default)', padding: '8px' }} className="custom-scrollbar">
                                    {companies.map(company => (
                                        <label
                                            key={company._id}
                                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', cursor: 'pointer', transition: 'background 150ms ease' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <input type="checkbox" checked={formData.targetCompanies.includes(company._id)} onChange={() => handleCompanyToggle(company._id)} style={{ accentColor: 'var(--accent)' }} />
                                            <div>
                                                <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>{company.name}</p>
                                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>{company.domain}</p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </FormField>
                        )}
                    </div>

                    {/* Preview & Send */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', padding: '20px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '14px' }}>Preview</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <PreviewField label="Subject" value={formData.subject || 'No subject'} />
                                <PreviewField label="Message" value={formData.message || 'No message'} />
                                <PreviewField label="Recipients" value={`${getTargetCount()} companies`} accent />
                            </div>
                        </div>
                        <SendBtn sending={sending} onClick={handleSend} />
                    </div>
                </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
                <div style={{ border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-active)', borderBottom: '1px solid var(--border-subtle)' }}>
                                {['Subject', 'Recipients', 'Sent', 'Status'].map(col => (
                                    <th key={col} style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'left' }}>{col}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {broadcastHistory.map(b => (
                                <HistoryRow key={b._id} broadcast={b} />
                            ))}
                        </tbody>
                    </table>
                    {broadcastHistory.length === 0 && (
                        <div style={{ padding: '48px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>No broadcast history yet</div>
                    )}
                </div>
            )}
        </div>
    );
};

const inputStyle = {
    width: '100%', padding: '10px 12px',
    background: 'var(--bg-input)', border: '1px solid var(--border-default)',
    color: 'var(--text-primary)', fontSize: '13px',
    outline: 'none', fontFamily: 'Inter, system-ui, sans-serif',
    boxSizing: 'border-box'
};

const FormField = ({ label, children }) => (
    <div>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
            {label}
        </label>
        {children}
    </div>
);

const PreviewField = ({ label, value, accent }) => (
    <div>
        <p style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '2px' }}>{label}</p>
        <p style={{ fontSize: '13px', color: accent ? 'var(--accent)' : 'var(--text-primary)', fontWeight: accent ? 600 : 400, whiteSpace: 'pre-wrap', margin: 0 }}>{value}</p>
    </div>
);

const SendBtn = ({ sending, onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button
            onClick={onClick}
            disabled={sending}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                width: '100%', padding: '14px',
                background: hov ? 'var(--accent-hover)' : 'var(--accent)',
                border: 'none', color: 'var(--bg-base)',
                fontSize: '14px', fontWeight: 700,
                cursor: sending ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                borderRadius: '2px', opacity: sending ? 0.6 : 1,
                transition: 'background 150ms ease'
            }}
        >
            {sending ? (
                <>
                    <div style={{ width: '16px', height: '16px', border: '2px solid var(--bg-base)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    Sending...
                </>
            ) : (
                <><Send size={16} /> Send Broadcast</>
            )}
        </button>
    );
};

const HistoryRow = ({ broadcast }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <tr
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{ background: hov ? 'var(--bg-hover)' : 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', transition: 'background 150ms ease' }}
        >
            <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{broadcast.subject}</td>
            <td style={{ padding: '14px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>{broadcast.recipientCount} companies</td>
            <td style={{ padding: '14px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(broadcast.sentAt).toLocaleString()}</td>
            <td style={{ padding: '14px 16px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--state-success)', padding: '2px 6px', border: '1px solid var(--state-success)' }}>Sent</span>
            </td>
        </tr>
    );
};

export default Broadcast;
