import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Eye, EyeOff, ShieldCheck, X } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';
import useFreshUser from './account/useFreshUser';
import {
    Badge, Button, ErrorState, Field, IconButton, Input, LoadingState, Notice, PageIntro, Row, Section, errorMessage,
} from './settingsUi';
import './account/account.css';

/* ── Password ──────────────────────────────────────────────────────────── */

// The first four are what the server requires; lowercase only adds strength.
const CHECKS = [
    ['length', '8+ characters', (p) => p.length >= 8, true],
    ['upper', 'Uppercase', (p) => /[A-Z]/.test(p), true],
    ['number', 'Number', (p) => /\d/.test(p), true],
    ['symbol', 'Symbol', (p) => /[^A-Za-z0-9]/.test(p), true],
    ['lower', 'Lowercase', (p) => /[a-z]/.test(p), false],
];
const STRENGTH = ['', 'Weak', 'Weak', 'Fair', 'Good', 'Strong'];

const passwordState = (p) => {
    const results = CHECKS.map(([key, label, test, required]) => ({ key, label, ok: !!p && test(p), required }));
    const score = results.filter((r) => r.ok).length;
    return { results, score, meetsRules: results.every((r) => !r.required || r.ok) };
};

/** Password input with a show/hide toggle. Module-level so typing never remounts it. */
function PasswordField({ id, label, value, onChange, error, hint, autoComplete, autoFocus }) {
    const [visible, setVisible] = useState(false);
    return (
        <Field id={id} label={label} error={error} hint={hint}>
            <div className="stg-input-wrap">
                <Input
                    id={id}
                    type={visible ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    autoComplete={autoComplete}
                    autoFocus={autoFocus}
                    invalid={!!error}
                    spellCheck={false}
                />
                <span className="stg-input-affix">
                    <IconButton label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible((v) => !v)}>
                        {visible ? <EyeOff size={14} /> : <Eye size={14} />}
                    </IconButton>
                </span>
            </div>
        </Field>
    );
}

function StrengthMeter({ password }) {
    const { results, score } = passwordState(password);
    if (!password) return null;
    return (
        <div className="stg-acc-stack stg-acc-tight">
            <div className="stg-acc-hint-row">
                <span>Strength</span>
                <span className="stg-acc-counter">{STRENGTH[score]}</span>
            </div>
            <div className="stg-acc-meter" data-score={score} aria-hidden="true"><span /><span /><span /><span /><span /></div>
            <ul className="stg-acc-checks" aria-label="Password requirements">
                {results.map((r) => (
                    <li key={r.key} data-ok={r.ok ? 'true' : undefined}>
                        {r.ok ? <Check size={11} /> : <X size={11} />} {r.label}{r.required ? '' : ' (optional)'}
                    </li>
                ))}
            </ul>
        </div>
    );
}

const friendlyPasswordError = (msg) =>
    (/^weak password$/i.test(msg || '') ? 'Use 8–16 characters with an uppercase letter, a number and a symbol.' : msg);

function PasswordSection({ email, hasPassword, onPasswordSet }) {
    const { showToast } = useToast();
    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [confirm, setConfirm] = useState('');
    const [currentError, setCurrentError] = useState('');
    const [saving, setSaving] = useState(false);

    const { meetsRules } = passwordState(next);
    const mismatch = confirm.length > 0 && confirm !== next;
    const sameAsCurrent = hasPassword && next.length > 0 && next === current;
    const valid = meetsRules && confirm === next && !sameAsCurrent && (!hasPassword || current.length > 0);

    const reset = () => { setCurrent(''); setNext(''); setConfirm(''); setCurrentError(''); };

    const submit = async (e) => {
        e.preventDefault();
        if (!valid || saving) return;
        setSaving(true);
        setCurrentError('');
        try {
            if (hasPassword) {
                await api.put('/api/auth/me/password', { currentPassword: current, newPassword: next });
                showToast('Password updated. Other devices were signed out.', 'success');
            } else {
                await api.post('/api/auth/me/set-password', { password: next, newPassword: next });
                showToast('Password set. You can now sign in with your email and password.', 'success');
                onPasswordSet();
            }
            reset();
        } catch (err) {
            const msg = friendlyPasswordError(errorMessage(err, 'Could not update your password'));
            if (hasPassword && /incorrect|current|old password/i.test(msg)) setCurrentError('That password is not correct');
            else showToast(msg, 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Section
            title={hasPassword ? 'Password' : 'Set a password'}
            description={hasPassword
                ? 'Changing your password signs you out on your other devices.'
                : 'You sign in with an external provider. Add a password to also sign in with your email.'}
            pad
        >
            <form className="stg-acc-form" onSubmit={submit} noValidate>
                {/* Helps password managers pair the new password with the right account. */}
                <input type="text" name="username" autoComplete="username" value={email || ''} hidden readOnly />
                {hasPassword && (
                    <PasswordField
                        id="security-current"
                        label="Current password"
                        value={current}
                        onChange={(v) => { setCurrent(v); setCurrentError(''); }}
                        error={currentError}
                        autoComplete="current-password"
                    />
                )}
                <PasswordField
                    id="security-new"
                    label="New password"
                    value={next}
                    onChange={setNext}
                    error={sameAsCurrent ? 'Choose a password different from your current one' : undefined}
                    autoComplete="new-password"
                />
                <StrengthMeter password={next} />
                <PasswordField
                    id="security-confirm"
                    label="Confirm new password"
                    value={confirm}
                    onChange={setConfirm}
                    error={mismatch ? "Passwords don't match" : undefined}
                    autoComplete="new-password"
                />
                <div className="stg-acc-inline">
                    <Button type="submit" variant="primary" loading={saving} disabled={!valid}>
                        {hasPassword ? 'Update password' : 'Set password'}
                    </Button>
                    {(current || next || confirm) && <Button variant="ghost" onClick={reset} disabled={saving}>Clear</Button>}
                </div>
            </form>
        </Section>
    );
}

/* ── Two-factor authentication ─────────────────────────────────────────── */

const onlyDigits = (v) => v.replace(/\D/g, '').slice(0, 6);
const groupKey = (s) => (s || '').replace(/(.{4})/g, '$1 ').trim();
const isSafeQr = (src) => typeof src === 'string' && /^data:image\/(png|gif|jpeg|svg\+xml);base64,/i.test(src);

function CodeField({ id, label, value, onChange, onEnter, error }) {
    return (
        <Field id={id} label={label} error={error}>
            <Input
                id={id}
                className="stg-acc-code stg-mono"
                value={value}
                onChange={(e) => onChange(onlyDigits(e.target.value))}
                onKeyDown={(e) => { if (e.key === 'Enter') onEnter(); }}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                invalid={!!error}
                autoFocus
            />
        </Field>
    );
}

function TwoFactorSection({ initialEnabled, onChange }) {
    const { showToast } = useToast();
    const [enabled, setEnabled] = useState(!!initialEnabled);
    const [status, setStatus] = useState('loading'); // loading | ready | error
    const [mode, setMode] = useState('idle'); // idle | setup | disable
    const [setup, setSetup] = useState(null);
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);

    const load = useCallback(async () => {
        setStatus('loading');
        try {
            const { data } = await api.get('/api/auth/2fa/status');
            setEnabled(!!data?.twoFactorEnabled);
            setStatus('ready');
        } catch {
            setStatus('error');
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const close = () => { setMode('idle'); setSetup(null); setCode(''); setError(''); setCopied(false); };

    const start = async () => {
        setBusy(true);
        setError('');
        try {
            const { data } = await api.post('/api/auth/2fa/setup');
            setSetup(data || {});
            setMode('setup');
        } catch (err) {
            showToast(errorMessage(err, 'Could not start two-factor setup'), 'error');
        } finally {
            setBusy(false);
        }
    };

    const confirmSetup = async () => {
        if (code.length !== 6) { setError('Enter the 6-digit code from your app'); return; }
        setBusy(true);
        setError('');
        try {
            await api.post('/api/auth/2fa/verify-setup', { otp: code });
            setEnabled(true);
            onChange(true);
            close();
            showToast('Two-factor authentication is on', 'success');
        } catch (err) {
            setError(errorMessage(err, 'That code did not work. Try the newest one.'));
        } finally {
            setBusy(false);
        }
    };

    const disable = async () => {
        if (code.length !== 6) { setError('Enter the 6-digit code from your app'); return; }
        setBusy(true);
        setError('');
        try {
            await api.post('/api/auth/2fa/disable', { otp: code });
            setEnabled(false);
            onChange(false);
            close();
            showToast('Two-factor authentication is off', 'success');
        } catch (err) {
            setError(errorMessage(err, 'That code did not work. Try the newest one.'));
        } finally {
            setBusy(false);
        }
    };

    const copySecret = async () => {
        try {
            await navigator.clipboard.writeText(setup?.secret || '');
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            showToast('Copy failed. Select the key and copy it manually.', 'error');
        }
    };

    const qr = isSafeQr(setup?.qrDataUrl) ? setup.qrDataUrl : null;
    const otpLink = typeof setup?.otpauthUrl === 'string' && setup.otpauthUrl.startsWith('otpauth://') ? setup.otpauthUrl : null;

    return (
        <Section
            title="Two-factor authentication"
            description="Ask for a code from an authenticator app when you sign in."
        >
            {status === 'loading' && <LoadingState inline label="Checking status…" />}
            {status === 'error' && <ErrorState message="Could not load your two-factor status." onRetry={load} />}
            {status === 'ready' && (
                <>
                    <Row
                        label={<>Authenticator app {enabled ? <Badge tone="success">On</Badge> : <Badge>Off</Badge>}</>}
                        description={enabled
                            ? 'You will be asked for a code from your app when you sign in.'
                            : 'Use Google Authenticator, 1Password, Authy or any TOTP app.'}
                    >
                        {mode === 'idle' && (enabled
                            ? <Button size="sm" variant="danger-soft" onClick={() => { setMode('disable'); setError(''); }}>Turn off</Button>
                            : <Button size="sm" variant="primary" icon={ShieldCheck} onClick={start} loading={busy}>Turn on</Button>)}
                    </Row>

                    {mode === 'setup' && setup && (
                        <div className="stg-acc-panel">
                            <div>
                                <p className="stg-acc-step">1. Add Oruinwan to your authenticator app</p>
                                <p className="stg-acc-step-desc">
                                    {qr ? 'Scan the QR code, or enter the key by hand.' : 'Enter this key in your app, or open the link on this device.'}
                                </p>
                            </div>
                            <div className="stg-acc-qr-row">
                                {qr && <div className="stg-acc-qr"><img src={qr} alt="QR code for your authenticator app" /></div>}
                                <div className="stg-acc-stack stg-acc-tight stg-acc-key-col">
                                    <span className="stg-label" id="security-2fa-key">Setup key</span>
                                    <div className="stg-acc-secret" aria-labelledby="security-2fa-key">
                                        <code className="stg-mono">{groupKey(setup.secret)}</code>
                                        <IconButton label={copied ? 'Copied' : 'Copy key'} onClick={copySecret}>
                                            {copied ? <Check size={14} /> : <Copy size={14} />}
                                        </IconButton>
                                    </div>
                                    {otpLink && <a className="stg-acc-link" href={otpLink}>Open in authenticator app</a>}
                                </div>
                            </div>
                            <div>
                                <p className="stg-acc-step">2. Enter the 6-digit code your app shows</p>
                            </div>
                            <CodeField id="security-2fa-setup-code" label="Code" value={code} onChange={(v) => { setCode(v); setError(''); }} onEnter={confirmSetup} error={error} />
                            <div className="stg-acc-inline">
                                <Button variant="primary" onClick={confirmSetup} loading={busy} disabled={code.length !== 6}>Confirm</Button>
                                <Button variant="ghost" onClick={close} disabled={busy}>Cancel</Button>
                            </div>
                        </div>
                    )}

                    {mode === 'disable' && (
                        <div className="stg-acc-panel">
                            <Notice tone="warning">Without two-factor, anyone with your password can sign in.</Notice>
                            <CodeField id="security-2fa-disable-code" label="Code from your authenticator app" value={code} onChange={(v) => { setCode(v); setError(''); }} onEnter={disable} error={error} />
                            <div className="stg-acc-inline">
                                <Button variant="danger-soft" onClick={disable} loading={busy} disabled={code.length !== 6}>Turn off</Button>
                                <Button variant="ghost" onClick={close} disabled={busy}>Cancel</Button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </Section>
    );
}

/* ── Tab ───────────────────────────────────────────────────────────────── */

const SecurityTab = () => {
    // Fresh /me: the login response doesn't say whether the account has a password.
    const { user, setUser, loading } = useFreshUser();
    // Accounts created with Google/SSO have no password; older servers don't send the flag.
    const hasPassword = user?.hasPassword !== false;

    return (
        <>
            <PageIntro title="Password & security" description="Your password and two-factor sign-in." />
            {loading ? (
                <Section title="Password" pad><LoadingState inline /></Section>
            ) : (
                <PasswordSection
                    key={hasPassword ? 'change' : 'set'}
                    email={user?.email}
                    hasPassword={hasPassword}
                    onPasswordSet={() => setUser((prev) => (prev ? { ...prev, hasPassword: true } : prev))}
                />
            )}
            <TwoFactorSection
                initialEnabled={user?.twoFactorEnabled}
                onChange={(on) => setUser((prev) => (prev ? { ...prev, twoFactorEnabled: on } : prev))}
            />
        </>
    );
};

export default SecurityTab;
