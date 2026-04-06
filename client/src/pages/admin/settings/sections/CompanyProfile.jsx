import React, { useState, useEffect } from 'react';
import { Building, MapPin, Globe as GlobeIcon, Users, Save, Loader } from 'lucide-react';
import { useCompany } from '../../../../contexts/CompanyContext';
import { useToast } from '../../../../contexts/ToastContext';
import api from '@services/api';

const inputSt = {
    width: '100%', padding: '10px 12px',
    background: 'var(--bg-input)', border: '1px solid var(--border-default)',
    color: 'var(--text-primary)', fontSize: '13px',
    outline: 'none', fontFamily: 'Inter, system-ui, sans-serif',
    boxSizing: 'border-box'
};

const iconInputSt = { ...inputSt, paddingLeft: '34px' };

const CompanyProfile = () => {
    const { company, refreshCompany } = useCompany();
    const { showToast } = useToast();
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({ name: '', description: '', industry: '', size: '', location: '', website: '', phone: '', address: '' });

    useEffect(() => {
        if (company) setFormData({
            name: company.name || '', description: company.description || '', industry: company.industry || '',
            size: company.size || '', location: company.location || '', website: company.website || '',
            phone: company.phone || '', address: company.address || ''
        });
    }, [company]);

    const handleChange = e => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.put(`/api/companies/${company.id}/settings/profile`, formData);
            await refreshCompany();
            showToast('Company profile updated successfully', 'success');
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to update profile', 'error');
        } finally { setSaving(false); }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
            <div>
                <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.015em', marginBottom: '4px' }}>Company Profile</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Basic information about your organization</p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Basic Information */}
                <div style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', padding: '20px' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>Basic Information</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div>
                            <FieldLabel text="Company Name" />
                            <div style={{ position: 'relative' }}>
                                <Building size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Your Company Name" style={iconInputSt} />
                            </div>
                        </div>

                        <div>
                            <FieldLabel text="Description" />
                            <textarea name="description" value={formData.description} onChange={handleChange} rows={3} placeholder="Brief description of your company" style={{ ...inputSt, resize: 'none' }} />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                                <FieldLabel text="Industry" />
                                <select name="industry" value={formData.industry} onChange={handleChange} style={inputSt}>
                                    <option value="">Select industry</option>
                                    {['technology', 'finance', 'healthcare', 'education', 'retail', 'manufacturing', 'other'].map(i => (
                                        <option key={i} value={i}>{i.charAt(0).toUpperCase() + i.slice(1)}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <FieldLabel text="Company Size" />
                                <div style={{ position: 'relative' }}>
                                    <Users size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                    <select name="size" value={formData.size} onChange={handleChange} style={iconInputSt}>
                                        <option value="">Select size</option>
                                        {['1-10', '11-50', '51-200', '201-500', '500+'].map(s => (
                                            <option key={s} value={s}>{s} employees</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Contact Information */}
                <div style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', padding: '20px' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>Contact Information</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div>
                            <FieldLabel text="Website" />
                            <div style={{ position: 'relative' }}>
                                <GlobeIcon size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                <input type="url" name="website" value={formData.website} onChange={handleChange} placeholder="https://company.com" style={iconInputSt} />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                                <FieldLabel text="Phone" />
                                <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="+1 (555) 000-0000" style={inputSt} />
                            </div>
                            <div>
                                <FieldLabel text="Location" />
                                <div style={{ position: 'relative' }}>
                                    <MapPin size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                    <input type="text" name="location" value={formData.location} onChange={handleChange} placeholder="City, Country" style={iconInputSt} />
                                </div>
                            </div>
                        </div>

                        <div>
                            <FieldLabel text="Address" />
                            <textarea name="address" value={formData.address} onChange={handleChange} rows={2} placeholder="Full business address" style={{ ...inputSt, resize: 'none' }} />
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <SaveBtn saving={saving} />
                </div>
            </form>
        </div>
    );
};

const FieldLabel = ({ text }) => (
    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>{text}</label>
);

const SaveBtn = ({ saving }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button
            type="submit"
            disabled={saving}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px',
                background: hov ? 'var(--accent-hover)' : 'var(--accent)',
                border: 'none', color: 'var(--bg-base)',
                fontSize: '13px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
                borderRadius: '2px', opacity: saving ? 0.7 : 1,
                transition: 'background 150ms ease'
            }}>
            {saving ? <><Loader size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> Saving...</> : <><Save size={13} /> Save Changes</>}
        </button>
    );
};

export default CompanyProfile;
