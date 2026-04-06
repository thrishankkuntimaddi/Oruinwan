// CookieSettings.jsx — Monolith Flow Design System
import React, { useState } from 'react';
import PublicPageShell from '../../components/layout/PublicPageShell';
import { Cookie, Shield, BarChart2, Settings, CheckCircle2 } from 'lucide-react';

const COOKIE_TYPES = [
    {
        id: 'essential',
        icon: Shield,
        color: '#5aba8a',
        title: 'Essential Cookies',
        desc: 'Required for the platform to function. These cannot be disabled. They handle authentication, session management, and core security features.',
        examples: ['Session token', 'CSRF protection', 'Auth state persistence'],
        required: true,
    },
    {
        id: 'analytics',
        icon: BarChart2,
        color: '#6ea8fe',
        title: 'Analytics Cookies',
        desc: 'Help us understand how users interact with Chttrix so we can improve the product. All data is anonymized and aggregated.',
        examples: ['Page view counts', 'Feature usage heatmaps', 'Error frequency tracking'],
        required: false,
    },
    {
        id: 'preferences',
        icon: Settings,
        color: '#b8956a',
        title: 'Preference Cookies',
        desc: 'Remember your UI preferences across sessions — like sidebar state, notification settings, and display density.',
        examples: ['Sidebar collapsed state', 'Notification preferences', 'Last visited workspace'],
        required: false,
    },
];

export default function CookieSettings() {
    const [prefs, setPrefs] = useState({ analytics: true, preferences: true });
    const [saved, setSaved] = useState(false);

    const toggle = (id) => {
        setPrefs(p => ({ ...p, [id]: !p[id] }));
        setSaved(false);
    };

    const save = () => {
        // Persist to localStorage
        localStorage.setItem('chttrix_cookie_prefs', JSON.stringify(prefs));
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    return (
        <PublicPageShell title="Cookie Settings">
            <div style={{ maxWidth: '760px', margin: '0 auto', padding: '64px 24px' }}>
                {/* Header */}
                <div style={{ marginBottom: '48px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', border: '1px solid rgba(184,149,106,0.3)', background: 'rgba(184,149,106,0.07)', marginBottom: '20px' }}>
                        <Cookie size={11} style={{ color: '#b8956a' }} />
                        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#b8956a' }}>Cookie Settings</span>
                    </div>
                    <h1 style={{ fontSize: '36px', fontWeight: 700, color: '#e4e4e4', letterSpacing: '-0.03em', marginBottom: '12px' }}>Manage your cookie preferences.</h1>
                    <p style={{ fontSize: '15px', color: 'rgba(228,228,228,0.5)', lineHeight: '1.75' }}>
                        We use cookies to keep you signed in and to understand how you use Chttrix. You're in control of everything except essential, security-required cookies.
                    </p>
                </div>

                {/* Cookie Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'rgba(255,255,255,0.05)', marginBottom: '32px' }}>
                    {COOKIE_TYPES.map(c => {
                        const Icon = c.icon;
                        const isOn = c.required || prefs[c.id];
                        return (
                            <div key={c.id} style={{ background: '#111', padding: '28px 24px', position: 'relative' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                            <div style={{ width: '34px', height: '34px', background: `${c.color}14`, border: `1px solid ${c.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <Icon size={16} style={{ color: c.color }} />
                                            </div>
                                            <div>
                                                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#e4e4e4', letterSpacing: '-0.01em' }}>{c.title}</h3>
                                                {c.required && <span style={{ fontSize: '10px', fontWeight: 700, color: '#5aba8a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Always Active</span>}
                                            </div>
                                        </div>
                                        <p style={{ fontSize: '13px', color: 'rgba(228,228,228,0.5)', lineHeight: '1.75', marginBottom: '14px' }}>{c.desc}</p>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                            {c.examples.map(e => (
                                                <span key={e} style={{ padding: '3px 8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', fontSize: '11px', color: 'rgba(228,228,228,0.4)', fontFamily: 'monospace' }}>{e}</span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Toggle */}
                                    <button onClick={() => !c.required && toggle(c.id)}
                                        disabled={c.required}
                                        style={{ width: '44px', height: '24px', borderRadius: '12px', background: isOn ? c.color : 'rgba(255,255,255,0.1)', border: 'none', cursor: c.required ? 'default' : 'pointer', position: 'relative', transition: 'background 200ms ease', flexShrink: 0, marginTop: '4px' }}>
                                        <span style={{ position: 'absolute', top: '3px', left: isOn ? '22px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', transition: 'left 200ms ease', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Save button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button onClick={save}
                        style={{ padding: '10px 28px', background: '#b8956a', border: 'none', color: '#0c0c0c', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 150ms ease' }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                        Save Preferences
                    </button>
                    {saved && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#5aba8a', fontWeight: 600 }}>
                            <CheckCircle2 size={14} /> Saved successfully
                        </div>
                    )}
                </div>

                <p style={{ fontSize: '12px', color: 'rgba(228,228,228,0.25)', marginTop: '28px', lineHeight: '1.7' }}>
                    For more details on how we use cookies and process your data, see our <button onClick={() => (window.location.href = '/privacy')} style={{ background: 'none', border: 'none', color: '#b8956a', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit', padding: 0 }}>Privacy Policy</button>. Cookie preferences are stored locally and will be remembered across sessions on this device.
                </p>
            </div>
        </PublicPageShell>
    );
}
