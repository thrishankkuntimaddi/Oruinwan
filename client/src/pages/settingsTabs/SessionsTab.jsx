import React, { useState, useCallback } from 'react';
import { Smartphone, Monitor, LogOut, RefreshCw, MapPin, Clock, Globe, AlertCircle } from 'lucide-react';
import Card from './Card';
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';

const S = { font: { fontFamily: 'Inter, system-ui, -apple-system, sans-serif' } };

const SessionsTab = ({ sessions: initialSessions, handleLogoutSession, handleLogoutOthers, handleLogout }) => {
    const { showToast } = useToast();
    const [sessions, setSessions] = useState(initialSessions || []);
    const [refreshing, setRefreshing] = useState(false);
    const [revokingId, setRevokingId] = useState(null);

    const refreshSessions = useCallback(async () => {
        setRefreshing(true);
        try {
            const { data } = await api.get('/api/auth/sessions');
            setSessions(Array.isArray(data) ? data : []);
        } catch { showToast('Failed to refresh sessions', 'error'); }
        finally { setRefreshing(false); }
    }, [showToast]);

    const revokeSession = async (sessionId) => {
        setRevokingId(sessionId);
        try {
            await handleLogoutSession(sessionId);
            setSessions(prev => prev.filter(s => s.id !== sessionId));
            showToast('Session revoked', 'success');
        } catch { showToast('Failed to revoke session', 'error'); }
        finally { setRevokingId(null); }
    };

    const logoutOthers = async () => {
        try { await handleLogoutOthers(); await refreshSessions(); } catch { }
    };

    const formatLastActive = (dateStr) => {
        if (!dateStr) return 'Unknown';
        const diff = Date.now() - new Date(dateStr).getTime();
        const m = Math.floor(diff / 60000);
        if (m < 1) return 'Just now';
        if (m < 60) return `${m}m ago`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}h ago`;
        return new Date(dateStr).toLocaleDateString();
    };

    const refreshAction = (
        <button
            onClick={refreshSessions}
            disabled={refreshing}
            style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 12, color: 'var(--text-muted)',
                background: 'none', border: 'none',
                cursor: refreshing ? 'not-allowed' : 'pointer',
                transition: 'color 150ms ease',
                ...S.font,
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
            <RefreshCw size={12} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
        </button>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card title="Active Sessions" subtitle="Devices logged into your account" action={refreshAction}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {Array.isArray(sessions) && sessions.map(session => (
                        <div
                            key={session.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 12px',
                                border: `1px solid ${session.current ? 'rgba(184,149,106,0.3)' : 'var(--border-default)'}`,
                                borderRadius: 2,
                                backgroundColor: session.current ? 'rgba(184,149,106,0.06)' : 'var(--bg-active)',
                                transition: 'background-color 150ms ease',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 2,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    backgroundColor: session.current ? 'rgba(184,149,106,0.15)' : 'var(--bg-hover)',
                                    color: session.current ? 'var(--accent)' : 'var(--text-muted)',
                                }}>
                                    {session.os === 'mobile' ? <Smartphone size={15} /> : <Monitor size={15} />}
                                </div>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', ...S.font }}>
                                            {session.device || 'Unknown Device'}
                                            {session.browser && (
                                                <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · {session.browser}</span>
                                            )}
                                        </span>
                                        {session.current && (
                                            <span style={{
                                                fontSize: 10,
                                                padding: '1px 7px',
                                                backgroundColor: 'rgba(184,149,106,0.15)',
                                                color: 'var(--accent)',
                                                fontWeight: 700,
                                                borderRadius: 2,
                                                letterSpacing: '0.05em',
                                                ...S.font,
                                            }}>
                                                This device
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 3 }}>
                                        {session.location && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-muted)', ...S.font }}>
                                                <MapPin size={10} />{session.location}
                                            </span>
                                        )}
                                        {session.lastActive && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-muted)', ...S.font }}>
                                                <Clock size={10} />{formatLastActive(session.lastActive)}
                                            </span>
                                        )}
                                        {session.ip && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-muted)', ...S.font }}>
                                                <Globe size={10} />{session.ip}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {session.current ? (
                                <button
                                    onClick={handleLogout}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '6px 12px', fontSize: 12, fontWeight: 500,
                                        color: 'var(--state-danger)',
                                        backgroundColor: 'rgba(224,82,82,0.08)',
                                        border: '1px solid rgba(224,82,82,0.25)',
                                        borderRadius: 2, cursor: 'pointer',
                                        transition: 'background-color 150ms ease',
                                        ...S.font,
                                    }}
                                >
                                    <LogOut size={12} /> Sign Out
                                </button>
                            ) : (
                                <button
                                    onClick={() => revokeSession(session.id)}
                                    disabled={revokingId === session.id}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '6px 12px', fontSize: 12, fontWeight: 500,
                                        color: 'var(--state-danger)',
                                        background: 'none',
                                        border: '1px solid transparent',
                                        borderRadius: 2, cursor: revokingId === session.id ? 'not-allowed' : 'pointer',
                                        opacity: revokingId === session.id ? 0.5 : 1,
                                        transition: 'background-color 150ms ease, border-color 150ms ease',
                                        ...S.font,
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.backgroundColor = 'rgba(224,82,82,0.08)';
                                        e.currentTarget.style.borderColor = 'rgba(224,82,82,0.25)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                        e.currentTarget.style.borderColor = 'transparent';
                                    }}
                                >
                                    {revokingId === session.id ? 'Revoking…' : 'Revoke'}
                                </button>
                            )}
                        </div>
                    ))}

                    {(!sessions || sessions.length === 0) && (
                        <div style={{ textAlign: 'center', padding: '32px 0' }}>
                            <AlertCircle size={28} style={{ color: 'var(--text-muted)', margin: '0 auto 8px' }} />
                            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4, ...S.font }}>No active sessions found</p>
                            <button
                                onClick={refreshSessions}
                                style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', ...S.font }}
                            >Refresh</button>
                        </div>
                    )}
                </div>

                {sessions && sessions.length > 1 && (
                    <div style={{
                        marginTop: 16,
                        paddingTop: 12,
                        borderTop: '1px solid var(--border-default)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', ...S.font }}>
                            {sessions.length - 1} other active {sessions.length - 1 === 1 ? 'session' : 'sessions'}
                        </span>
                        <button
                            onClick={logoutOthers}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '6px 12px', fontSize: 12, fontWeight: 500,
                                color: 'var(--state-danger)',
                                backgroundColor: 'rgba(224,82,82,0.08)',
                                border: '1px solid rgba(224,82,82,0.25)',
                                borderRadius: 2, cursor: 'pointer',
                                transition: 'background-color 150ms ease',
                                ...S.font,
                            }}
                        >
                            <LogOut size={12} /> Sign Out All Others
                        </button>
                    </div>
                )}
            </Card>

            <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: 12,
                backgroundColor: 'rgba(184,149,106,0.06)',
                border: '1px solid rgba(184,149,106,0.25)',
                borderRadius: 2,
            }}>
                <AlertCircle size={14} style={{ color: 'var(--accent)', marginTop: 1, flexShrink: 0 }} />
                <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', margin: 0, marginBottom: 2, ...S.font }}>Unrecognised device?</p>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5, ...S.font }}>Revoke it immediately and change your password in the Security tab.</p>
                </div>
            </div>
        </div>
    );
};

export default SessionsTab;
