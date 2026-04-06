import React, { useState } from 'react';
import { CheckCircle, Copy, Save, AlertCircle } from 'lucide-react';
import { useCompany } from '../../../../contexts/CompanyContext';
import { useToast } from '../../../../contexts/ToastContext';

const DomainSSO = () => {
    const { company } = useCompany();
    const { showToast } = useToast();
    const [settings, setSettings] = useState({ autoJoin: false, ssoEnabled: false, ssoProvider: 'saml' });
    const verificationCode = 'chttrix-verify-abc123';

    const handleCopy = () => {
        navigator.clipboard.writeText(verificationCode);
        showToast('Verification code copied', 'success');
    };
    const handleSave = () => showToast('Domain & SSO settings saved', 'success');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
            <div>
                <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.015em', marginBottom: '4px' }}>Domain & SSO</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Manage domain verification and single sign-on</p>
            </div>

            {/* Domain Verification */}
            <div style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', padding: '20px' }}>
                <SectionHeader text="Domain Verification" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', background: 'var(--bg-active)', border: '1px solid var(--border-subtle)' }}>
                        <div>
                            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '2px' }}>{company?.domain || 'company.com'}</p>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Company domain</p>
                        </div>
                        {company?.domainVerified ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--state-success)' }}>
                                <CheckCircle size={14} /> Verified
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>
                                <AlertCircle size={14} /> Not Verified
                            </div>
                        )}
                    </div>

                    {!company?.domainVerified && (
                        <div style={{ padding: '14px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)' }}>
                            <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                                Add this TXT record to your DNS:
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-default)' }}>
                                <code style={{ flex: 1, fontSize: '12px', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                                    {verificationCode}
                                </code>
                                <CopyBtn onClick={handleCopy} />
                            </div>
                        </div>
                    )}

                    <ToggleRow
                        label="Auto-join by Email Domain"
                        desc={`Allow users with @${company?.domain || 'company.com'} to join automatically`}
                        checked={settings.autoJoin}
                        disabled={!company?.domainVerified}
                        onChange={v => setSettings(p => ({ ...p, autoJoin: v }))}
                    />
                </div>
            </div>

            {/* SSO Configuration */}
            <div style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', padding: '20px' }}>
                <SectionHeader text="Single Sign-On (SSO)" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <ToggleRow
                        label="Enable SSO"
                        desc="Allow sign-in via identity provider"
                        checked={settings.ssoEnabled}
                        onChange={v => setSettings(p => ({ ...p, ssoEnabled: v }))}
                    />

                    {settings.ssoEnabled && (
                        <>
                            <div>
                                <FieldLabel text="SSO Provider" />
                                <select
                                    value={settings.ssoProvider}
                                    onChange={e => setSettings(p => ({ ...p, ssoProvider: e.target.value }))}
                                    style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }}
                                >
                                    <option value="saml">SAML 2.0</option>
                                    <option value="oauth">OAuth 2.0</option>
                                    <option value="oidc">OpenID Connect</option>
                                </select>
                            </div>
                            <div style={{ padding: '12px 14px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                                <strong style={{ color: 'var(--text-primary)' }}>Note:</strong> SSO configuration requires additional setup with your identity provider. Contact support for assistance.
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <SaveBtn onClick={handleSave} />
            </div>
        </div>
    );
};

const SectionHeader = ({ text }) => (
    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', paddingBottom: '12px', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)' }}>{text}</div>
);

const FieldLabel = ({ text }) => (
    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>{text}</label>
);

const ToggleRow = ({ label, desc, checked, disabled, onChange }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '14px', background: 'var(--bg-active)', border: '1px solid var(--border-subtle)', opacity: disabled ? 0.5 : 1 }}>
        <div>
            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '2px' }}>{label}</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{desc}</p>
        </div>
        <button
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onChange(!checked)}
            style={{ width: '40px', height: '22px', borderRadius: '11px', flexShrink: 0, background: checked ? 'var(--accent)' : 'var(--border-accent)', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', position: 'relative', transition: 'background 200ms ease' }}
        >
            <span style={{ position: 'absolute', top: '3px', left: checked ? '21px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: checked ? 'var(--bg-base)' : 'var(--text-muted)', transition: 'left 200ms ease' }} />
        </button>
    </div>
);

const CopyBtn = ({ onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ padding: '6px', background: hov ? 'var(--bg-hover)' : 'transparent', border: 'none', color: hov ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 150ms ease', borderRadius: '2px' }}>
            <Copy size={14} />
        </button>
    );
};

const SaveBtn = ({ onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: hov ? 'var(--accent-hover)' : 'var(--accent)', border: 'none', color: 'var(--bg-base)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', borderRadius: '2px', transition: 'background 150ms ease' }}>
            <Save size={14} /> Save Changes
        </button>
    );
};

export default DomainSSO;
