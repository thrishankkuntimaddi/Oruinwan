import { useId, useState } from 'react';
import { ArrowLeft, ArrowRight, Building2 } from 'lucide-react';
import api from '@services/api';
import { useFlag } from '../../contexts/FeatureFlagsContext';
import { IS_APP } from '../../appMode/env';

// The identity providers server/src/features/security/sso.routes.js knows.
export const SSO_PROVIDERS = [
    { id: 'google', label: 'Google Workspace' },
    { id: 'microsoft', label: 'Microsoft Entra ID' },
    { id: 'okta', label: 'Okta' },
];

const apiBase = () => api?.defaults?.baseURL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
export const ssoStartUrl = (provider) => `${apiBase().replace(/\/$/, '')}/api/auth/sso/${provider}`;

/** "ada@acme.com" or "acme.com" → "acme.com"; null when neither. */
export function workDomain(value) {
    const v = String(value || '').trim().toLowerCase();
    const domain = v.includes('@') ? v.split('@').pop() : v;
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) ? domain : null;
}

/** Providers a company on this domain most likely uses, first. */
export function rankProviders(providers, domain) {
    const hint = /(gmail|googlemail|google)\./.test(domain || '') ? 'google'
        : /(outlook|hotmail|live|microsoft|onmicrosoft)\./.test(domain || '') ? 'microsoft' : null;
    return hint ? [...providers].sort((a, b) => (b.id === hint) - (a.id === hint)) : providers;
}

/**
 * Ask the server whether a provider is set up, without leaving the page: a configured
 * provider answers with a redirect to the identity provider, an unconfigured one with
 * 501 and a disabled SSO feature with 404.
 * -> 'ready' | 'unconfigured' | 'disabled' | 'error'
 */
export async function probeSsoProvider(provider, fetchImpl = globalThis.fetch) {
    try {
        const res = await fetchImpl(ssoStartUrl(provider), { method: 'GET', redirect: 'manual', credentials: 'include' });
        if (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400)) return 'ready';
        if (res.status === 404) return 'disabled';
        if (res.status === 501 || res.status === 400) return 'unconfigured';
        return res.ok ? 'ready' : 'error';
    } catch {
        return 'error';
    }
}

const ERRORS = {
    sso_state_mismatch: 'Your SSO sign-in expired before it finished. Please try again.',
    sso_no_email: 'Your identity provider did not share an email address, so we could not sign you in.',
    unknown_provider: 'That SSO provider is not supported.',
};

/** Message for ?error= on /login after an SSO round trip, or null for other errors. */
export function ssoErrorMessage(code) {
    if (!code || !/^sso_|^unknown_provider$/.test(code)) return null;
    return ERRORS[code] || 'Single sign-on did not complete. Try again, or sign in with your email and password.';
}

/**
 * "Sign in with your company SSO" on the login page. Only shown when the server has the
 * `sso` feature on (and never in the desktop/Android apps, where the round trip would
 * land in a browser). Enter a work email or domain, then the providers set up on this
 * server are offered; picking one starts /api/auth/sso/:provider.
 */
export default function SsoSignIn({ initialEmail = '', navigateTo = (url) => window.location.assign(url), probe = probeSsoProvider }) {
    const enabled = useFlag('sso');
    const uid = useId();
    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState(initialEmail);
    const [state, setState] = useState({ status: 'idle', providers: [], domain: null }); // idle | checking | ready | none | hidden
    const [error, setError] = useState('');

    if (!enabled || IS_APP || state.status === 'hidden') return null;

    const check = async (e) => {
        e.preventDefault();
        const domain = workDomain(email);
        if (!domain) { setError('Enter your work email, like you@company.com, or your company domain.'); return; }
        setError('');
        setState({ status: 'checking', providers: [], domain });
        const results = await Promise.all(SSO_PROVIDERS.map(async (p) => ({ ...p, status: await probe(p.id) })));
        if (results.every(r => r.status === 'disabled')) { setState({ status: 'hidden', providers: [], domain }); return; }
        const ready = rankProviders(results.filter(r => r.status === 'ready'), domain);
        try { sessionStorage.setItem('ssoEmailHint', email.trim()); } catch { /* private mode */ }
        if (ready.length === 1) { navigateTo(ssoStartUrl(ready[0].id)); setState({ status: 'ready', providers: ready, domain }); return; }
        setState({ status: ready.length ? 'ready' : 'none', providers: ready, domain });
    };

    if (!open) {
        return (
            <button type="button" className="orw-btn orw-btn--ghost orw-btn--lg orw-btn--block" style={{ marginTop: 10 }}
                onClick={() => setOpen(true)} data-testid="sign-in-with-sso">
                <Building2 size={15} /> Sign in with your company SSO
            </button>
        );
    }

    return (
        <div data-testid="sso-panel" style={{ marginTop: 14 }}>
            {state.status !== 'ready' ? (
                <form onSubmit={check} className="orw-form">
                    <div className="orw-field">
                        <label className="orw-label" htmlFor={`${uid}-sso`}>Work email or company domain</label>
                        <input id={`${uid}-sso`} className="orw-input" value={email} autoFocus autoComplete="email"
                            placeholder="you@company.com" onChange={e => { setEmail(e.target.value); setError(''); }}
                            aria-invalid={error ? 'true' : undefined} aria-describedby={`${uid}-sso-help`} />
                        <div id={`${uid}-sso-help`} className={error || state.status === 'none' ? 'orw-error-text' : 'orw-hint'}
                            role={error || state.status === 'none' ? 'alert' : undefined}>
                            {error || (state.status === 'none'
                                ? 'Single sign-on isn’t set up for your company on Oruinwan yet. Ask your admin, or sign in with your email and password.'
                                : 'We’ll send you to your company’s sign-in page.')}
                        </div>
                    </div>
                    <button type="submit" className="orw-btn orw-btn--primary orw-btn--lg orw-btn--block"
                        disabled={state.status === 'checking'} aria-busy={state.status === 'checking'}>
                        {state.status === 'checking' ? 'Checking…' : <>Continue with SSO <ArrowRight size={15} /></>}
                    </button>
                </form>
            ) : (
                <div className="orw-form" role="group" aria-label="Choose your identity provider">
                    <p className="orw-hint" style={{ margin: 0 }}>Choose how <strong>{state.domain}</strong> signs in:</p>
                    {state.providers.map(p => (
                        <button key={p.id} type="button" className="orw-btn orw-btn--ghost orw-btn--lg orw-btn--block"
                            onClick={() => navigateTo(ssoStartUrl(p.id))}>
                            {p.label}
                        </button>
                    ))}
                </div>
            )}
            <button type="button" className="orw-link" style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                onClick={() => { setOpen(false); setState({ status: 'idle', providers: [], domain: null }); setError(''); }}>
                <ArrowLeft size={13} /> Back to other sign-in options
            </button>
        </div>
    );
}
