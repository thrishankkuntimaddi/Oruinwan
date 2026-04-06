import React from 'react';
import { Settings, HelpCircle, LogOut, ChevronRight, Shield } from 'lucide-react';
import { getAvatarUrl } from '../../../utils/avatarUtils';

const STATUS_CONFIG = {
    active: { dot: '#22c55e', label: 'Active',  activeBg: 'rgba(34,197,94,0.1)',  activeColor: '#22c55e' },
    away:   { dot: '#f59e0b', label: 'Away',    activeBg: 'rgba(245,158,11,0.1)', activeColor: '#f59e0b' },
    dnd:    { dot: '#ef4444', label: 'DND',     activeBg: 'rgba(239,68,68,0.1)',  activeColor: '#ef4444' },
};

const MainMenuView = ({ user, status, onStatusChange, onNavigate, onLogout }) => {
    return (
        <div style={{
            width: '256px', background: '#111111',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.75)',
            overflow: 'hidden', fontFamily: 'Inter, system-ui, sans-serif',
        }}>
            {/* ── Profile Header ── */}
            <div
                onClick={() => onNavigate('profile')}
                style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '16px', cursor: 'pointer',
                    borderBottom: '1px solid rgba(255,255,255,0.07)',
                    background: 'rgba(255,255,255,0.02)',
                    transition: 'background 150ms ease',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
            >
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.12)' }}>
                    <img src={getAvatarUrl(user)} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#e4e4e4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user?.username}
                    </div>
                    <div style={{ fontSize: '11px', color: 'rgba(228,228,228,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px', fontFamily: 'monospace' }}>
                        {user?.email}
                    </div>
                </div>
                <ChevronRight size={14} style={{ color: 'rgba(228,228,228,0.25)', flexShrink: 0 }} />
            </div>

            {/* ── Status Selector ── */}
            <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '3px', gap: '2px' }}>
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                        const active = status === key;
                        return (
                            <button
                                key={key}
                                onClick={e => { e.stopPropagation(); onStatusChange(key); }}
                                style={{
                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    gap: '5px', padding: '5px 4px', fontSize: '10px', fontWeight: 700,
                                    background: active ? cfg.activeBg : 'transparent',
                                    color: active ? cfg.activeColor : 'rgba(228,228,228,0.4)',
                                    border: `1px solid ${active ? cfg.dot + '40' : 'transparent'}`,
                                    cursor: 'pointer', transition: 'all 150ms ease',
                                    fontFamily: 'Inter, system-ui, sans-serif',
                                }}
                                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                            >
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
                                {cfg.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Menu Items ── */}
            <div style={{ padding: '6px' }}>
                {/* Help & Support */}
                <button
                    onClick={() => onNavigate('help')}
                    style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '9px 10px', fontSize: '13px', fontWeight: 500,
                        color: 'rgba(228,228,228,0.7)', background: 'transparent', border: 'none',
                        cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 150ms ease',
                        textAlign: 'left',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#e4e4e4'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(228,228,228,0.7)'; }}
                >
                    <HelpCircle size={15} style={{ color: 'rgba(228,228,228,0.35)', flexShrink: 0 }} />
                    Help &amp; Support
                </button>

                {/* Admin Dashboard (admin/owner only) */}
                {(user?.companyRole === 'admin' || user?.companyRole === 'owner') && (
                    <>
                        <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '4px 4px' }} />
                        <button
                            onClick={() => window.location.href = '/admin/company'}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '9px 10px', fontSize: '13px', fontWeight: 600,
                                color: '#b8956a', background: 'transparent', border: 'none',
                                cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 150ms ease',
                                textAlign: 'left',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(184,149,106,0.08)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <Shield size={15} style={{ color: '#b8956a', flexShrink: 0 }} />
                            Admin Dashboard
                        </button>
                    </>
                )}

                {/* Divider */}
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '4px 4px' }} />

                {/* Sign Out */}
                <button
                    onClick={onLogout}
                    style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '9px 10px', fontSize: '13px', fontWeight: 500,
                        color: 'rgba(228,228,228,0.6)', background: 'transparent', border: 'none',
                        cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 150ms ease',
                        textAlign: 'left',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.08)'; e.currentTarget.style.color = '#f87171'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(228,228,228,0.6)'; }}
                >
                    <LogOut size={15} style={{ flexShrink: 0, color: 'inherit' }} />
                    Sign Out
                </button>
            </div>
        </div>
    );
};

export default MainMenuView;
