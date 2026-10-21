import { useId, useState } from 'react';
import { ArrowLeft, ArrowRight, Building2 } from 'lucide-react';
import api from '@services/api';
import { useFlag } from '../../contexts/FeatureFlagsContext';
import { IS_APP } from '../../appMode/env';
import { getDeviceId } from '../../utils/deviceId';

/** A full work email ("ada@acme.com"), trimmed and lower-cased, or null. Discovery needs the whole address. */
export function workEmail(value) {
    const v = String(value || '').trim().toLowerCase();
    return /^[^\s@]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(v) ? v : null;
}

/** "ada@acme.com" or "acme.com" → "acme.com"; null when neither. */
export function workDomain(value) {
    const v = String(value || '').trim().toLowerCase();
    const domain = v.includes('@') ? v.split('@').pop() : v;
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) ? domain : null;
}

/**
 * Where to send the browser for an SSO start URL: the server's startUrl plus the
 * device id, so the sign-in appears under Settings → Devices.
 */
export function ssoStartWithDevice(startUrl, deviceId) {
    if (!startUrl) return null;
    if (!deviceId) return startUrl;
    const sep = startUrl.includes('?') ? '&' : '?';
    return `${startUrl}${sep}deviceId=${encodeURIComponent(deviceId)}`;
}

/**
 * GET /api/auth/sso/discover?email= → 'disabled' (SSO feature off: 404), 'none'
 * (no SSO for this domain), 'error', or { protocol, startUrl }.
 */
export async function discoverSso(email, client = api) {
    try {
        const { data } = await client.get('/api/auth/sso/discover', { params: { email } });
        if (data?.enabled && typeof data.startUrl === 'string' && /^https?:\/\//.test(data.startUrl)) {
            return { protocol: data.protocol === 'saml' ? 'saml' : 'oidc', startUrl: data.startUrl };
        }
        return 'none';
    } catch (err) {
        if (err?.response?.status === 404) return 'disabled';
        return 'error';
    }
}

const ERRORS = {
    sso_state_mismatch: 'Your SSO sign-in expired before it finished. Please try again.',
    sso_no_email: 'Your identity provider did not share an email address, so we could not sign you in.',
    unknown_provider: 'That SSO provider is not supported.',
    sso_saml_not_configured: 'Single sign-on isn’t set up for your company yet. Ask your admin.',
    sso_saml_no_email: 'Your identity provider did not share an email address, so we could not sign you in.',
    sso_saml_no_name_id: 'Your identity provider did not identify you, so we could not sign you in.',
    sso_saml_wrong_issuer: 'The sign-in came from an identity provider your company hasn’t configured. Ask your admin.',
    sso_saml_wrong_company: 'Your account belongs to a different company on Oruinwan.',
    sso_saml_no_account: 'There is no Oruinwan account for you in this company yet. Ask your admin to invite you.',
    sso_saml_account_disabled: 'Your Oruinwan account is disabled. Ask your admin.',
    sso_saml_invalid_response: 'Your identity provider’s answer could not be verified. Please try again.',
};

/** Message for ?error= on /login after an SSO round trip, or null for other errors. */
export function ssoErrorMessage(code) {
    if (!code || !/^sso_|^unknown_provider$/.test(code)) return null;
    return ERRORS[code] || 'Single sign-on did not complete. Try again, or sign in with your email and password.';
}

const PROTOCOL_LABEL = { saml: 'SAML', oidc: 'OpenID Connect' };

/**
 * "Sign in with your company SSO" on the login page. Only shown when the server has the
 * `sso` feature on (and never in the desktop/Android apps, where the round trip would
 * land in a browser). The user enters a work email; the server says whether that
 * company uses SSO (SAML or OIDC) and where to start, and the browser goes there as a
 * full page navigation.
 */
export default function SsoSignIn({
    initialEmail = '',
    navigateTo = (url) => window.location.assign(url),
    discover = discoverSso,
    deviceId = getDeviceId,
}) {
    const enabled = useFlag('sso');
    const uid = useId();
    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState(initialEmail);
    const [state, setState] = useState({ status: 'idle', protocol: null }); // idle | checking | redirecting | none | hidden
    const [error, setError] = useState('');

    if (!enabled || IS_APP || state.status === 'hidden') return null;

    const check = async (e) => {
        e.preventDefault();
        const addr = workEmail(email);
        if (!addr) { setError('Enter your full work email, like you@company.com.'); return; }
        setError('');
        setState({ status: 'checking', protocol: null });
        const found = await discover(addr);
        if (found === 'disabled') { setState({ status: 'hidden', protocol: null }); return; }
        if (found === 'error') {
            setState({ status: 'idle', protocol: null });
            setError('We couldn’t check single sign-on right now. Try again in a moment.');
            return;
        }
        if (found === 'none') { setState({ status: 'none', protocol: null }); return; }
        try { sessionStorage.setItem('ssoEmailHint', addr); } catch { /* private mode */ }
        let id = null;
        try { id = typeof deviceId === 'function' ? deviceId() : deviceId; } catch { /* storage blocked */ }
        setState({ status: 'redirecting', protocol: found.protocol });
        navigateTo(ssoStartWithDevice(found.startUrl, id));
    };

    if (!open) {
        return (
            <button type="button" className="orw-btn orw-btn--ghost orw-btn--lg orw-btn--block" style={{ marginTop: 10 }}
                onClick={() => setOpen(true)} data-testid="sign-in-with-sso">
                <Building2 size={15} /> Sign in with your company SSO
            </button>
        );
    }

    const busy = state.status === 'checking' || state.status === 'redirecting';
    const hint = error || (state.status === 'none'
        ? 'Single sign-on isn’t set up for your company on Oruinwan yet. Ask your admin, or sign in with your email and password.'
        : state.status === 'redirecting'
            ? `Taking you to your company’s sign-in page (${PROTOCOL_LABEL[state.protocol] || 'SSO'})…`
            : 'We’ll send you to your company’s sign-in page.');
    const isAlert = !!error || state.status === 'none';

    return (
        <div data-testid="sso-panel" style={{ marginTop: 14 }}>
            <form onSubmit={check} className="orw-form" noValidate>
                <div className="orw-field">
                    <label className="orw-label" htmlFor={`${uid}-sso`}>Work email</label>
                    <input id={`${uid}-sso`} className="orw-input" type="email" value={email} autoFocus autoComplete="email"
                        placeholder="you@company.com" onChange={e => { setEmail(e.target.value); setError(''); if (state.status === 'none') setState({ status: 'idle', protocol: null }); }}
                        aria-invalid={error ? 'true' : undefined} aria-describedby={`${uid}-sso-help`} />
                    <div id={`${uid}-sso-help`} className={isAlert ? 'orw-error-text' : 'orw-hint'} role={isAlert ? 'alert' : (state.status === 'redirecting' ? 'status' : undefined)}>
                        {hint}
                    </div>
                </div>
                <button type="submit" className="orw-btn orw-btn--primary orw-btn--lg orw-btn--block" disabled={busy} aria-busy={busy}>
                    {busy ? (state.status === 'redirecting' ? 'Redirecting…' : 'Checking…') : <>Continue with SSO <ArrowRight size={15} /></>}
                </button>
            </form>
            <button type="button" className="orw-link" style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                onClick={() => { setOpen(false); setState({ status: 'idle', protocol: null }); setError(''); }}>
                <ArrowLeft size={13} /> Back to other sign-in options
            </button>
        </div>
    );
}
