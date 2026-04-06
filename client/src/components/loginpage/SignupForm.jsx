// SignupForm.jsx — Monolith Flow Design System
import { useState, useEffect } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { Eye, EyeOff, ChevronDown, CheckCircle2, AlertCircle, ArrowRight, Loader } from 'lucide-react';

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

const inp = (focused, err) => ({
    width: '100%', boxSizing: 'border-box',
    padding: '10px 12px',
    background: '#141414',
    border: `1px solid ${err ? '#e05252' : focused ? 'rgba(184,149,106,0.5)' : 'rgba(255,255,255,0.08)'}`,
    color: '#e4e4e4', fontSize: '13px', outline: 'none',
    fontFamily: 'Inter, system-ui, sans-serif',
    transition: 'border-color 150ms ease',
});

const Label = ({ children }) => (
    <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(228,228,228,0.4)', display: 'block', marginBottom: '6px' }}>
        {children}
    </label>
);

const StatusIcon = ({ s }) => {
    if (s === 'checking') return <Loader size={13} style={{ color: '#b8956a', animation: 'spin 0.8s linear infinite' }} />;
    if (s === 'available') return <CheckCircle2 size={13} style={{ color: '#5aba8a' }} />;
    if (s === 'taken') return <AlertCircle size={13} style={{ color: '#e05252' }} />;
    return null;
};

const SignupForm = ({ onSwitch }) => {
    const [formData, setFormData] = useState({ username: '', email: '', phone: '', password: '', confirmPassword: '' });
    const [errors, setErrors] = useState({});
    const [vs, setVs] = useState({ username: 'idle', email: 'idle', phone: 'idle' });
    const [showPwd, setShowPwd] = useState(false);
    const [showCfm, setShowCfm] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
    const [showCountryDd, setShowCountryDd] = useState(false);
    const [focused, setFocused] = useState(null);
    const [loading, setLoading] = useState(false);
    const { showToast } = useToast();

    // Debounced username check —————————————————————————————————————
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

    // Debounced email check —————————————————————————————————————
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

    // Debounced phone check —————————————————————————————————————
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

    return (
        <div>
            <style>{`@keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }`}</style>
            <div style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#e4e4e4', letterSpacing: '-0.02em', marginBottom: '6px' }}>Create account</h2>
                <p style={{ fontSize: '13px', color: 'rgba(228,228,228,0.4)' }}>Join thousands of teams already on Chttrix.</p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Username */}
                <div>
                    <Label>Username</Label>
                    <div style={{ position: 'relative' }}>
                        <input name="username" placeholder="Choose a username"
                            value={formData.username} onChange={handleChange}
                            onFocus={() => setFocused('username')} onBlur={() => setFocused(null)}
                            style={{ ...inp(focused === 'username', errors.username), paddingRight: '36px' }} />
                        <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}>
                            <StatusIcon s={vs.username} />
                        </div>
                    </div>
                    {errors.username && <p style={{ fontSize: '11px', color: '#e05252', marginTop: '4px' }}>{errors.username}</p>}
                </div>

                {/* Email */}
                <div>
                    <Label>Email</Label>
                    <div style={{ position: 'relative' }}>
                        <input name="email" type="email" placeholder="you@company.com"
                            value={formData.email} onChange={handleChange}
                            onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
                            style={{ ...inp(focused === 'email', errors.email), paddingRight: '36px' }} />
                        <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}>
                            <StatusIcon s={vs.email} />
                        </div>
                    </div>
                    {errors.email && <p style={{ fontSize: '11px', color: '#e05252', marginTop: '4px' }}>{errors.email}</p>}
                </div>

                {/* Phone */}
                <div>
                    <Label>Phone Number</Label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {/* Country selector */}
                        <div style={{ position: 'relative', width: '110px', flexShrink: 0 }}>
                            <button type="button" onClick={() => setShowCountryDd(!showCountryDd)}
                                style={{ width: '100%', padding: '10px 8px', background: '#141414', border: `1px solid ${focused === 'phone' ? 'rgba(184,149,106,0.5)' : 'rgba(255,255,255,0.08)'}`, color: '#e4e4e4', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                                <span>{selectedCountry.flag} {selectedCountry.dial_code}</span>
                                <ChevronDown size={11} style={{ color: 'rgba(228,228,228,0.3)', transform: showCountryDd ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }} />
                            </button>
                            {showCountryDd && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 50, width: '180px', background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '200px', overflowY: 'auto', marginTop: '2px' }}>
                                    {COUNTRIES.map(c => (
                                        <button key={c.code} type="button" onClick={() => { setSelectedCountry(c); setShowCountryDd(false); }}
                                            style={{ width: '100%', padding: '8px 12px', background: selectedCountry.code === c.code ? 'rgba(184,149,106,0.1)' : 'none', border: 'none', color: '#e4e4e4', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px', display: 'flex', gap: '8px', alignItems: 'center', textAlign: 'left' }}>
                                            <span>{c.flag}</span><span style={{ flex: 1 }}>{c.name}</span><span style={{ color: 'rgba(228,228,228,0.4)' }}>{c.dial_code}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {/* Phone input */}
                        <div style={{ flex: 1, position: 'relative' }}>
                            <input name="phone" placeholder={`${selectedCountry.length} digits`}
                                value={formData.phone} onChange={handleChange}
                                onFocus={() => setFocused('phone')} onBlur={() => setFocused(null)}
                                style={{ ...inp(focused === 'phone', errors.phone), paddingRight: '36px' }} />
                            <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}>
                                <StatusIcon s={vs.phone} />
                            </div>
                        </div>
                    </div>
                    {errors.phone && <p style={{ fontSize: '11px', color: '#e05252', marginTop: '4px' }}>{errors.phone}</p>}
                </div>

                {/* Password */}
                <div>
                    <Label>Password</Label>
                    <div style={{ position: 'relative' }}>
                        <input name="password" type={showPwd ? 'text' : 'password'} placeholder="Create a password"
                            value={formData.password} onChange={handleChange}
                            onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
                            style={{ ...inp(focused === 'password'), paddingRight: '36px' }} />
                        <button type="button" onClick={() => setShowPwd(!showPwd)}
                            style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(228,228,228,0.35)', display: 'flex' }}>
                            {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                    </div>
                    {/* Password rules */}
                    {formData.password.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                            {pwdRules.map(r => (
                                <span key={r.key} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: r.met ? '#5aba8a' : 'rgba(228,228,228,0.3)', fontWeight: 600 }}>
                                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: r.met ? '#5aba8a' : 'rgba(255,255,255,0.15)' }} />
                                    {r.label}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Confirm password */}
                <div>
                    <Label>Confirm Password</Label>
                    <div style={{ position: 'relative' }}>
                        <input name="confirmPassword" type={showCfm ? 'text' : 'password'} placeholder="Confirm your password"
                            value={formData.confirmPassword} onChange={handleChange}
                            onFocus={() => setFocused('confirmPassword')} onBlur={() => setFocused(null)}
                            style={{ ...inp(focused === 'confirmPassword', passwordsDontMatch), paddingRight: '36px', borderColor: passwordsMatch ? '#5aba8a' : passwordsDontMatch ? '#e05252' : focused === 'confirmPassword' ? 'rgba(184,149,106,0.5)' : 'rgba(255,255,255,0.08)' }} />
                        <button type="button" onClick={() => setShowCfm(!showCfm)}
                            style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(228,228,228,0.35)', display: 'flex' }}>
                            {showCfm ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                    </div>
                </div>

                {/* Submit */}
                <button type="submit" disabled={!isFormValid || loading}
                    style={{ width: '100%', padding: '11px', background: isFormValid && !loading ? '#b8956a' : 'rgba(184,149,106,0.3)', border: 'none', color: isFormValid && !loading ? '#0c0c0c' : 'rgba(228,228,228,0.3)', fontSize: '13px', fontWeight: 700, cursor: isFormValid && !loading ? 'pointer' : 'default', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', transition: 'all 150ms ease', marginTop: '4px' }}>
                    {loading ? 'Creating account...' : <><span>Create Account</span><ArrowRight size={13} /></>}
                </button>
            </form>

            <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: 'rgba(228,228,228,0.35)' }}>
                Already have an account?{' '}
                <button onClick={onSwitch} style={{ background: 'none', border: 'none', color: '#b8956a', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px' }}>
                    Sign in
                </button>
            </p>
        </div>
    );
};

export default SignupForm;
