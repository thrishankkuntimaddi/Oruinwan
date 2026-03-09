import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    User, Lock, Palette, Bell, Globe, Shield, Laptop, Settings as SettingsIcon,
    ChevronRight, Search, ArrowLeft, X, Menu
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/api';

// Import tab components
import ProfileTab from './settingsTabs/ProfileTab';
import NotificationsTab from './settingsTabs/NotificationsTab';
import PrivacyTab from './settingsTabs/PrivacyTab';
import RegionTab from './settingsTabs/RegionTab';
import AppearanceTab from './settingsTabs/AppearanceTab';
import SecurityTab from './settingsTabs/SecurityTab';
import SessionsTab from './settingsTabs/SessionsTab';
import AdvancedTab from './settingsTabs/AdvancedTab';

const NAV_SECTIONS = [
    { id: 'profile', label: 'My Profile', icon: User, description: 'Name, photo, bio' },
    { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Email & push alerts' },
    { id: 'privacy', label: 'Privacy & Safety', icon: Lock, description: 'Visibility & data' },
    { id: 'region', label: 'Language & Region', icon: Globe, description: 'Timezone & locale' },
    { id: 'appearance', label: 'Appearance', icon: Palette, description: 'Theme & font size' },
    { id: 'security', label: 'Security', icon: Shield, description: 'Password & 2FA' },
    { id: 'sessions', label: 'Sessions', icon: Laptop, description: 'Active devices' },
    { id: 'advanced', label: 'Advanced', icon: SettingsIcon, description: 'Account & data' },
];

const Settings = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, refreshUser, logout } = useAuth();
    const { showToast } = useToast();
    const { theme, toggleTheme } = useTheme();

    const [activeSection, setActiveSection] = useState('profile');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [sessions, setSessions] = useState([]);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    // ── Shared state lifted to parent so tabs get it ───────────────────────────
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
    }, [user]);

    const loadSessions = async () => {
        try {
            const { data } = await api.get('/api/auth/sessions');
            setSessions(Array.isArray(data) ? data : []);
        } catch { setSessions([]); }
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
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex font-sans text-gray-900 dark:text-gray-100">

            {/* ── Sidebar ─────────────────────────────────────── */}
            <aside className={`fixed inset-y-0 left-0 z-30 w-64 flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-transform duration-200
                ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>

                {/* Logo / back */}
                <div className="h-14 flex items-center px-4 border-b border-gray-200 dark:border-gray-800 gap-3">
                    <button
                        onClick={handleBackNavigation}
                        className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <ArrowLeft size={16} />
                    </button>
                    <img src="/chttrix-logo.jpg" alt="Logo" className="w-6 h-6 rounded-md" />
                    <span className="font-black text-sm tracking-tight text-gray-900 dark:text-white">Chttrix</span>
                    <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-gray-400">Settings</span>
                </div>

                {/* Nav items */}
                <nav className="flex-1 overflow-y-auto py-2 px-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-600 px-2 py-1.5 mb-1">Account</p>
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
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 text-left transition-all group ${isActive
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                                    }`}
                            >
                                <Icon size={15} className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} />
                                <div className="flex-1 min-w-0">
                                    <div className={`text-[12.5px] font-semibold leading-tight ${isActive ? 'text-white' : ''}`}>{section.label}</div>
                                    <div className={`text-[10.5px] leading-tight mt-0.5 truncate ${isActive ? 'text-blue-200' : 'text-gray-400 dark:text-gray-600'}`}>{section.description}</div>
                                </div>
                                {isActive && <ChevronRight size={13} className="text-blue-200 flex-shrink-0" />}
                            </button>
                        );
                    })}
                </nav>

                {/* User footer */}
                <div className="p-3 border-t border-gray-200 dark:border-gray-800">
                    <div className="flex items-center gap-2.5 px-1">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                            {user?.username?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[12.5px] font-bold text-gray-900 dark:text-white truncate">{user?.username}</div>
                            <div className="text-[11px] text-gray-400 truncate">{user?.email}</div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Mobile overlay */}
            {mobileSidebarOpen && (
                <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={() => setMobileSidebarOpen(false)} />
            )}

            {/* ── Main content ───────────────────────────────── */}
            <main className="flex-1 md:ml-64 flex flex-col min-h-screen">
                {/* Top bar */}
                <header className="h-14 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10 gap-4">
                    {/* Left: breadcrumb */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                        <button
                            className="md:hidden p-1.5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                            onClick={() => setMobileSidebarOpen(true)}
                        >
                            <Menu size={18} />
                        </button>
                        <div className="hidden md:flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Settings</span>
                            <span className="text-gray-300 dark:text-gray-700">/</span>
                            <span className="text-[13px] font-bold text-gray-900 dark:text-white">{activeLabel}</span>
                        </div>
                    </div>

                    {/* Center: Search bar */}
                    <div className="flex-1 max-w-md">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                            <input
                                type="text"
                                placeholder="Search settings…"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-8 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[13px] text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Right: back */}
                    <button
                        onClick={handleBackNavigation}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <ArrowLeft size={14} /> Back
                    </button>
                </header>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8">
                    <div className="max-w-3xl mx-auto space-y-6 pb-24">

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
                        {activeSection === 'advanced' && <AdvancedTab />}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Settings;
