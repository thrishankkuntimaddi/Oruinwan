import { useState, useEffect, useId, useRef } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, Loader, Check } from 'lucide-react';

const COUNTRIES = [
    { code: 'IN', name: 'IND', dial_code: '+91', length: 10, flag: '🇮🇳' },
    { code: 'US', name: 'USA', dial_code: '+1',  length: 10, flag: '🇺🇸' },
    { code: 'AE', name: 'UAE', dial_code: '+971',length: 9,  flag: '🇦🇪' },
    { code: 'AU', name: 'AUS', dial_code: '+61', length: 9,  flag: '🇦🇺' },
    { code: 'GB', name: 'UK',  dial_code: '+44', length: 10, flag: '🇬🇧' },
    { code: 'FR', name: 'FRA', dial_code: '+33', length: 9,  flag: '🇫🇷' },
    { code: 'CA', name: 'CAN', dial_code: '+1',  length: 10, flag: '🇨🇦' },
];

const PWD_RULES = [
    { key: 'length',  label: '8–16 characters',      test: p => p.length >= 8 && p.length <= 16 },
    { key: 'upper',   label: 'Uppercase letter',      test: p => /[A-Z]/.test(p) },
    { key: 'number',  label: 'Number',                test: p => /[0-9]/.test(p) },
    { key: 'special', label: 'Special character',     test: p => /[^A-Za-z0-9]/.test(p) },
];

const StatusIcon = ({ s }) => {
    if (s === 'checking') return <Loader size={14} className="orw-spin" style={{ color: 'var(--o-accent)' }} aria-label="Checking" />;
    if (s === 'available') return <CheckCircle2 size={14} style={{ color: 'var(--o-good)' }} aria-label="Available" />;
    if (s === 'taken') return <AlertCircle size={14} style={{ color: '#ff8f8f' }} aria-label="Not available" />;
    return null;
};

const SignupForm = ({ onSwitch }) => {
    const [formData, setFormData] = useState({ username: '', email: '', phone: '', password: '', confirmPassword: '' });
    const [errors, setErrors] = useState({});
    const [vs, setVs] = useState({ username: 'idle', email: 'idle', phone: 'idle' });
    const [showPwd, setShowPwd] = useState(false);
    const [showCfm, setShowCfm] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
    const [loading, setLoading] = useState(false);
    const { showToast } = useToast();
    const uid = useId();
    const [step, setStep] = useState(1);
    const passwordRef = useRef(null);
    const usernameRef = useRef(null);

    
    useEffect(() => {
        const t = setTimeout(async () => {
            if (formData.username.trim().length >= 3) {
                setVs(p => ({ ...p, username: 'checking' }));
                try {
                    const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users/check-username`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: formData.username }) });
                    const data = await res.json();
                    if (data.exists) { setErrors(p => ({ ...p, username: 'Username already taken' })); setVs(p => ({ ...p, username: 'taken' })); }
                    else { setErrors(p => ({ ...p, username: '' })); setVs(p => ({ ...p, username: 'available' })); }
                } catch { setVs(p => ({ ...p, username: 'idle' })); }
            } else { setVs(p => ({ ...p, username: 'idle' })); }
        }, 500);
        return () => clearTimeout(t);
    }, [formData.username]);

    
    useEffect(() => {
        const t = setTimeout(async () => {
            if (formData.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
                setVs(p => ({ ...p, email: 'checking' }));
                try {
                    const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users/check-email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: formData.email }) });
                    const data = await res.json();
                    if (data.exists) { setErrors(p => ({ ...p, email: 'Email already registered' })); setVs(p => ({ ...p, email: 'taken' })); }
                    else { setErrors(p => ({ ...p, email: '' })); setVs(p => ({ ...p, email: 'available' })); }
                } catch { setVs(p => ({ ...p, email: 'idle' })); }
            } else { setVs(p => ({ ...p, email: 'idle' })); }
        }, 500);
        return () => clearTimeout(t);
    }, [formData.email]);

    
    useEffect(() => {
        const t = setTimeout(async () => {
            const digits = formData.phone.replace(/\D/g, '');
            if (digits.length === selectedCountry.length) {
                setVs(p => ({ ...p, phone: 'checking' }));
                try {
                    const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users/check-phone`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: formData.phone, phoneCode: selectedCountry.dial_code }) });
                    const data = await res.json();
                    if (data.exists) { setErrors(p => ({ ...p, phone: 'Phone already registered' })); setVs(p => ({ ...p, phone: 'taken' })); }
                    else { setErrors(p => ({ ...p, phone: '' })); setVs(p => ({ ...p, phone: 'available' })); }
                } catch { setVs(p => ({ ...p, phone: 'idle' })); }
            } else { setVs(p => ({ ...p, phone: 'idle' })); }
        }, 500);
        return () => clearTimeout(t);
    }, [formData.phone, selectedCountry]);

    const handleChange = e => {
        const { name, value } = e.target;
        setFormData(p => ({ ...p, [name]: value }));
        setErrors(p => ({ ...p, [name]: '' }));
    };

    const pwdRules = PWD_RULES.map(r => ({ ...r, met: r.test(formData.password) }));
    const allPwdMet = pwdRules.every(r => r.met);
    const passwordsMatch = formData.password && formData.confirmPassword && formData.password === formData.confirmPassword;
    const passwordsDontMatch = formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword;

    const isFormValid = formData.username && formData.email && formData.phone && formData.password && formData.confirmPassword &&
        vs.username === 'available' && vs.email === 'available' && vs.phone === 'available' &&
        passwordsMatch && allPwdMet && !Object.values(errors).some(e => e);

    const handleSubmit = async e => {
        e.preventDefault();
        if (!isFormValid) return;
        setLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/signup`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: formData.username, email: formData.email, phone: formData.phone, phoneCode: selectedCountry.dial_code, password: formData.password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Signup failed');
            showToast('Verification link sent to your email!', 'success');
            onSwitch();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const fieldState = (key) => (errors[key] ? 'true' : undefined);
    const okState = (key) => (vs[key] === 'available' ? 'ok' : undefined);

    // Step 1 is done once all three identifiers are confirmed available.
    const detailsValid = ['username', 'email', 'phone'].every(k => formData[k] && vs[k] === 'available' && !errors[k]);
    const detailsChecking = ['username', 'email', 'phone'].some(k => vs[k] === 'checking');

    const goTo = (n) => {
        setStep(n);
        // Move focus to the first field of the new step (after it renders).
        setTimeout(() => (n === 2 ? passwordRef : usernameRef).current?.focus(), 0);
    };

    const onSubmit = (e) => {
        if (step === 1) {
            e.preventDefault();
            if (detailsValid) goTo(2);
            return;
        }
        handleSubmit(e);
    };

    const StepBar = () => (
        <div className="orw-stepper" aria-label={`Step ${step} of 2`}>
            {['Your details', 'Secure your account'].map((label, i) => (
                <div key={label} className={`orw-stepper__item${step === i + 1 ? ' is-current' : ''}${step > i + 1 ? ' is-done' : ''}`}>
                    <span className="orw-stepper__bar" aria-hidden="true" />
                    <span className="orw-stepper__label">
                        <b>{step > i + 1 ? <Check size={11} strokeWidth={3} aria-hidden="true" /> : i + 1}</b>{label}
                    </span>
                </div>
            ))}
        </div>
    );

    return (
        <div>
            <StepBar />

            <form onSubmit={onSubmit} className="orw-form">
                {step === 1 ? (
                    <div className="orw-wizard-step" key="s1">
                        <div className="orw-auth__panel-head">
                            <h2>Create your account</h2>
                            <p>Free for individuals. Let’s start with the basics.</p>
                        </div>

                        <div className="orw-form">
                            <div className="orw-field">
                                <label className="orw-label" htmlFor={`${uid}-username`}>Username</label>
                                <div className="orw-input-wrap">
                                    <input ref={usernameRef} id={`${uid}-username`} name="username" placeholder="Choose a username" autoComplete="username"
                                        value={formData.username} onChange={handleChange} className="orw-input"
                                        aria-invalid={fieldState('username')} data-state={okState('username')}
                                        aria-describedby={errors.username ? `${uid}-username-err` : undefined} />
                                    <span className="orw-input-wrap__status"><StatusIcon s={vs.username} /></span>
                                </div>
                                {errors.username && <p className="orw-error-text" id={`${uid}-username-err`}>{errors.username}</p>}
                            </div>

                            <div className="orw-field">
                                <label className="orw-label" htmlFor={`${uid}-email`}>Work email</label>
                                <div className="orw-input-wrap">
                                    <input id={`${uid}-email`} name="email" type="email" placeholder="you@company.com" autoComplete="email"
                                        value={formData.email} onChange={handleChange} className="orw-input"
                                        aria-invalid={fieldState('email')} data-state={okState('email')}
                                        aria-describedby={errors.email ? `${uid}-email-err` : undefined} />
                                    <span className="orw-input-wrap__status"><StatusIcon s={vs.email} /></span>
                                </div>
                                {errors.email && <p className="orw-error-text" id={`${uid}-email-err`}>{errors.email}</p>}
                            </div>

                            <div className="orw-field">
                                <label className="orw-label" htmlFor={`${uid}-phone`}>Phone number</label>
                                <div className="orw-phone">
                                    <select className="orw-select" aria-label="Country code" value={selectedCountry.code}
                                        onChange={e => setSelectedCountry(COUNTRIES.find(c => c.code === e.target.value) || COUNTRIES[0])}>
                                        {COUNTRIES.map(c => (
                                            <option key={c.code} value={c.code}>{c.flag} {c.dial_code}</option>
                                        ))}
                                    </select>
                                    <div className="orw-input-wrap">
                                        <input id={`${uid}-phone`} name="phone" inputMode="numeric" autoComplete="tel-national"
                                            placeholder={`${selectedCountry.length}-digit number`}
                                            value={formData.phone} onChange={handleChange} className="orw-input"
                                            aria-invalid={fieldState('phone')} data-state={okState('phone')}
                                            aria-describedby={errors.phone ? `${uid}-phone-err` : undefined} />
                                        <span className="orw-input-wrap__status"><StatusIcon s={vs.phone} /></span>
                                    </div>
                                </div>
                                {errors.phone && <p className="orw-error-text" id={`${uid}-phone-err`}>{errors.phone}</p>}
                            </div>

                            <button type="submit" className="orw-btn orw-btn--primary orw-btn--lg orw-btn--block" disabled={!detailsValid}>
                                {detailsChecking ? 'Checking…' : <>Continue <ArrowRight size={15} /></>}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="orw-wizard-step" key="s2">
                        <div className="orw-auth__panel-head">
                            <h2>Secure your account</h2>
                            <p>Almost there, <strong style={{ color: 'var(--o-text)' }}>{formData.username}</strong>. This password also unlocks your encrypted messages.</p>
                        </div>

                        <div className="orw-form">
                            <div className="orw-field">
                                <label className="orw-label" htmlFor={`${uid}-password`}>Password</label>
                                <div className="orw-input-wrap">
                                    <input ref={passwordRef} id={`${uid}-password`} name="password" type={showPwd ? 'text' : 'password'} placeholder="Create a password"
                                        autoComplete="new-password" value={formData.password} onChange={handleChange} className="orw-input"
                                        aria-describedby={`${uid}-pwd-rules`} />
                                    <button type="button" className="orw-input-wrap__btn" onClick={() => setShowPwd(!showPwd)}
                                        aria-label={showPwd ? 'Hide password' : 'Show password'} aria-pressed={showPwd}>
                                        {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                                    </button>
                                </div>
                                <ul className="orw-pwd-rules" id={`${uid}-pwd-rules`} aria-label="Password requirements">
                                    {pwdRules.map(r => (
                                        <li key={r.key} className={r.met ? 'is-met' : ''}>
                                            <span className="orw-pwd-rules__tick" aria-hidden="true">{r.met && <Check size={10} strokeWidth={3} />}</span>
                                            {r.label}<span className="orw-sr">{r.met ? ' (met)' : ' (not met)'}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="orw-field">
                                <label className="orw-label" htmlFor={`${uid}-confirm`}>Confirm password</label>
                                <div className="orw-input-wrap">
                                    <input id={`${uid}-confirm`} name="confirmPassword" type={showCfm ? 'text' : 'password'} placeholder="Repeat your password"
                                        autoComplete="new-password" value={formData.confirmPassword} onChange={handleChange} className="orw-input"
                                        aria-invalid={passwordsDontMatch ? 'true' : undefined} data-state={passwordsMatch ? 'ok' : undefined}
                                        aria-describedby={passwordsDontMatch ? `${uid}-confirm-err` : undefined} />
                                    <button type="button" className="orw-input-wrap__btn" onClick={() => setShowCfm(!showCfm)}
                                        aria-label={showCfm ? 'Hide password' : 'Show password'} aria-pressed={showCfm}>
                                        {showCfm ? <EyeOff size={15} /> : <Eye size={15} />}
                                    </button>
                                </div>
                                {passwordsDontMatch && <p className="orw-error-text" id={`${uid}-confirm-err`}>Passwords don’t match</p>}
                            </div>

                            <div className="orw-wizard-step__actions">
                                <button type="button" className="orw-btn orw-btn--ghost orw-btn--lg" onClick={() => goTo(1)} aria-label="Back to your details">
                                    <ArrowLeft size={15} />
                                </button>
                                <button type="submit" className="orw-btn orw-btn--primary orw-btn--lg orw-btn--block" disabled={!isFormValid || loading} aria-busy={loading}>
                                    {loading ? 'Creating account…' : <>Create account <ArrowRight size={15} /></>}
                                </button>
                            </div>
                            <p className="orw-hint" style={{ textAlign: 'center', fontSize: 11.5 }}>
                                By continuing you agree to our <a className="orw-link" style={{ fontSize: 'inherit' }} href="/terms">Terms</a> and <a className="orw-link" style={{ fontSize: 'inherit' }} href="/privacy">Privacy Policy</a>.
                            </p>
                        </div>
                    </div>
                )}
            </form>
        </div>
    );
};

export default SignupForm;
