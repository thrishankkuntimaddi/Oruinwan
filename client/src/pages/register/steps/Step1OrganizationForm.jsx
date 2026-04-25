import React, { useState } from 'react';
import { Building, Globe, CheckCircle2, AlertCircle, Loader } from 'lucide-react';

const inp = (err, success) => ({
    width: '100%', boxSizing: 'border-box', padding: '10px 36px 10px 40px',
    background: 'var(--bg-input)',
    border: `1px solid ${err ? '#e05252' : success ? '#5aba8a' : 'rgba(255,255,255,0.08)'}`,
    color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
    fontFamily: 'Inter, system-ui, sans-serif', transition: 'border-color 150ms ease',
});

const Label = ({ children }) => (
    <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
        {children}
    </label>
);

const StatusIcon = ({ s }) => {
    if (s === 'checking') return <Loader size={13} style={{ color: '#b8956a', animation: 'spin 0.8s linear infinite' }} />;
    if (s === 'available') return <CheckCircle2 size={13} style={{ color: '#5aba8a' }} />;
    if (s === 'taken') return <AlertCircle size={13} style={{ color: '#e05252' }} />;
    return null;
};

const Step1OrganizationForm = ({ formData, onChange, errors, validationStatus, theme }) => {
    const [focused, setFocused] = useState(null);
    return (
        <div style={{ maxWidth: '560px', margin: '0 auto' }}>
            <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '32px' }}>
                Tell us about the entity you are registering.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {}
                <div>
                    <Label>Company Name</Label>
                    <div style={{ position: 'relative' }}>
                        <Building size={13} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                        <input name="companyName" value={formData.companyName} onChange={onChange} placeholder="e.g. Acme Innovations Inc."
                            onFocus={() => setFocused('companyName')} onBlur={() => setFocused(null)}
                            style={{ ...inp(!!errors.companyName, validationStatus.companyName === 'available'), paddingRight: '36px', borderColor: errors.companyName ? '#e05252' : validationStatus.companyName === 'available' ? '#5aba8a' : focused === 'companyName' ? 'rgba(184,149,106,0.5)' : 'rgba(255,255,255,0.08)' }} />
                        <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                            <StatusIcon s={validationStatus.companyName} />
                        </div>
                    </div>
                    {errors.companyName && <p style={{ fontSize: '11px', color: '#e05252', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={11} />{errors.companyName}</p>}
                </div>

                {}
                <div>
                    <Label>Company Domain</Label>
                    <div style={{ position: 'relative' }}>
                        <Globe size={13} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                        <input name="companyDomain" value={formData.companyDomain} onChange={onChange} placeholder="e.g. acme.com (must match email domain)"
                            onFocus={() => setFocused('companyDomain')} onBlur={() => setFocused(null)}
                            style={{ ...inp(!!errors.companyDomain, validationStatus.companyDomain === 'available'), paddingRight: '36px', borderColor: errors.companyDomain ? '#e05252' : validationStatus.companyDomain === 'available' ? '#5aba8a' : focused === 'companyDomain' ? 'rgba(184,149,106,0.5)' : 'rgba(255,255,255,0.08)' }} />
                        <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                            <StatusIcon s={validationStatus.companyDomain} />
                        </div>
                    </div>
                    {errors.companyDomain && <p style={{ fontSize: '11px', color: '#e05252', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={11} />{errors.companyDomain}</p>}
                </div>
            </div>
        </div>
    );
};

export default Step1OrganizationForm;
