import React, { useState } from 'react';
import { Shield, Lock, AlertTriangle, Save } from 'lucide-react';
import { useToast } from '../../../../contexts/ToastContext';

const inputSt = {
    width: '100%', padding: '10px 12px',
    background: 'var(--bg-input)', border: '1px solid var(--border-default)',
    color: 'var(--text-primary)', fontSize: '13px',
    outline: 'none', fontFamily: 'Inter, system-ui, sans-serif',
    boxSizing: 'border-box'
};

const Security = () => {
    const { showToast } = useToast();
    const [settings, setSettings] = useState({
        passwordPolicy: 'medium',
        twoFactorAuth: false,
        sessionTimeout: '30',
        ipWhitelist: false
    });

    const handleSave = () => showToast('Security settings saved', 'success');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
            <div>
                <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.015em', marginBottom: '4px' }}>Security</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Protect your company account</p>
            </div>

            {}
            <div style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <Lock size={14} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Password Policy</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                        <FieldLabel text="Required Password Strength" />
                        <select
                            value={settings.passwordPolicy}
                            onChange={e => setSettings(p => ({ ...p, passwordPolicy: e.target.value }))}
                            style={inputSt}
                        >
                            <option value="weak">Weak (minimum 6 characters)</option>
                            <option value="medium">Medium (8+ chars, uppercase, number)</option>
                            <option value="strong">Strong (12+ chars, uppercase, number, special)</option>
                        </select>
                    </div>

                    <ToggleRow
                        label="Two-Factor Authentication"
                        desc="Require 2FA for all users"
                        checked={settings.twoFactorAuth}
                        onChange={v => setSettings(p => ({ ...p, twoFactorAuth: v }))}
                    />

                    <div>
                        <FieldLabel text="Session Timeout (minutes)" />
                        <input
                            type="number" min="5" max="1440"
                            value={settings.sessionTimeout}
                            onChange={e => setSettings(p => ({ ...p, sessionTimeout: e.target.value }))}
                            style={{ ...inputSt, width: '140px' }}
                        />
                    </div>
                </div>
            </div>

            {}
            <div style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <Shield size={14} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>IP Whitelist</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', padding: '14px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <AlertTriangle size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '2px' }} />
                        <div>
                            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '2px' }}>Enable IP Restrictions</p>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Only allow access from specific IP addresses</p>
                        </div>
                    </div>
                    <Toggle checked={settings.ipWhitelist} onChange={v => setSettings(p => ({ ...p, ipWhitelist: v }))} />
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <SaveBtn onClick={handleSave} />
            </div>
        </div>
    );
};

const ToggleRow = ({ label, desc, checked, onChange }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', background: 'var(--bg-active)', border: '1px solid var(--border-subtle)' }}>
        <div>
            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '2px' }}>{label}</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{desc}</p>
        </div>
        <Toggle checked={checked} onChange={onChange} />
    </div>
);

const Toggle = ({ checked, onChange }) => (
    <button
        type="button"
        onClick={() => onChange(!checked)}
        style={{
            width: '40px', height: '22px', borderRadius: '11px', flexShrink: 0,
            background: checked ? 'var(--accent)' : 'var(--border-accent)',
            border: 'none', cursor: 'pointer', position: 'relative',
            transition: 'background 200ms ease'
        }}
    >
        <span style={{
            position: 'absolute', top: '3px',
            left: checked ? '21px' : '3px',
            width: '16px', height: '16px', borderRadius: '50%',
            background: checked ? 'var(--bg-base)' : 'var(--text-muted)',
            transition: 'left 200ms ease'
        }} />
    </button>
);

const FieldLabel = ({ text }) => (
    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>{text}</label>
);

const SaveBtn = ({ onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: hov ? 'var(--accent-hover)' : 'var(--accent)', border: 'none', color: 'var(--bg-base)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', borderRadius: '2px', transition: 'background 150ms ease' }}>
            <Save size={14} /> Save Changes
        </button>
    );
};

export default Security;
