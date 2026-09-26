import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, ArrowRight, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';
import logger from '../../utils/logger';
import AuthShell from '../../components/public/AuthShell';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (user) navigate('/', { replace: true });
    }, [user, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            setSent(true);
        } catch (err) {
            logger.error('Forgot Password Error:', err);
            setError('We couldn’t reach the server. Check your connection and try again.');
        } finally { setLoading(false); }
    };

    return (
        <AuthShell
            title="Reset password"
            aside={<>
                <h1 className="orw-auth__title">Locked out?<br /><span className="orw-gloss-text">Let’s fix that.</span></h1>
                <p className="orw-auth__lead">We’ll email you a secure link to choose a new password. Your encrypted messages stay safe; unlock them with the new password afterwards.</p>
            </>}
        >
            {sent ? (
                <div role="status">
                    <span className="orw-card__icon" style={{ '--c': '#8fe0b8' }}><CheckCircle2 size={19} aria-hidden="true" /></span>
                    <div className="orw-auth__panel-head">
                        <h2>Check your inbox</h2>
                        <p>If an account exists for <strong style={{ color: 'var(--o-text)' }}>{email}</strong>, a reset link is on its way. It expires soon, so use it shortly.</p>
                    </div>
                    <div className="orw-form">
                        <button type="button" className="orw-btn orw-btn--ghost orw-btn--lg orw-btn--block" onClick={() => setSent(false)}>
                            Use a different email
                        </button>
                        <Link to="/login" className="orw-btn orw-btn--primary orw-btn--lg orw-btn--block">
                            Back to sign in <ArrowRight size={15} />
                        </Link>
                    </div>
                </div>
            ) : (
                <>
                    <span className="orw-card__icon"><KeyRound size={19} aria-hidden="true" /></span>
                    <div className="orw-auth__panel-head">
                        <h2>Forgot your password?</h2>
                        <p>Enter the email you use for your account and we’ll send you a reset link.</p>
                    </div>
                    <form onSubmit={handleSubmit} className="orw-form">
                        {error && (
                            <div className="orw-auth__alert" role="alert"><AlertCircle size={16} aria-hidden="true" />{error}</div>
                        )}
                        <div className="orw-field">
                            <label className="orw-label" htmlFor="forgot-email">Email</label>
                            <input id="forgot-email" type="email" name="email" placeholder="name@company.com" autoComplete="email" required
                                value={email} onChange={e => setEmail(e.target.value)} className="orw-input" />
                        </div>
                        <button type="submit" className="orw-btn orw-btn--primary orw-btn--lg orw-btn--block" disabled={loading || !email} aria-busy={loading}>
                            {loading ? 'Sending link…' : <>Send reset link <ArrowRight size={15} /></>}
                        </button>
                    </form>
                    <p className="orw-auth__note">
                        <Link to="/login" className="orw-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <ArrowLeft size={13} aria-hidden="true" /> Back to sign in
                        </Link>
                    </p>
                </>
            )}
        </AuthShell>
    );
}
