// Step2AdministratorForm.jsx — Monolith Flow Design System
import React, { useState } from 'react';
import { User, Mail, Phone, Briefcase, ChevronDown, CheckCircle2, AlertCircle } from 'lucide-react';
import CustomDropdown from '../../../components/shared/CustomDropdown';

const inp = (hasError, isSuccess) => ({
    width: '100%', boxSizing: 'border-box',
    padding: '10px 12px 10px 40px',
    background: 'var(--bg-input)',
    border: `1px solid ${hasError ? '#e05252' : isSuccess ? '#5aba8a' : 'rgba(255,255,255,0.08)'}`,
    color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
    fontFamily: 'Inter, system-ui, sans-serif',
    transition: 'border-color 150ms ease',
});

const Label = ({ children }) => (
    <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
        {children}
    </label>
);

const ErrMsg = ({ msg }) => msg
    ? <p style={{ fontSize: '11px', color: '#e05252', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <AlertCircle size={11} />{msg}
      </p>
    : null;

const VerifyBtn = ({ status, onClick }) => {
    const verified = status === 'verified';
    return (
        <button type="button" onClick={onClick} disabled={verified}
        style={{
                padding: '10px 16px', flexShrink: 0,
                background: verified ? 'rgba(90,186,138,0.1)' : '#b8956a',
                color: verified ? '#5aba8a' : '#0c0c0c',
                fontSize: '12px', fontWeight: 700, cursor: verified ? 'default' : 'pointer',
                fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '5px',
                transition: 'opacity 150ms ease', whiteSpace: 'nowrap',
                border: verified ? '1px solid rgba(90,186,138,0.25)' : 'none',
            }}
            onMouseEnter={e => !verified && (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={e => !verified && (e.currentTarget.style.opacity = '1')}>
            {verified ? <><CheckCircle2 size={12} />Verified</> : 'Verify'}
        </button>
    );
};

// Accept and ignore theme prop — always dark
const Step2AdministratorForm = ({
    formData, onChange, onRoleChange, errors,
    validationStatus, verificationStatus,
    onVerify, ROLES, PHONE_CODES, theme,
}) => {
    const [focused, setFocused] = useState(null);

    const emailSuccess = validationStatus.personalEmail === 'available' && verificationStatus.personalEmail === 'verified';
    const phoneSuccess = validationStatus.phone === 'available' && verificationStatus.phone === 'verified';

    return (
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '32px' }}>
                We need a point of contact for this account.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Name + Role row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {/* Admin Name */}
                    <div>
                        <Label>Your Full Name</Label>
                        <div style={{ position: 'relative' }}>
                            <User size={13} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                            <input name="adminName" value={formData.adminName} onChange={onChange} placeholder="John Doe"
                                onFocus={() => setFocused('adminName')} onBlur={() => setFocused(null)}
                                style={{ ...inp(!!errors.adminName), borderColor: errors.adminName ? '#e05252' : focused === 'adminName' ? 'rgba(184,149,106,0.5)' : 'rgba(255,255,255,0.08)' }} />
                        </div>
                        <ErrMsg msg={errors.adminName} />
                    </div>

                    {/* Role */}
                    <div>
                        <Label>Role</Label>
                        <div style={{ position: 'relative' }}>
                            <Briefcase size={13} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', zIndex: 1 }} />
                            <select value={formData.role} onChange={e => onRoleChange(e.target.value)}
                                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px 10px 36px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', fontFamily: 'inherit', cursor: 'pointer', appearance: 'none' }}>
                                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                            <ChevronDown size={12} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                        </div>
                    </div>
                </div>

                {/* Other role */}
                {formData.role === 'Other' && (
                    <div>
                        <Label>Specify Role</Label>
                        <input name="roleOther" value={formData.roleOther} onChange={onChange} placeholder="e.g. CTO"
                            onFocus={() => setFocused('roleOther')} onBlur={() => setFocused(null)}
                            style={{ ...inp(!!errors.roleOther), width: '100%', boxSizing: 'border-box', paddingLeft: '12px', borderColor: errors.roleOther ? '#e05252' : focused === 'roleOther' ? 'rgba(184,149,106,0.5)' : 'rgba(255,255,255,0.08)' }} />
                        <ErrMsg msg={errors.roleOther} />
                    </div>
                )}

                <div style={{ height: '1px', background: 'var(--bg-hover)' }} />

                {/* Personal Email */}
                <div>
                    <Label>
                        Personal Email <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(For account recovery)</span>
                    </Label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Mail size={13} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                            <input name="personalEmail" type="email" value={formData.personalEmail} onChange={onChange} placeholder="john@gmail.com"
                                onFocus={() => setFocused('personalEmail')} onBlur={() => setFocused(null)}
                                style={{ ...inp(!!errors.personalEmail || validationStatus.personalEmail === 'taken', emailSuccess), width: '100%', boxSizing: 'border-box', borderColor: errors.personalEmail || validationStatus.personalEmail === 'taken' ? '#e05252' : emailSuccess ? '#5aba8a' : focused === 'personalEmail' ? 'rgba(184,149,106,0.5)' : 'rgba(255,255,255,0.08)' }} />
                        </div>
                        <VerifyBtn status={verificationStatus.personalEmail} onClick={() => onVerify('personalEmail')} />
                    </div>
                    <ErrMsg msg={errors.personalEmail} />
                </div>

                {/* Phone Number */}
                <div>
                    <Label>Phone Number</Label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {/* Country code */}
                        <div style={{ position: 'relative', width: '120px', flexShrink: 0 }}>
                            <select name="phoneCode" value={formData.phoneCode} onChange={onChange}
                                style={{ width: '100%', padding: '10px 28px 10px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', fontFamily: 'inherit', cursor: 'pointer', appearance: 'none' }}>
                                {PHONE_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                            </select>
                            <ChevronDown size={11} style={{ position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                        </div>

                        {/* Phone input */}
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Phone size={13} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                            <input name="phone" value={formData.phone} onChange={onChange} placeholder="000-000-0000"
                                onFocus={() => setFocused('phone')} onBlur={() => setFocused(null)}
                                style={{ ...inp(!!errors.phone || validationStatus.phone === 'taken', phoneSuccess), width: '100%', boxSizing: 'border-box', borderColor: errors.phone || validationStatus.phone === 'taken' ? '#e05252' : phoneSuccess ? '#5aba8a' : focused === 'phone' ? 'rgba(184,149,106,0.5)' : 'rgba(255,255,255,0.08)' }} />
                        </div>
                        <VerifyBtn status={verificationStatus.phone} onClick={() => onVerify('phone')} />
                    </div>
                    <ErrMsg msg={errors.phone} />
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '5px' }}>
                        Select country code. E.g. India (+91) requires 10 digits.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Step2AdministratorForm;
