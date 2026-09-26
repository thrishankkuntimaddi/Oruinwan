import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import * as Icons from "lucide-react";
import api from '@services/api';
import logger from '../utils/logger';

const JoinWorkspace = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const token = searchParams.get('token');

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [workspaceDetails, setWorkspaceDetails] = useState(null);
    const [joining, setJoining] = useState(false);

    useEffect(() => {
        if (!token) {
            setError("Invalid invitation link");
            setLoading(false);
            return;
        }

        const fetchDetails = async () => {
            try {
                const response = await api.get(`/api/workspaces/invite/${token}`);
                setWorkspaceDetails(response.data);
                setLoading(false);
            } catch (err) {
                setError(err.response?.data?.message || err.message || "Failed to fetch invitation details");
                setLoading(false);
            }
        };

        fetchDetails();
    }, [token]);

    const handleJoin = async () => {
        if (!user) {
            localStorage.setItem('pendingInvite', token);
            navigate('/login');
            return;
        }

        setJoining(true);
        try {
            const response = await api.post('/api/workspaces/join', { token });
            const data = response.data;

            localStorage.setItem('currentWorkspace', data.workspace.id);
            localStorage.removeItem('pendingInvite');

            navigate(`/workspace/${data.workspace.id}/home`, {
                state: {
                    message: `Successfully joined ${data.workspace.name}!`
                }
            });
        } catch (err) {
            logger.error('Join workspace error:', err);
            setError(err.response?.data?.message || err.message || "Failed to join workspace");
            setJoining(false);
        }
    };

    const renderWorkspaceIcon = (iconName) => {
        if (!iconName) return <Icons.Rocket size={24} style={{ color: 'var(--accent, #b8956a)' }} />;
        const IconComponent = Icons[iconName.charAt(0).toUpperCase() + iconName.slice(1)];
        if (IconComponent) {
            return <IconComponent size={24} style={{ color: 'var(--accent, #b8956a)' }} />;
        }
        return <Icons.Hash size={24} style={{ color: 'var(--accent, #b8956a)' }} />;
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
            maxWidth: '440px',
            background: 'var(--bg-surface, #111111)',
            border: '1px solid var(--border-default, #222222)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
            padding: '36px 32px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center'
        },
        iconBox: {
            width: '52px',
            height: '52px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--accent-dim, rgba(184,149,106,0.12))',
            border: '1px solid rgba(184,149,106,0.3)',
            marginBottom: '20px',
            flexShrink: 0
        },
        title: {
            fontSize: '22px',
            fontWeight: 700,
            color: 'var(--text-primary, #e4e4e4)',
            letterSpacing: '-0.02em',
            margin: '0 0 8px 0'
        },
        accentText: {
            color: 'var(--accent, #b8956a)'
        },
        inviterBadge: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            background: 'var(--bg-input, #141414)',
            border: '1px solid var(--border-subtle, #191919)',
            fontSize: '12px',
            color: 'var(--text-secondary, #7a7a7a)',
            marginBottom: '16px'
        },
        description: {
            fontSize: '13px',
            color: 'var(--text-secondary, #7a7a7a)',
            lineHeight: 1.6,
            margin: '0 0 24px 0',
            maxWidth: '360px'
        },
        statsGrid: {
            width: '100%',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginBottom: '28px'
        },
        statBox: {
            background: 'var(--bg-input, #141414)',
            border: '1px solid var(--border-subtle, #191919)',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px'
        },
        statValue: {
            fontSize: '18px',
            fontWeight: 700,
            color: 'var(--text-primary, #e4e4e4)'
        },
        statLabel: {
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: 'var(--text-secondary, #7a7a7a)',
            textTransform: 'uppercase'
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
            fontFamily: 'inherit'
        },
        secondaryBtn: {
            width: '100%',
            padding: '10px 16px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary, #7a7a7a)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'color 150ms ease',
            marginTop: '8px',
            fontFamily: 'inherit'
        },
        footerText: {
            marginTop: '24px',
            fontSize: '11px',
            color: 'var(--text-secondary, #7a7a7a)',
            letterSpacing: '0.05em'
        }
    };

    if (loading) {
        return (
            <div style={styles.root}>
                <div style={styles.bgGlow} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', zIndex: 1 }}>
                    <img src="/icons/oruinwan-128.png" alt="Oruinwan" style={{ width: '32px', height: '32px', opacity: 0.5 }} />
                    <div style={{ height: '2px', width: '80px', background: 'var(--accent-dim, rgba(184,149,106,0.2))', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', left: '-40px', height: '2px', width: '40px', background: 'var(--accent, #b8956a)', animation: 'slideBar 1.2s ease-in-out infinite' }} />
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary, #7a7a7a)', margin: 0 }}>Verifying invitation...</p>
                </div>
                <style>{`@keyframes slideBar { from{left:-40px} to{left:100%} }`}</style>
            </div>
        );
    }

    if (error) {
        return (
            <div style={styles.root}>
                <div style={styles.bgGlow} />
                <div style={styles.topBrand} onClick={() => navigate('/workspaces')}>
                    <img src="/icons/oruinwan-128.png" alt="Oruinwan" style={{ width: '28px', height: '28px' }} />
                    <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Oruinwan</span>
                </div>

                <div style={{ ...styles.card, border: '1px solid rgba(224,82,82,0.3)' }}>
                    <div style={{ ...styles.iconBox, background: 'rgba(224,82,82,0.1)', border: '1px solid rgba(224,82,82,0.3)' }}>
                        <Icons.AlertCircle size={22} style={{ color: 'var(--state-danger, #e05252)' }} />
                    </div>
                    <h1 style={styles.title}>Invitation Error</h1>
                    <p style={{ ...styles.description, color: 'var(--text-secondary)', marginBottom: '24px' }}>{error}</p>
                    <button
                        onClick={() => navigate('/workspaces')}
                        style={styles.primaryBtn}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-hover, #c9a87c)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'var(--accent, #b8956a)'}
                    >
                        Go to Workspaces
                    </button>
                </div>
            </div>
        );
    }

    if (!workspaceDetails) return null;

    return (
        <div style={styles.root}>
            <div style={styles.bgGlow} />

            <div style={styles.topBrand} onClick={() => navigate('/workspaces')}>
                <img src="/icons/oruinwan-128.png" alt="Oruinwan" style={{ width: '28px', height: '28px' }} />
                <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Oruinwan</span>
            </div>

            <div style={styles.card}>
                <div style={styles.iconBox}>
                    {renderWorkspaceIcon(workspaceDetails.workspaceIcon)}
                </div>

                <h1 style={styles.title}>
                    Join <span style={styles.accentText}>{workspaceDetails.workspaceName}</span>
                </h1>

                <div style={styles.inviterBadge}>
                    <span>Invited by</span>
                    <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{workspaceDetails.invitedBy}</strong>
                </div>

                {workspaceDetails.workspaceDescription && (
                    <p style={styles.description}>
                        {workspaceDetails.workspaceDescription}
                    </p>
                )}

                <div style={styles.statsGrid}>
                    <div style={styles.statBox}>
                        <Icons.Users size={16} style={{ color: 'var(--accent, #b8956a)', marginBottom: '2px' }} />
                        <span style={styles.statValue}>{workspaceDetails.memberCount}</span>
                        <span style={styles.statLabel}>Members</span>
                    </div>
                    <div style={styles.statBox}>
                        <Icons.Shield size={16} style={{ color: 'var(--accent, #b8956a)', marginBottom: '2px' }} />
                        <span style={{ ...styles.statValue, textTransform: 'capitalize' }}>{workspaceDetails.role}</span>
                        <span style={styles.statLabel}>Your Role</span>
                    </div>
                </div>

                <div style={{ width: '100%' }}>
                    <button
                        onClick={handleJoin}
                        disabled={joining}
                        style={{
                            ...styles.primaryBtn,
                            opacity: joining ? 0.7 : 1,
                            cursor: joining ? 'not-allowed' : 'pointer'
                        }}
                        onMouseEnter={e => { if (!joining) e.currentTarget.style.background = 'var(--accent-hover, #c9a87c)'; }}
                        onMouseLeave={e => { if (!joining) e.currentTarget.style.background = 'var(--accent, #b8956a)'; }}
                    >
                        {joining ? (
                            <>
                                <Icons.Loader size={16} className="animate-spin" />
                                Joining...
                            </>
                        ) : (
                            <>
                                {user ? 'Join Workspace' : 'Sign In & Join'}
                                <Icons.ArrowRight size={15} />
                            </>
                        )}
                    </button>

                    <button
                        onClick={() => navigate('/workspaces')}
                        disabled={joining}
                        style={styles.secondaryBtn}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                    >
                        No thanks, maybe later
                    </button>
                </div>

                {!user && (
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '20px', margin: '20px 0 0 0' }}>
                        Secure Invite System • Sign in or create an account to proceed
                    </p>
                )}
            </div>

            <div style={styles.footerText}>
                © 2026 Oruinwan Inc.
            </div>
        </div>
    );
};

export default JoinWorkspace;


