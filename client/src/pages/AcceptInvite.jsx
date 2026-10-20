import React, { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { CheckCircle2, AlertCircle, ArrowRight, Eye, EyeOff, Mail, UserPlus } from "lucide-react";
import { API_BASE } from '@services/api';
import AuthShell from '../components/public/AuthShell';
import { AuthMark, AuthHead, AuthStatus, AuthProgress } from '../components/public/AuthParts';

const ASIDE = (
    <>
        <h1 className="orw-auth__title">Your team is<br /><span className="orw-gloss-text">waiting for you.</span></h1>
        <p className="orw-auth__lead">Set up your account once and you’ll land in your company’s workspace, with everything end-to-end encrypted.</p>
    </>
);

const AcceptInvite = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    useAuth();

    const token = searchParams.get("token");
    const emailParam = searchParams.get("email");

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPwd, setShowPwd] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (password !== confirmPassword) {
            setError("Passwords don’t match");
            return;
        }

        if (!username || !password) {
            setError("Fill in every field to continue");
            return;
        }

        setLoading(true);

        try {
            const res = await fetch(`${API_BASE}/api/companies/accept-invite`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, username, password })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || "We couldn’t accept this invitation");
            }

            setSuccess(true);

            setTimeout(() => {
                navigate("/login");
            }, 2000);

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <AuthShell title="Accept invitation" aside={ASIDE}>
                <AuthStatus
                    icon={AlertCircle}
                    tone="bad"
                    title="This invitation link isn’t valid"
                    lead="The link is missing its code, or it has expired. Ask your company admin to send a new invitation."
                    actions={<>
                        <Link to="/login" className="orw-btn orw-btn--primary orw-btn--lg orw-btn--block">Go to sign in <ArrowRight size={15} /></Link>
                        <Link to="/" className="orw-link">Back to home</Link>
                    </>}
                />
            </AuthShell>
        );
    }

    if (success) {
        return (
            <AuthShell title="Accept invitation" aside={ASIDE}>
                <AuthStatus
                    icon={CheckCircle2}
                    tone="good"
                    title="You’re all set"
                    lead="Your account is ready and you’ve joined the team. Taking you to sign in…"
                    actions={<>
                        <AuthProgress ms={2000} label="Redirecting to sign in" />
                        <Link to="/login" className="orw-btn orw-btn--primary orw-btn--lg orw-btn--block">Sign in now <ArrowRight size={15} /></Link>
                    </>}
                />
            </AuthShell>
        );
    }

    return (
        <AuthShell title="Accept invitation" aside={ASIDE}>
            <AuthMark icon={UserPlus} />
            <AuthHead eyebrow="Company invitation" title="Set up your account">
                Choose the name teammates will see and a password. You’ll sign in with it next.
            </AuthHead>

            <form onSubmit={handleSubmit} className="orw-form">
                {error && (
                    <div className="orw-auth__alert" role="alert"><AlertCircle size={16} aria-hidden="true" />{error}</div>
                )}

                {emailParam && (
                    <div className="orw-field">
                        <span className="orw-label">Email</span>
                        <div className="orw-auth-value"><Mail size={15} aria-hidden="true" /><span>{emailParam}</span></div>
                    </div>
                )}

                <div className="orw-field">
                    <label className="orw-label" htmlFor="accept-name">Full name</label>
                    <input id="accept-name" type="text" className="orw-input" value={username} autoComplete="name" autoFocus required
                        onChange={(e) => setUsername(e.target.value)} placeholder="How teammates see you" />
                </div>

                <div className="orw-field">
                    <label className="orw-label" htmlFor="accept-password">Password</label>
                    <div className="orw-input-wrap">
                        <input id="accept-password" type={showPwd ? 'text' : 'password'} className="orw-input" value={password} required
                            autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} placeholder="Create a password" />
                        <button type="button" className="orw-input-wrap__btn" onClick={() => setShowPwd(!showPwd)}
                            aria-label={showPwd ? 'Hide password' : 'Show password'} aria-pressed={showPwd}>
                            {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                    </div>
                    <p className="orw-hint">It also unlocks your encrypted messages.</p>
                </div>

                <div className="orw-field">
                    <label className="orw-label" htmlFor="accept-confirm">Confirm password</label>
                    <input id="accept-confirm" type={showPwd ? 'text' : 'password'} className="orw-input" value={confirmPassword} required
                        autoComplete="new-password" onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat the password"
                        aria-invalid={mismatch ? 'true' : undefined}
                        data-state={confirmPassword && !mismatch ? 'ok' : undefined} />
                    {mismatch && <p className="orw-error-text">Passwords don’t match</p>}
                </div>

                <button type="submit" className="orw-btn orw-btn--primary orw-btn--lg orw-btn--block"
                    disabled={loading || !username || !password || mismatch} aria-busy={loading}>
                    {loading ? 'Setting up…' : <>Create account and join <ArrowRight size={15} /></>}
                </button>
            </form>

            <p className="orw-auth__note">Already have an account? <Link className="orw-link" to="/login">Sign in</Link></p>
        </AuthShell>
    );
};

export default AcceptInvite;
