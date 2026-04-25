import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useIsMobile } from '../hooks/useIsMobile';
import MobileBottomNav from '../components/layout/MobileBottomNav';
import {
    User, Lock, Palette, Bell, Globe, Shield, Laptop, Settings as SettingsIcon,
    ChevronRight, Search, ArrowLeft, X, Menu, Plug
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import api from '@services/api';

import ProfileTab from './settingsTabs/ProfileTab';
import NotificationsTab from './settingsTabs/NotificationsTab';
import PrivacyTab from './settingsTabs/PrivacyTab';
import RegionTab from './settingsTabs/RegionTab';
import AppearanceTab from './settingsTabs/AppearanceTab';
import SecurityTab from './settingsTabs/SecurityTab';
import SessionsTab from './settingsTabs/SessionsTab';
import AdvancedTab from './settingsTabs/AdvancedTab';
import IntegrationsTab from './settingsTabs/IntegrationsTab';
import ComplianceTab from './settingsTabs/ComplianceTab';

const S = {
    font: { fontFamily: 'Inter, system-ui, -apple-system, sans-serif' },
};

const NAV_SECTIONS = [
    { id: 'profile', label: 'My Profile', icon: User, description: 'Name, photo, bio' },
    { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Email & push alerts' },
    { id: 'privacy', label: 'Privacy & Safety', icon: Lock, description: 'Visibility & data' },
    { id: 'region', label: 'Language & Region', icon: Globe, description: 'Timezone & locale' },
    { id: 'appearance', label: 'Appearance', icon: Palette, description: 'Theme & font size' },
    { id: 'security', label: 'Security', icon: Shield, description: 'Password & 2FA' },
    { id: 'sessions', label: 'Sessions', icon: Laptop, description: 'Active devices' },
    { id: 'integrations', label: 'Integrations', icon: Plug, description: 'GitHub, Slack, AI & more' },
    { id: 'compliance', label: 'Compliance & Privacy', icon: Shield, description: 'GDPR, audit logs, retention' },
    { id: 'advanced', label: 'Advanced', icon: SettingsIcon, description: 'Account & data' },
];

const Settings = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, refreshUser, logout } = useAuth();
    const { showToast } = useToast();
    const { theme, toggleTheme } = useTheme();

    const isMobile = useIsMobile();
    const [activeSection, setActiveSection] = useState('profile');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [sessions, setSessions] = useState([]);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [workspaces, setWorkspaces] = useState([]);
    const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');

    const [notifications, setNotifications] = useState({
        marketingEmails: false, securityEmails: true, productUpdates: true,
        dmPush: true, mentionPush: true, threadPush: false, soundEffects: true,
    });
    const [privacy, setPrivacy] = useState({
        readReceipts: true, typingIndicators: true, allowDiscovery: false, dataSharing: false,
    });
    const [region, setRegion] = useState({
        language: 'en', timezone: 'auto', dateFormat: 'MM/DD/YYYY',
    });
    const [profileData, setProfileData] = useState({
        username: '', phone: '', phoneCode: '+91', about: '',
    });
    const [passwordData, setPasswordData] = useState({
        currentPassword: '', newPassword: '', confirmPassword: '',
    });
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);

    useEffect(() => {
        if (user) {
            setProfileData({
                username: user.username || '',
                phone: user.phone || '',
                phoneCode: user.phoneCode || '+91',
                about: user.profile?.about || '',
            });
        }
        loadSessions();
        loadWorkspaces();
    }, [user]);

    const loadSessions = async () => {
        try {
            const { data } = await api.get('/api/auth/sessions');
            setSessions(Array.isArray(data) ? data : []);
        } catch { setSessions([]); }
    };

    const loadWorkspaces = async () => {
        try {
            const { data } = await api.get('/api/workspaces/my');
            const ws = data.workspaces || [];
            setWorkspaces(ws);
            if (ws.length > 0 && !selectedWorkspaceId) setSelectedWorkspaceId(ws[0].id);
        } catch {  }
    };

    const handleProfileUpdate = async () => {
        setLoading(true);
        try {
            await api.put('/api/auth/me', profileData);
            showToast('Profile updated', 'success');
            await refreshUser();
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to update profile', 'error');
        } finally { setLoading(false); }
    };

    const handlePasswordChange = async () => {
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            showToast('Passwords do not match', 'error'); return;
        }
        if (passwordData.newPassword.length < 8) {
            showToast('Password must be at least 8 characters', 'error'); return;
        }
        setLoading(true);
        try {
            await api.put('/api/auth/me/password', {
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword,
            });
            showToast('Password changed', 'success');
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to change password', 'error');
        } finally { setLoading(false); }
    };

    const handleLogoutSession = async (sessionId) => {
        await api.delete(`/api/auth/sessions/${sessionId}`);
        loadSessions();
    };
    const handleLogoutOthers = async () => {
        await api.delete('/api/auth/sessions/others');
        loadSessions();
    };
    const handleLogout = async () => {
        try { await logout(); navigate('/login'); }
        catch { showToast('Failed to logout', 'error'); }
    };

    const handleBackNavigation = () => {
        const from = location.state?.from;
        if (from?.startsWith('/workspace/')) navigate(from);
        else navigate(-1);
    };

    const filteredSections = useMemo(() => {
        if (!searchQuery) return NAV_SECTIONS;
        const q = searchQuery.toLowerCase();
        return NAV_SECTIONS.filter(s =>
            s.label.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
        );
    }, [searchQuery]);

    const activeLabel = NAV_SECTIONS.find(s => s.id === activeSection)?.label || '';

    return (
        <div style={{
            height: '100vh',
            overflow: 'hidden',
            backgroundColor: 'var(--bg-base)',
            display: 'flex',
            ...S.font,
            color: 'var(--text-primary)',
            paddingBottom: isMobile ? 'calc(56px + env(safe-area-inset-bottom))' : 0,
        }}>

            {}
            <aside style={{
                position: 'fixed',
                top: 0,
                left: 0,
                bottom: 0,
                zIndex: 30,
                width: 240,
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'var(--bg-surface)',
                borderRight: '1px solid var(--border-default)',
                transition: 'transform 200ms ease',
                transform: mobileSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
            }}
                className="settings-sidebar"
            >
                {}
                <div style={{
                    height: 48,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 16px',
                    borderBottom: '1px solid var(--border-default)',
                    gap: 12,
                    flexShrink: 0,
                }}>
                    <button
                        onClick={handleBackNavigation}
                        title="Go back"
                        style={{
                            padding: 6, borderRadius: 2, background: 'none', border: 'none',
                            cursor: 'pointer', color: 'var(--text-muted)',
                            display: 'flex', alignItems: 'center',
                            transition: 'color 150ms ease',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                        <ArrowLeft size={16} />
                    </button>
                    <img src="/chttrix-logo.jpg" alt="Logo" style={{ width: 20, height: 20, borderRadius: 2 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Chttrix</span>
                    <span style={{
                        marginLeft: 'auto',
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.12em',
                        color: 'var(--text-muted)',
                    }}>Settings</span>
                </div>

                {}
                <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
                    <p style={{
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.12em',
                        color: 'var(--text-muted)',
                        padding: '6px 8px',
                        marginBottom: 4,
                    }}>Account</p>
                    {filteredSections.map((section) => {
                        const Icon = section.icon;
                        const isActive = activeSection === section.id;
                        return (
                            <button
                                key={section.id}
                                onClick={() => {
                                    setActiveSection(section.id);
                                    setMobileSidebarOpen(false);
                                }}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    padding: '8px 10px',
                                    borderRadius: 2,
                                    marginBottom: 2,
                                    textAlign: 'left',
                                    background: isActive ? 'var(--bg-active)' : 'none',
                                    border: isActive ? '1px solid var(--border-default)' : '1px solid transparent',
                                    cursor: 'pointer',
                                    transition: 'background 150ms ease, border-color 150ms ease',
                                    ...S.font,
                                }}
                                onMouseEnter={e => {
                                    if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)';
                                }}
                                onMouseLeave={e => {
                                    if (!isActive) e.currentTarget.style.background = 'none';
                                }}
                            >
                                <Icon
                                    size={16}
                                    style={{
                                        flexShrink: 0,
                                        color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                                        transition: 'color 150ms ease',
                                    }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        fontSize: 13,
                                        fontWeight: isActive ? 600 : 400,
                                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                                        lineHeight: 1.3,
                                        transition: 'color 150ms ease',
                                    }}>{section.label}</div>
                                    <div style={{
                                        fontSize: 11,
                                        color: 'var(--text-muted)',
                                        lineHeight: 1.4,
                                        marginTop: 1,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}>{section.description}</div>
                                </div>
                                {isActive && <ChevronRight size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                            </button>
                        );
                    })}
                </nav>

                {}
                <div style={{
                    padding: '12px 16px',
                    borderTop: '1px solid var(--border-default)',
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            backgroundColor: 'var(--accent)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#0c0c0c',
                            fontWeight: 700,
                            fontSize: 12,
                            flexShrink: 0,
                        }}>
                            {user?.username?.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}>{user?.username}</div>
                            <div style={{
                                fontSize: 11,
                                color: 'var(--text-muted)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}>{user?.email}</div>
                        </div>
                    </div>
                </div>
            </aside>

            {}
            {mobileSidebarOpen && (
                <div
                    style={{
                        position: 'fixed', inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        zIndex: 20,
                    }}
                    onClick={() => setMobileSidebarOpen(false)}
                />
            )}

            {}
            <main style={{
                flex: 1,
                minWidth: 0,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}
                className="settings-main"
            >
                {}
                <header style={{
                    height: 48,
                    minHeight: 48,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 24px',
                    borderBottom: '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-surface)',
                    flexShrink: 0,
                    zIndex: 10,
                    gap: 16,
                }}>
                    {}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                        <button
                            style={{
                                padding: 6, borderRadius: 2, background: 'none', border: 'none',
                                cursor: 'pointer', color: 'var(--text-muted)',
                                display: 'flex', alignItems: 'center',
                                transition: 'color 150ms ease',
                            }}
                            onClick={() => setMobileSidebarOpen(true)}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                        >
                            <Menu size={18} />
                        </button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                                fontSize: 10,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.12em',
                                color: 'var(--text-muted)',
                            }}>Settings</span>
                            <span style={{ color: 'var(--border-accent)', fontSize: 14 }}>/</span>
                            <span style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                            }}>{activeLabel}</span>
                        </div>
                    </div>

                    {}
                    <div style={{ flex: 1, maxWidth: 360 }}>
                        <div style={{ position: 'relative' }}>
                            <Search
                                size={14}
                                style={{
                                    position: 'absolute',
                                    left: 10,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--text-muted)',
                                    pointerEvents: 'none',
                                }}
                            />
                            <input
                                type="text"
                                placeholder="Search settings…"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    width: '100%',
                                    paddingLeft: 32,
                                    paddingRight: searchQuery ? 32 : 12,
                                    paddingTop: 6,
                                    paddingBottom: 6,
                                    backgroundColor: 'var(--bg-input)',
                                    border: '1px solid var(--border-default)',
                                    borderRadius: 2,
                                    fontSize: 13,
                                    color: 'var(--text-primary)',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                    transition: 'border-color 150ms ease',
                                    ...S.font,
                                }}
                                onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                                onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    style={{
                                        position: 'absolute',
                                        right: 8,
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'var(--text-muted)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: 2,
                                        transition: 'color 150ms ease',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                                >
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                    </div>

                    {}
                    <button
                        onClick={handleBackNavigation}
                        style={{
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 12px',
                            fontSize: 13,
                            fontWeight: 500,
                            color: 'var(--text-secondary)',
                            background: 'none',
                            border: '1px solid var(--border-default)',
                            borderRadius: 2,
                            cursor: 'pointer',
                            transition: 'color 150ms ease, border-color 150ms ease',
                            ...S.font,
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.color = 'var(--text-primary)';
                            e.currentTarget.style.borderColor = 'var(--border-accent)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.color = 'var(--text-secondary)';
                            e.currentTarget.style.borderColor = 'var(--border-default)';
                        }}
                    >
                        <ArrowLeft size={14} /> Back
                    </button>
                </header>

                {}
                <div
                    className="settings-scroll"
                    style={{
                        flex: 1,
                        minHeight: 0,
                        padding: '32px 24px',
                    }}
                >
                    <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 80 }}>

                        {activeSection === 'profile' && (
                            <ProfileTab
                                user={user} profileData={profileData} setProfileData={setProfileData}
                                loading={loading} handleProfileUpdate={handleProfileUpdate}
                            />
                        )}
                        {activeSection === 'notifications' && (
                            <NotificationsTab notifications={notifications} setNotifications={setNotifications} />
                        )}
                        {activeSection === 'privacy' && (
                            <PrivacyTab privacy={privacy} setPrivacy={setPrivacy} />
                        )}
                        {activeSection === 'region' && (
                            <RegionTab region={region} setRegion={setRegion} />
                        )}
                        {activeSection === 'appearance' && (
                            <AppearanceTab theme={theme} toggleTheme={toggleTheme} />
                        )}
                        {activeSection === 'security' && (
                            <SecurityTab
                                passwordData={passwordData} setPasswordData={setPasswordData}
                                showCurrentPassword={showCurrentPassword}
                                setShowCurrentPassword={setShowCurrentPassword}
                                showNewPassword={false}
                                loading={loading} handlePasswordChange={handlePasswordChange}
                            />
                        )}
                        {activeSection === 'sessions' && (
                            <SessionsTab
                                sessions={sessions}
                                handleLogoutSession={handleLogoutSession}
                                handleLogoutOthers={handleLogoutOthers}
                                handleLogout={handleLogout}
                            />
                        )}
                        {activeSection === 'integrations' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {workspaces.length > 1 && (
                                    <div>
                                        <label style={{
                                            display: 'block',
                                            fontSize: 11,
                                            fontWeight: 700,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.12em',
                                            color: 'var(--text-muted)',
                                            marginBottom: 8,
                                            ...S.font,
                                        }}>Workspace</label>
                                        <select
                                            value={selectedWorkspaceId}
                                            onChange={e => setSelectedWorkspaceId(e.target.value)}
                                            style={{
                                                padding: '6px 10px',
                                                fontSize: 13,
                                                backgroundColor: 'var(--bg-input)',
                                                border: '1px solid var(--border-default)',
                                                borderRadius: 2,
                                                color: 'var(--text-primary)',
                                                outline: 'none',
                                                ...S.font,
                                            }}
                                        >
                                            {workspaces.map(ws => <option key={ws.id} value={ws.id}>{ws.name}</option>)}
                                        </select>
                                    </div>
                                )}
                                <IntegrationsTab workspaceId={selectedWorkspaceId} />
                            </div>
                        )}
                        {activeSection === 'advanced' && <AdvancedTab />}
                        {activeSection === 'compliance' && <ComplianceTab user={user} />}

                    </div>
                </div>
            </main>

            {}
            <style>{`
                @media (min-width: 768px) {
                    .settings-sidebar { transform: translateX(0) !important; }
                    .settings-main { margin-left: 240px; }
                }
            `}</style>

            {}
            {isMobile && createPortal(
                <MobileBottomNav
                    workspaceId={workspaces[0]?.id || localStorage.getItem('lastWorkspaceId') || ''}
                    showAI={false}
                    onAIToggle={() => {
                        const wsId = workspaces[0]?.id || localStorage.getItem('lastWorkspaceId');
                        if (wsId) navigate(`/workspace/${wsId}/home`, { state: { openAI: true } });
                        else navigate(-1);
                    }}
                />,
                document.body
            )}
        </div>
    );
};

export default Settings;
