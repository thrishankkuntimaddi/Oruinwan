// LoginForm.jsx — Monolith Flow Design System
import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useGoogleLogin } from '@react-oauth/google';
import api from '@services/api';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';

// ── OAuth Icons ────────────────────────────────────────────────────────────────
const GoogleIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
);

const GitHubIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-1.455-3.795-1.455-.54-1.38-1.335-1.755-1.335-1.755-1.095-.75.09-.735.09-.735 1.215.09 1.845 1.245 1.845 1.245 1.08 1.86 2.805 1.32 3.495 1.005.105-.78.42-1.32.765-1.62-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405 1.02 0 2.04.135 3 .405 2.28-1.56 3.285-1.245 3.285-1.245.675 1.65.255 2.88.135 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.285 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
);

const LinkedInIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#0077b5">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
);

// ── Shared input style ─────────────────────────────────────────────────────────
const inp = (focused, hasError) => ({
    width: '100%', boxSizing: 'border-box',
    padding: '10px 36px 10px 12px',
    background: '#141414',
    border: `1px solid ${hasError ? '#e05252' : focused ? 'rgba(184,149,106,0.5)' : 'rgba(255,255,255,0.08)'}`,
    color: '#e4e4e4', fontSize: '13px', outline: 'none',
    fontFamily: 'Inter, system-ui, sans-serif',
    transition: 'border-color 150ms ease',
});

const Label = ({ children }) => (
    <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(228,228,228,0.4)', display: 'block', marginBottom: '6px' }}>
        {children}
    </label>
);

// ── Component ──────────────────────────────────────────────────────────────────
const LoginForm = ({ onSwitch, initialEmail = '' }) => {
    const [formData, setFormData] = useState({ email: initialEmail, password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [focusedField, setFocusedField] = useState(null);
    const [loading, setLoading] = useState(false);
    const { login, setUser } = useContext(AuthContext);
    const { showToast } = useToast();
    const navigate = useNavigate();

    const isFormValid = formData.email && formData.password.length >= 6;

    const handleChange = e => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));

    const handleSubmit = async e => {
        e.preventDefault();
        if (!isFormValid) return;
        setLoading(true);
        try {
            const response = await login(formData.email, formData.password);
            showToast('Login successful!', 'success');
            await new Promise(r => setTimeout(r, 100));

            const pendingInvite = localStorage.getItem('pendingInvite');
            if (pendingInvite) { navigate(`/join-workspace?token=${pendingInvite}`); return; }
            if (response.redirectTo) { navigate(response.redirectTo); return; }
            if (response?.user?.companyStatus === 'pending' || response?.user?.companyStatus === 'pending_verification') { navigate('/pending-verification'); return; }

            const isPlatformAdmin = response?.user?.roles?.includes('chttrix_admin');
            if (isPlatformAdmin) { navigate('/chttrix-admin'); return; }

            const companyRole = response?.user?.companyRole;
            if (companyRole === 'owner') { navigate('/owner/dashboard'); return; }
            if (companyRole === 'admin') { navigate('/admin/dashboard'); return; }
            if (companyRole === 'manager') { navigate('/manager/dashboard'); return; }
            navigate('/workspaces');
        } catch (err) {
            if (err.response?.data?.requiresReactivation) {
                showToast('Account deactivated. Check your email for reactivation code.', 'info');
                navigate(`/reactivate?email=${encodeURIComponent(formData.email)}`);
                return;
            }
            showToast(err.message || 'Login failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    const googleLogin = useGoogleLogin({
        onSuccess: async tokenResponse => {
            try {
                const res = await api.post('/api/auth/google-login', { accessToken: tokenResponse.access_token });
                localStorage.setItem('accessToken', res.data.accessToken);
                setUser(res.data.user);
                showToast('Google login successful!', 'success');
                if (res.data.requiresPasswordSetup || res.data.isFirstLogin) {
                    localStorage.setItem('oauthPasswordSetupRequired', 'true');
                    localStorage.setItem('oauthProvider', 'google');
                    navigate('/set-password'); return;
                }
                const isPlatformAdmin = res.data.user?.roles?.includes('chttrix_admin');
                if (isPlatformAdmin) navigate('/chttrix-admin');
                else if (res.data.user?.companyRole === 'owner') navigate('/owner/dashboard');
                else navigate('/workspaces');
            } catch (err) {
                showToast('Google login failed', 'error');
            }
        },
        onError: () => showToast('Login Failed', 'error'),
    });

    return (
        <div>
            <div style={{ marginBottom: '28px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#e4e4e4', letterSpacing: '-0.02em', marginBottom: '6px' }}>Welcome back</h2>
                <p style={{ fontSize: '13px', color: 'rgba(228,228,228,0.4)' }}>Enter your credentials to access your workspace.</p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                    <Label>Email</Label>
                    <input name="email" type="email" placeholder="you@company.com" required
                        value={formData.email} onChange={handleChange}
                        onFocus={() => setFocusedField('email')} onBlur={() => setFocusedField(null)}
                        autoComplete="email"
                        style={inp(focusedField === 'email')} />
                </div>

                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(228,228,228,0.4)' }}>Password</label>
                        <button type="button" onClick={() => navigate('/forgot-password')}
                            style={{ fontSize: '11px', color: '#b8956a', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                            Forgot password?
                        </button>
                    </div>
                    <div style={{ position: 'relative' }}>
                        <input name="password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" required
                            value={formData.password} onChange={handleChange}
                            onFocus={() => setFocusedField('password')} onBlur={() => setFocusedField(null)}
                            autoComplete="current-password"
                            style={{ ...inp(focusedField === 'password'), paddingRight: '40px' }} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)}
                            style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(228,228,228,0.35)', display: 'flex', alignItems: 'center' }}>
                            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                    </div>
                </div>

                <button type="submit" disabled={!isFormValid || loading}
                    style={{ width: '100%', padding: '11px', background: isFormValid ? '#b8956a' : 'rgba(184,149,106,0.3)', border: 'none', color: isFormValid ? '#0c0c0c' : 'rgba(228,228,228,0.3)', fontSize: '13px', fontWeight: 700, cursor: isFormValid && !loading ? 'pointer' : 'default', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', transition: 'all 150ms ease', marginTop: '4px' }}>
                    {loading ? 'Signing in...' : <><span>Sign In</span><ArrowRight size={13} /></>}
                </button>
            </form>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '24px 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(228,228,228,0.2)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Or continue with</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
            </div>

            {/* OAuth buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px' }}>
                {[
                    { icon: <GoogleIcon />, label: 'Google', onClick: googleLogin },
                    { icon: <GitHubIcon />, label: 'GitHub', onClick: () => window.location.href = `${import.meta.env.VITE_BACKEND_URL}/api/auth/github` },
                    { icon: <LinkedInIcon />, label: 'LinkedIn', onClick: () => window.location.href = `${import.meta.env.VITE_BACKEND_URL}/api/auth/linkedin` },
                ].map(btn => (
                    <button key={btn.label} type="button" onClick={btn.onClick}
                        style={{ padding: '9px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#e4e4e4', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', fontFamily: 'inherit', transition: 'all 150ms ease' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}>
                        {btn.icon}
                    </button>
                ))}
            </div>

        </div>
    );
};

export default LoginForm;
