import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '@services/api';
import { Loader, CheckCircle, AlertCircle } from 'lucide-react';

export default function JoinChannel() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('loading');
    const [message, setMessage] = useState('');
    const [channelData, setChannelData] = useState(null);

    useEffect(() => {
        const joinChannel = async () => {
            const channelId = searchParams.get('channel');
            const workspaceId = searchParams.get('workspace');

            if (!channelId || !workspaceId) {
                setStatus('error');
                setMessage('Invalid channel link');
                return;
            }

            try {
                const res = await api.post(`/api/channels/${channelId}/join-via-link`);
                setStatus('success');
                setMessage(res.data.message);
                setChannelData(res.data.channel);

                setTimeout(() => {
                    navigate(`/workspace/${workspaceId}/home/channel/${channelId}`);
                }, 2000);
            } catch (err) {
                setStatus('error');
                setMessage(err.response?.data?.message || 'Failed to join channel');
            }
        };

        joinChannel();
    }, [searchParams, navigate]);

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
        card: {
            position: 'relative',
            zIndex: 1,
            width: '100%',
            maxWidth: '420px',
            background: 'var(--bg-surface, #111111)',
            border: '1px solid var(--border-default, #222222)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
            padding: '36px 32px',
            boxSizing: 'border-box',
            textAlign: 'center'
        },
        title: {
            fontSize: '22px',
            fontWeight: 700,
            color: 'var(--text-primary, #e4e4e4)',
            letterSpacing: '-0.02em',
            margin: '0 0 8px 0'
        },
        subtitle: {
            fontSize: '13px',
            color: 'var(--text-secondary, #7a7a7a)',
            margin: '0 0 20px 0'
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
            transition: 'all 150ms ease',
            fontFamily: 'inherit',
            marginTop: '16px'
        }
    };

    return (
        <div style={styles.root}>
            <div style={styles.bgGlow} />

            <div style={styles.card}>
                {status === 'loading' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                        <div style={{ width: '44px', height: '44px', background: 'var(--accent-dim, rgba(184,149,106,0.12))', border: '1px solid rgba(184,149,106,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Loader size={20} className="animate-spin" style={{ color: 'var(--accent, #b8956a)' }} />
                        </div>
                        <h2 style={styles.title}>Joining Channel...</h2>
                        <p style={styles.subtitle}>Connecting you to the channel workspace</p>
                    </div>
                )}

                {status === 'success' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ width: '48px', height: '48px', background: 'rgba(90,186,138,0.1)', border: '1px solid rgba(90,186,138,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                            <CheckCircle size={24} style={{ color: 'var(--state-success, #5aba8a)' }} />
                        </div>
                        <h2 style={styles.title}>Success!</h2>
                        <p style={styles.subtitle}>{message}</p>
                        <p style={{ fontSize: '11px', color: 'var(--accent, #b8956a)', margin: 0 }}>
                            Redirecting to #{channelData?.name || 'channel'}...
                        </p>
                    </div>
                )}

                {status === 'error' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ width: '48px', height: '48px', background: 'rgba(224,82,82,0.1)', border: '1px solid rgba(224,82,82,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                            <AlertCircle size={22} style={{ color: 'var(--state-danger, #e05252)' }} />
                        </div>
                        <h2 style={styles.title}>Unable to Join</h2>
                        <p style={styles.subtitle}>{message}</p>
                        <button
                            onClick={() => navigate('/workspaces')}
                            style={styles.primaryBtn}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-hover, #c9a87c)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'var(--accent, #b8956a)'}
                        >
                            Go to Workspaces
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}


