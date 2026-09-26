import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie } from 'lucide-react';
import PublicPageShell from '../../components/layout/PublicPageShell';
import { PageHero, Block } from '../../components/public/PublicKit';
import BRAND from '../../shared/brand';

// Stored user data: keep this key and the { analytics, preferences } shape.
const STORAGE_KEY = 'chttrix_cookie_prefs';
const DEFAULT_PREFS = { analytics: true, preferences: true };

const COOKIE_TYPES = [
    {
        id: 'essential',
        title: 'Essential Cookies',
        desc: 'Required for the platform to function. These cannot be disabled. They handle authentication, session management, and core security features.',
        examples: ['Session token', 'CSRF protection', 'Auth state persistence'],
        required: true,
    },
    {
        id: 'analytics',
        title: 'Analytics Cookies',
        desc: `Help us understand how users interact with ${BRAND.name} so we can improve the product. All data is anonymized and aggregated.`,
        examples: ['Page view counts', 'Feature usage heatmaps', 'Error frequency tracking'],
        required: false,
    },
    {
        id: 'preferences',
        title: 'Preference Cookies',
        desc: 'Remember your UI preferences across sessions — like sidebar state, notification settings, and display density.',
        examples: ['Sidebar collapsed state', 'Notification preferences', 'Last visited workspace'],
        required: false,
    },
];

function loadPrefs() {
    try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (raw && typeof raw === 'object') {
            return {
                analytics: typeof raw.analytics === 'boolean' ? raw.analytics : DEFAULT_PREFS.analytics,
                preferences: typeof raw.preferences === 'boolean' ? raw.preferences : DEFAULT_PREFS.preferences,
            };
        }
    } catch { /* storage blocked or malformed: fall back to defaults */ }
    return DEFAULT_PREFS;
}

export default function CookieSettings() {
    const [prefs, setPrefs] = useState(loadPrefs);
    const [saved, setSaved] = useState(false);
    const timer = useRef(null);

    useEffect(() => () => clearTimeout(timer.current), []);

    const toggle = (id) => {
        setPrefs(p => ({ ...p, [id]: !p[id] }));
        setSaved(false);
    };

    const persist = (next) => {
        setPrefs(next);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch { /* storage unavailable: preferences apply for this visit only */ }
        setSaved(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setSaved(false), 3000);
    };

    return (
        <PublicPageShell title="Cookie Settings">
            <PageHero
                crumb="Cookie settings"
                eyebrow="Cookie Settings"
                icon={Cookie}
                title={<>Manage your <span className="orw-gloss-text">cookie preferences.</span></>}
                lead={`We use cookies to keep you signed in and to understand how you use ${BRAND.name}. You’re in control of everything except essential, security-required cookies.`}
            />

            <Block eyebrow="Categories" title="Choose what we store.">
                <div className="orw-rows" data-reveal style={{ maxWidth: 860 }}>
                    {COOKIE_TYPES.map(c => {
                        const isOn = c.required || prefs[c.id];
                        return (
                            <div key={c.id} className="orw-row">
                                <div>
                                    <h3 id={`cookie-${c.id}-title`}>{c.title}</h3>
                                    <p id={`cookie-${c.id}-desc`}>{c.desc}</p>
                                    <div className="orw-row__meta">
                                        {c.required && <span className="orw-tag orw-tag--good">Always active</span>}
                                        {c.examples.map(e => <span key={e} className="orw-tag">{e}</span>)}
                                    </div>
                                </div>
                                <button type="button" role="switch" className="orw-switch"
                                    aria-checked={isOn} aria-labelledby={`cookie-${c.id}-title`} aria-describedby={`cookie-${c.id}-desc`}
                                    disabled={c.required} onClick={() => !c.required && toggle(c.id)} />
                            </div>
                        );
                    })}
                </div>

                <div data-reveal style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 32 }}>
                    <button type="button" className="orw-btn orw-btn--primary" onClick={() => persist(prefs)}>Save preferences</button>
                    <button type="button" className="orw-btn orw-btn--ghost" onClick={() => persist({ analytics: true, preferences: true })}>Accept all</button>
                    <button type="button" className="orw-btn orw-btn--ghost" onClick={() => persist({ analytics: false, preferences: false })}>Reject non-essential</button>
                    <span role="status" aria-live="polite" className="orw-status orw-status--ok" style={{ visibility: saved ? 'visible' : 'hidden' }}>
                        {saved ? 'Saved successfully' : ''}
                    </span>
                </div>

                <p className="orw-hint" style={{ marginTop: 28, maxWidth: 640 }}>
                    For more details on how we use cookies and process your data, see our <Link className="orw-link" to="/privacy">Privacy Policy</Link>. Cookie preferences are stored locally and will be remembered across sessions on this device.
                </p>
            </Block>
        </PublicPageShell>
    );
}
