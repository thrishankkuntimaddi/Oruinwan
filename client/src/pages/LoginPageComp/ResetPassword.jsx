import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';
import { Eye, EyeOff, ShieldCheck, AlertCircle, ArrowRight } from 'lucide-react';
import AuthShell from '../../components/public/AuthShell';

const RULES = [
    { key: 'length', label: '8–16 characters', test: p => p.length >= 8 && p.length <= 16 },
    { key: 'upper', label: 'Uppercase letter', test: p => /[A-Z]/.test(p) },
    { key: 'number', label: 'Number', test: p => /[0-9]/.test(p) },
    { key: 'special', label: 'Special character', test: p => /[^A-Za-z0-9]/.test(p) },
];

export default function ResetPassword() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const { showToast } = useToast();

    const token = params.get('token');
    const email = params.get('email');

    const [newPassword, setNewPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [showCfm, setShowCfm] = useState(false);
    const [loading, setLoading] = useState(false);

    const rules = RULES.map(r => ({ ...r, met: r.test(newPassword) }));
    const allMet = rules.every(r => r.met);
    const matches = newPassword.length > 0 && newPassword === confirm;
    const isValid = allMet && matches;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (newPassword !== confirm) { showToast('Passwords do not match', 'error'); return; }
        if (!allMet) { showToast('Password does not meet requirements', 'error'); return; }
        setLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, email, password: newPassword }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Reset failed');
            showToast('Password reset successfully — please log in.', 'success');
            navigate('/login');
        } catch (err) {
            showToast(err.message, 'error');
        } finally { setLoading(false); }
    };

    const confirmError = confirm.length > 0 && newPassword !== confirm;

    const aside = (
        <>
            <h1 className="orw-auth__title">Choose a new<br /><span className="orw-gloss-text">password.</span></h1>
            <p className="orw-auth__lead">After resetting, sign in and unlock your encrypted messages with the new password.</p>
        </>
    );

    if (!token) {
        return (
            <AuthShell title="Reset password" aside={aside}>
                <span className="orw-card__icon" style={{ '--c': '#ff8f8f' }}><AlertCircle size={19} aria-hidden="true" /></span>
                <div className="orw-auth__panel-head">
                    <h2>This link isn’t valid</h2>
                    <p>The reset link is missing its token. It may have been copied incompletely. Request a fresh link and open it from the email.</p>
                </div>
                <Link to="/forgot-password" className="orw-btn orw-btn--primary orw-btn--lg orw-btn--block">
                    Request a new link <ArrowRight size={15} />
                </Link>
            </AuthShell>
        );
    }

    return (
        <AuthShell title="Reset password" aside={aside}>
            <span className="orw-card__icon"><ShieldCheck size={19} aria-hidden="true" /></span>
            <div className="orw-auth__panel-head">
                <h2>Set a new password</h2>
                <p>{email ? <>For <strong style={{ color: 'var(--o-text)' }}>{email}</strong>. </> : null}Make it strong. You’ll use it to unlock encryption too.</p>
            </div>

            <form onSubmit={handleSubmit} className="orw-form">
                <div className="orw-field">
                    <label className="orw-label" htmlFor="reset-new">New password</label>
                    <div className="orw-input-wrap">
                        <input id="reset-new" type={showPwd ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                            placeholder="New password" autoComplete="new-password" required className="orw-input" aria-describedby="reset-rules" />
                        <button type="button" className="orw-input-wrap__btn" onClick={() => setShowPwd(!showPwd)}
                            aria-label={showPwd ? 'Hide password' : 'Show password'} aria-pressed={showPwd}>
                            {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                    </div>
                    <ul className="orw-pwd-rules" id="reset-rules" aria-label="Password requirements">
                        {rules.map(r => (
                            <li key={r.key} className={r.met ? 'is-met' : ''}>{r.label}<span className="orw-sr">{r.met ? ' (met)' : ' (not met)'}</span></li>
                        ))}
                    </ul>
                </div>

                <div className="orw-field">
                    <label className="orw-label" htmlFor="reset-confirm">Confirm password</label>
                    <div className="orw-input-wrap">
                        <input id="reset-confirm" type={showCfm ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)}
                            placeholder="Repeat the password" autoComplete="new-password" required className="orw-input"
                            aria-invalid={confirmError ? 'true' : undefined} data-state={matches ? 'ok' : undefined}
                            aria-describedby={confirmError ? 'reset-confirm-err' : undefined} />
                        <button type="button" className="orw-input-wrap__btn" onClick={() => setShowCfm(!showCfm)}
                            aria-label={showCfm ? 'Hide password' : 'Show password'} aria-pressed={showCfm}>
                            {showCfm ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                    </div>
                    {confirmError && <p className="orw-error-text" id="reset-confirm-err">Passwords don’t match</p>}
                </div>

                <button type="submit" className="orw-btn orw-btn--primary orw-btn--lg orw-btn--block" disabled={!isValid || loading} aria-busy={loading}>
                    {loading ? 'Resetting…' : <>Reset password <ArrowRight size={15} /></>}
                </button>
            </form>

            <p className="orw-auth__note"><Link to="/login" className="orw-link">Back to sign in</Link></p>
        </AuthShell>
    );
}
