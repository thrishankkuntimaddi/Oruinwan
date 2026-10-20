import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck, Check, ArrowRight } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import api from '@services/api';
import AuthShell from '../components/public/AuthShell';
import { AuthMark, AuthHead } from '../components/public/AuthParts';

const RULES = [
    { key: 'len', label: '8+ characters',    test: p => p.length >= 8 },
    { key: 'up',  label: 'Uppercase letter', test: p => /[A-Z]/.test(p) },
    { key: 'num', label: 'Number',           test: p => /\d/.test(p) },
    { key: 'sym', label: 'Special character', test: p => /[^A-Za-z0-9]/.test(p) },
];

const PROVIDER = { google: 'Google', github: 'GitHub', apple: 'Apple', microsoft: 'Microsoft' };

const SetPassword = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { user } = useAuth();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(null);

    useEffect(() => {
        if (!user) return;
        if (user.authProvider === 'local' || user.passwordSetAt) {
            navigate('/workspaces', { replace: true });
        }
    }, [user, navigate]);

    const rules = RULES.map(r => ({ ...r, met: r.test(password) }));
    const allMet = rules.every(r => r.met);
    const matches = password.length > 0 && password === confirmPassword;
    const isValid = allMet && matches;
    const confirmError = confirmPassword.length > 0 && password !== confirmPassword;
    const provider = PROVIDER[user?.authProvider] || user?.authProvider || 'another account';

    const handleSetPassword = async (e) => {
        e?.preventDefault();
        if (!isValid) { showToast('Meet every password requirement first', 'error'); return; }
        setLoading('set');
        try {
            await api.post('/api/auth/oauth/set-password', { password });
            showToast('Password set. You can now sign in with your email too.', 'success');
            localStorage.removeItem('oauthPasswordSetupRequired');
            localStorage.removeItem('oauthProvider');
            setTimeout(() => navigate('/workspaces', { replace: true }), 500);
        } catch (error) {
            showToast(error.response?.data?.message || 'We couldn’t set your password', 'error');
        } finally { setLoading(null); }
    };

    const handleSkip = async () => {
        setLoading('skip');
        try {
            await api.post('/api/auth/oauth/skip-password');
            showToast('You can set a password later in Settings', 'info');
            localStorage.removeItem('oauthPasswordSetupRequired');
            localStorage.removeItem('oauthProvider');
            setTimeout(() => navigate('/workspaces', { replace: true }), 500);
        } catch (error) {
            showToast(error.response?.data?.message || 'We couldn’t skip this step', 'error');
        } finally { setLoading(null); }
    };

    return (
        <AuthShell
            title="Set a password"
            aside={<>
                <h1 className="orw-auth__title">One more key<br /><span className="orw-gloss-text">for your account.</span></h1>
                <p className="orw-auth__lead">A password lets you sign in with your email on any device and unlocks your encrypted messages.</p>
            </>}
        >
            <AuthMark icon={ShieldCheck} />
            <AuthHead title="Add a password">
                You signed in with <strong>{provider}</strong>. Add a password so you can also sign in with your email.
            </AuthHead>

            <form onSubmit={handleSetPassword} className="orw-form">
                <div className="orw-field">
                    <label className="orw-label" htmlFor="setpwd-new">Password</label>
                    <div className="orw-input-wrap">
                        <input id="setpwd-new" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                            placeholder="Create a password" autoComplete="new-password" autoFocus className="orw-input" aria-describedby="setpwd-rules" />
                        <button type="button" className="orw-input-wrap__btn" onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>
                            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                    </div>
                    <ul className="orw-pwd-rules" id="setpwd-rules" aria-label="Password requirements">
                        {rules.map(r => (
                            <li key={r.key} className={r.met ? 'is-met' : ''}>
                                <span className="orw-pwd-rules__tick" aria-hidden="true">{r.met && <Check size={10} strokeWidth={3} />}</span>
                                {r.label}<span className="orw-sr">{r.met ? ' (met)' : ' (not met)'}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="orw-field">
                    <label className="orw-label" htmlFor="setpwd-confirm">Confirm password</label>
                    <div className="orw-input-wrap">
                        <input id="setpwd-confirm" type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                            placeholder="Repeat the password" autoComplete="new-password" className="orw-input"
                            aria-invalid={confirmError ? 'true' : undefined} data-state={matches ? 'ok' : undefined} />
                        <button type="button" className="orw-input-wrap__btn" onClick={() => setShowConfirm(!showConfirm)}
                            aria-label={showConfirm ? 'Hide password' : 'Show password'} aria-pressed={showConfirm}>
                            {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                    </div>
                    {confirmError && <p className="orw-error-text">Passwords don’t match</p>}
                </div>

                <button type="submit" className="orw-btn orw-btn--primary orw-btn--lg orw-btn--block" disabled={!isValid || !!loading} aria-busy={loading === 'set'}>
                    {loading === 'set' ? 'Saving…' : <>Set password <ArrowRight size={15} /></>}
                </button>
            </form>

            <p className="orw-auth__note">
                Not now? <button type="button" className="orw-link" onClick={handleSkip} disabled={!!loading}>
                    {loading === 'skip' ? 'Skipping…' : 'Skip and set it later in Settings'}
                </button>
            </p>
        </AuthShell>
    );
};

export default SetPassword;
