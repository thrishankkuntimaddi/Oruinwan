import { useContext, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import api from '@services/api';
import { AuthContext } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { finishGoogleSession, latestDob } from './googleContinue';

/**
 * "Continue with Google" for an email that has no account yet. Nothing is created until the
 * person confirms here and gives the details every account needs.
 * `ticket` is the server's { signupToken, email, name, picture }.
 */
const GoogleSignupStep = ({ ticket, onCancel }) => {
    const [username, setUsername] = useState(ticket.name || '');
    const [dob, setDob] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { setUser } = useContext(AuthContext);
    const { showToast } = useToast();
    const navigate = useNavigate();
    const uid = useId();

    const valid = username.trim().length >= 2 && dob;

    const submit = async (e) => {
        e.preventDefault();
        if (!valid) return;
        setLoading(true);
        setError('');
        try {
            const res = await api.post('/api/auth/google-signup', { signupToken: ticket.signupToken, username: username.trim(), dob });
            showToast('Welcome to Oruinwan!', 'success');
            finishGoogleSession(res.data, { setUser, navigate });
        } catch (err) {
            const message = err.response?.data?.message || 'Sign-up failed';
            setError(message);
            if (/expired/i.test(message)) setTimeout(onCancel, 2500);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div data-testid="google-signup-step">
            <div className="orw-auth__panel-head">
                <h2>You're creating a new account</h2>
                <p>
                    There's no Oruinwan account for <strong style={{ color: 'var(--o-text)' }}>{ticket.email}</strong> yet.
                    Add a couple of details and you're in.
                </p>
            </div>

            <div className="orw-auth__alert orw-auth__alert--good" role="status" style={{ marginBottom: 20 }}>
                <Sparkles size={16} aria-hidden="true" />
                <div>Welcome to the team. Your email is already verified by Google.</div>
            </div>

            <form onSubmit={submit} className="orw-form">
                <div className="orw-field">
                    <label className="orw-label" htmlFor={`${uid}-username`}>Username</label>
                    <input id={`${uid}-username`} className="orw-input" value={username} autoComplete="username" autoFocus
                        maxLength={40} onChange={(e) => { setUsername(e.target.value); setError(''); }} placeholder="How teammates see you" />
                </div>

                <div className="orw-field">
                    <label className="orw-label" htmlFor={`${uid}-dob`}>Date of birth</label>
                    <input id={`${uid}-dob`} type="date" className="orw-input" value={dob} max={latestDob()} min="1900-01-01"
                        autoComplete="bday" onChange={(e) => { setDob(e.target.value); setError(''); }} />
                    <div className="orw-hint">You need to be at least 13. Only you can see this.</div>
                </div>

                {error && <p className="orw-error-text" role="alert">{error}</p>}

                <div className="orw-wizard-step__actions">
                    <button type="button" className="orw-btn orw-btn--ghost orw-btn--lg" onClick={onCancel} aria-label="Use a different account">
                        <ArrowLeft size={15} />
                    </button>
                    <button type="submit" className="orw-btn orw-btn--primary orw-btn--lg orw-btn--block" disabled={!valid || loading} aria-busy={loading}>
                        {loading ? 'Creating account…' : <>Create my account <ArrowRight size={15} /></>}
                    </button>
                </div>
                <p className="orw-hint" style={{ textAlign: 'center', fontSize: 11.5 }}>
                    By continuing you agree to our <a className="orw-link" style={{ fontSize: 'inherit' }} href="/terms">Terms</a> and <a className="orw-link" style={{ fontSize: 'inherit' }} href="/privacy">Privacy Policy</a>.
                </p>
            </form>
        </div>
    );
};

export default GoogleSignupStep;
