import React, { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { CheckCircle, AlertCircle, ArrowRight, Loader } from "lucide-react";
import { API_BASE } from '@services/api';

const AcceptInvite = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    useAuth();

    const token = searchParams.get("token");
    const emailParam = searchParams.get("email");

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        if (!username || !password) {
            setError("Please fill in all fields");
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
                throw new Error(data.message || "Failed to accept invite");
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

    const styles = {
        root: {
            minHeight: '100vh',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-base, #0c0c0c)',
            fontFamily: 'var(--font, Inter, system-ui, sans-serif)',
            position: 'relative',
            color: 'var(--text-primary, #e4e4e4)',
            padding: '24px',
            boxSizing: 'border-box',
            overflow: 'hidden'
        },
        bgGlow: {
            position: 'absolute',
            top: '30%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '500px',
            height: '500px',
            background: 'radial-gradient(circle, var(--accent-dim, rgba(184,149,106,0.07)) 0%, transparent 70%)',
            pointerEvents: 'none',
            zIndex: 0
        },
        topBrand: {
            position: 'absolute',
            top: '24px',
            left: '28px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            zIndex: 10
        },
        card: {
            position: 'relative',
            zIndex: 1,
            width: '100%',
            maxWidth: '420px',
            background: 'var(--bg-surface, #111111)',
            border: '1px solid var(--border-default, #222222)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
            padding: '36px 32px',
            boxSizing: 'border-box'
        },
        title: {
            fontSize: '22px',
            fontWeight: 700,
            color: 'var(--text-primary, #e4e4e4)',
            letterSpacing: '-0.02em',
            margin: '0 0 8px 0',
            textAlign: 'center'
        },
        subtitle: {
            fontSize: '13px',
            color: 'var(--text-secondary, #7a7a7a)',
            textAlign: 'center',
            margin: '0 0 24px 0'
        },
        inputGroup: {
            marginBottom: '18px'
        },
        label: {
            display: 'block',
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--text-secondary, #7a7a7a)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: '6px'
        },
        input: {
            width: '100%',
            padding: '11px 14px',
            background: 'var(--bg-input, #141414)',
            border: '1px solid var(--border-default, #222222)',
            color: 'var(--text-primary, #e4e4e4)',
            fontSize: '13px',
            outline: 'none',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
            transition: 'border-color 150ms ease'
        },
        primaryBtn: {
            width: '100%',
            padding: '12px 16px',
            background: 'var(--accent, #b8956a)',
            color: '#0c0c0c',
            border: 'none',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 150ms ease',
            fontFamily: 'inherit',
            marginTop: '24px'
        },
        errorAlert: {
            background: 'rgba(224,82,82,0.1)',
            border: '1px solid rgba(224,82,82,0.3)',
            color: 'var(--state-danger, #e05252)',
            padding: '10px 14px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '20px'
        }
    };

    if (!token) {
        return (
            <div style={styles.root}>
                <div style={styles.bgGlow} />
                <div style={styles.card}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ width: '48px', height: '48px', background: 'rgba(224,82,82,0.1)', border: '1px solid rgba(224,82,82,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                            <AlertCircle size={22} style={{ color: '#e05252' }} />
                        </div>
                        <h2 style={styles.title}>Invalid Invite</h2>
                        <p style={styles.subtitle}>Missing or expired invitation token.</p>
                        <button
                            onClick={() => navigate("/")}
                            style={styles.primaryBtn}
                            onMouseEnter={e => e.currentTarget.style.background = '#c9a87c'}
                            onMouseLeave={e => e.currentTarget.style.background = '#b8956a'}
                        >
                            Return Home
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div style={styles.root}>
                <div style={styles.bgGlow} />
                <div style={styles.card}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ width: '48px', height: '48px', background: 'rgba(90,186,138,0.1)', border: '1px solid rgba(90,186,138,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                            <CheckCircle size={24} style={{ color: '#5aba8a' }} />
                        </div>
                        <h2 style={styles.title}>Welcome Aboard!</h2>
                        <p style={styles.subtitle}>Your account has been created and you've joined the team.</p>
                        <p style={{ fontSize: '11px', color: 'rgba(228,228,228,0.3)', margin: 0 }}>Redirecting to login...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.root}>
            <div style={styles.bgGlow} />

            <div style={styles.topBrand} onClick={() => navigate('/')}>
                <img src="/icons/oruinwan-128.png" alt="Oruinwan" style={{ width: '28px', height: '28px' }} />
                <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Oruinwan</span>
            </div>

            <div style={styles.card}>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <h2 style={styles.title}>Accept Invitation</h2>
                    {emailParam && (
                        <p style={styles.subtitle}>
                            Set up your account to join <span style={{ color: '#b8956a', fontWeight: 600 }}>{emailParam}</span>
                        </p>
                    )}
                </div>

                {error && (
                    <div style={styles.errorAlert}>
                        <AlertCircle size={15} />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Full Name</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            style={styles.input}
                            placeholder="Full Name"
                            onFocus={e => e.currentTarget.style.borderColor = 'rgba(184,149,106,0.5)'}
                            onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
                            required
                        />
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={styles.input}
                            placeholder="••••••••"
                            onFocus={e => e.currentTarget.style.borderColor = 'rgba(184,149,106,0.5)'}
                            onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
                            required
                        />
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Confirm Password</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            style={styles.input}
                            placeholder="••••••••"
                            onFocus={e => e.currentTarget.style.borderColor = 'rgba(184,149,106,0.5)'}
                            onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            ...styles.primaryBtn,
                            opacity: loading ? 0.7 : 1,
                            cursor: loading ? 'not-allowed' : 'pointer'
                        }}
                        onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#c9a87c'; }}
                        onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#b8956a'; }}
                    >
                        {loading ? <Loader className="animate-spin" size={18} /> : (
                            <>
                                <span>Complete Setup</span>
                                <ArrowRight size={15} />
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AcceptInvite;

