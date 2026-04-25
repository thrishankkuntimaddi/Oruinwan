import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, Info, AlertCircle } from 'lucide-react';

const PWD_RULES = [
    { label: '8–16 characters',    test: p => p.length >= 8 && p.length <= 16 },
    { label: 'Uppercase letter',   test: p => /[A-Z]/.test(p) },
    { label: 'Lowercase letter',   test: p => /[a-z]/.test(p) },
    { label: 'Number',             test: p => /\d/.test(p) },
    { label: 'Special char',       test: p => /[@$!%*?&]/.test(p) },
    { label: 'No spaces',          test: p => !/\s/.test(p) },
];

const inp = (err) => ({
    width: '100%', boxSizing: 'border-box', padding: '10px 36px 10px 40px',
    background: 'var(--bg-input)',
    border: `1px solid ${err ? '#e05252' : 'rgba(255,255,255,0.08)'}`,
    color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
    fontFamily: 'Inter, system-ui, sans-serif', transition: 'border-color 150ms ease',
});

const Label = ({ children }) => (
    <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
        {children}
    </label>
);

const Step3AccountForm = ({
    formData, onChange, errors,
    showPassword, showConfirmPassword,
    onTogglePassword, onToggleConfirmPassword, theme,
}) => {
    const [focused, setFocused] = useState(null);
    const pwdRules = PWD_RULES.map(r => ({ ...r, met: r.test(formData.password) }));

    return (
        <div style={{ maxWidth: '560px', margin: '0 auto' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '32px' }}>
                Create your official company login.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {}
                <div>
                    <Label>Company Email</Label>
                    <div style={{ position: 'relative' }}>
                        <Mail size={13} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                        <input name="companyEmail" type="email" value={formData.companyEmail} onChange={onChange}
                            placeholder={`name@${formData.companyDomain || 'company.com'}`}
                            onFocus={() => setFocused('companyEmail')} onBlur={() => setFocused(null)}
                            style={{ ...inp(!!errors.companyEmail), borderColor: errors.companyEmail ? '#e05252' : focused === 'companyEmail' ? 'rgba(184,149,106,0.5)' : 'rgba(255,255,255,0.08)', paddingRight: '12px' }} />
                    </div>
                    {errors.companyEmail && <p style={{ fontSize: '11px', color: '#e05252', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={11} />{errors.companyEmail}</p>}
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '5px' }}>
                        Must match domain: <span style={{ color: '#b8956a', fontWeight: 600 }}>@{formData.companyDomain || 'not set'}</span>
                    </p>
                </div>

                {}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {}
                    <div>
                        <Label>Password</Label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={13} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                            <input type={showPassword ? 'text' : 'password'} name="password" value={formData.password} onChange={onChange} placeholder="••••••••"
                                onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
                                style={{ ...inp(!!errors.password), borderColor: errors.password ? '#e05252' : focused === 'password' ? 'rgba(184,149,106,0.5)' : 'rgba(255,255,255,0.08)' }} />
                            <button type="button" onClick={onTogglePassword}
                                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
                                {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                        </div>
                        {errors.password && <p style={{ fontSize: '11px', color: '#e05252', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={11} />{errors.password}</p>}
                    </div>

                    {}
                    <div>
                        <Label>Confirm Password</Label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={13} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                            <input type={showConfirmPassword ? 'text' : 'password'} name="confirmPassword" value={formData.confirmPassword} onChange={onChange} placeholder="••••••••"
                                onFocus={() => setFocused('confirmPassword')} onBlur={() => setFocused(null)}
                                style={{ ...inp(!!errors.confirmPassword), borderColor: errors.confirmPassword ? '#e05252' : focused === 'confirmPassword' ? 'rgba(184,149,106,0.5)' : 'rgba(255,255,255,0.08)' }} />
                            <button type="button" onClick={onToggleConfirmPassword}
                                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
                                {showConfirmPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                        </div>
                        {errors.confirmPassword && <p style={{ fontSize: '11px', color: '#e05252', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={11} />{errors.confirmPassword}</p>}
                    </div>
                </div>

                {}
                {formData.password.length > 0 && (
                    <div style={{ padding: '12px 14px', background: 'rgba(184,149,106,0.04)', border: '1px solid rgba(184,149,106,0.1)' }}>
                        <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>Password requirements</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {pwdRules.map(r => (
                                <span key={r.label} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: r.met ? '#5aba8a' : 'rgba(228,228,228,0.3)', fontWeight: 600 }}>
                                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: r.met ? '#5aba8a' : 'rgba(255,255,255,0.12)', flexShrink: 0 }} />
                                    {r.label}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Step3AccountForm;
