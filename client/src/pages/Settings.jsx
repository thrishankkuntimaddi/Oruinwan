import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    User, Lock, Palette, Bell, Globe, Shield, Laptop, Settings as SettingsIcon,
    ChevronRight, Search, ArrowLeft, Menu
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import axios from 'axios';

// Import tab components
import ProfileTab from './settingsTabs/ProfileTab';
import NotificationsTab from './settingsTabs/NotificationsTab';
import PrivacyTab from './settingsTabs/PrivacyTab';
import RegionTab from './settingsTabs/RegionTab';
import AppearanceTab from './settingsTabs/AppearanceTab';
import SecurityTab from './settingsTabs/SecurityTab';
import SessionsTab from './settingsTabs/SessionsTab';
import AdvancedTab from './settingsTabs/AdvancedTab';

const Settings = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, refreshUser, logout } = useAuth();
    const { showToast } = useToast();
    const { theme, toggleTheme } = useTheme();

    // Mobile Menu State
    const [showMobileMenu, setShowMobileMenu] = useState(true);

    // Smart back navigation - return to previous page if from workspace, else /workspaces
    const handleBackNavigation = () => {
        // Mobile specific: If viewing content, go back to menu
        if (window.innerWidth < 768 && !showMobileMenu) {
            setShowMobileMenu(true);
            return;
        }

        const from = location.state?.from;
        if (from && from.startsWith('/workspace/')) {
            navigate(from);
        } else {
            navigate(-1); // Try browser back first
            // Fallback to /workspaces after a short delay if back didn't work
            setTimeout(() => {
                if (window.location.pathname === '/settings') {
                    navigate('/workspaces');
                }
            }, 100);
        }
    };

    const [activeSection, setActiveSection] = useState('profile');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [sessions, setSessions] = useState([]);

    // --- Mock Settings State ---
    const [notifications, setNotifications] = useState({
        marketingEmails: false,
        securityEmails: true,
        productUpdates: true,
        dmPush: true,
        mentionPush: true,
        threadPush: false,
        soundEffects: true
    });

    const [privacy, setPrivacy] = useState({
        readReceipts: true,
        typingIndicators: true,
        allowDiscovery: false,
        dataSharing: false
    });

    const [region, setRegion] = useState({
        language: 'en',
        timezone: 'auto',
        dateFormat: 'MM/DD/YYYY'
    });

    // Profile state
    const [profileData, setProfileData] = useState({
        username: '',
        phone: '',
        phoneCode: '+91',
        about: ''
    });

    // Password state
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword] = useState(false);

    // Initialize profile data
    useEffect(() => {
        if (user) {
            setProfileData({
                username: user.username || '',
                phone: user.phone || '',
                phoneCode: user.phoneCode || '+91',
                about: user.profile?.about || ''
            });
        }
        loadSessions();
    }, [user]);

    const loadSessions = async () => {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await axios.get(
                `${process.env.REACT_APP_BACKEND_URL}/api/auth/sessions`,
                {
                    withCredentials: true,
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            setSessions(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Failed to load sessions:', error);
            // Keep sessions as empty array on error
            setSessions([]);
        }
    };


    const handleProfileUpdate = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('accessToken');
            await axios.put(
                `${process.env.REACT_APP_BACKEND_URL}/api/auth/me`,
                profileData,
                {
                    withCredentials: true,
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            showToast('Profile updated successfully', 'success');
            await refreshUser();
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to update profile', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordChange = async () => {
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            showToast('Passwords do not match', 'error');
            return;
        }
        if (passwordData.newPassword.length < 8) {
            showToast('Password must be at least 8 characters', 'error');
            return;
        }
        setLoading(true);
        try {
            const token = localStorage.getItem('accessToken');
            await axios.put(
                `${process.env.REACT_APP_BACKEND_URL}/api/auth/me/password`,
                {
                    currentPassword: passwordData.currentPassword,
                    newPassword: passwordData.newPassword
                },
                {
                    withCredentials: true,
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            showToast('Password changed successfully', 'success');
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to change password', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleLogoutSession = async (sessionId) => {
        try {
            const token = localStorage.getItem('accessToken');
            await axios.delete(
                `${process.env.REACT_APP_BACKEND_URL}/api/auth/sessions/${sessionId}`,
                {
                    withCredentials: true,
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            showToast('Session logged out', 'success');
            loadSessions();
        } catch (error) {
            showToast('Failed to logout session', 'error');
        }
    };

    const handleLogoutOthers = async () => {
        try {
            const token = localStorage.getItem('accessToken');
            await axios.delete(
                `${process.env.REACT_APP_BACKEND_URL}/api/auth/sessions/others`,
                {
                    withCredentials: true,
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            showToast('All other sessions logged out', 'success');
            loadSessions();
        } catch (error) {
            showToast('Failed to logout other sessions', 'error');
        }
    };

    const handleLogout = async () => {
        try {
            showToast('Logging out...', 'info');
            await logout(); // This calls the AuthContext logout which handles everything
            navigate('/login');
        } catch (error) {
            console.error('Logout error:', error);
            showToast('Failed to logout', 'error');
        }
    };

    const filteredSections = useMemo(() => {
        const sections = [
            { id: 'profile', label: 'My Profile', icon: User, description: 'Manage your personal info' },
            { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Email & push preferences' },
            { id: 'privacy', label: 'Privacy & Safety', icon: Lock, description: 'Control visibility & data' },
            { id: 'region', label: 'Language & Region', icon: Globe, description: 'Timezone & localization' },
            { id: 'appearance', label: 'Appearance', icon: Palette, description: 'Dark mode & themes' },
            { id: 'security', label: 'Security', icon: Shield, description: 'Password & 2FA' },
            { id: 'sessions', label: 'Sessions', icon: Laptop, description: 'Active devices & history' },
            { id: 'advanced', label: 'Advanced', icon: SettingsIcon, description: 'Account & data management' },
        ];

        if (!searchQuery) return sections;
        return sections.filter(s =>
            s.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.description.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [searchQuery]);



    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#030712] transition-colors duration-300 flex text-slate-900 dark:text-slate-100 font-sans">
            {/* Sidebar Navigation */}
            <aside className={`fixed inset-y-0 z-20 flex flex-col bg-white dark:bg-[#0B0F19] border-r border-slate-200 dark:border-white/5 transition-all duration-300 
                ${showMobileMenu ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} 
                w-full md:w-64`}>
                <div className="h-20 flex items-center px-6 border-b border-slate-200 dark:border-white/5">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={handleBackNavigation}>
                        <img src="/chttrix-logo.jpg" alt="Logo" className="w-8 h-8 rounded-lg shadow-sm" />
                        <span className="font-exul font-black text-xl tracking-tighter text-slate-900 dark:text-white">Chttrix</span>
                    </div>
                </div>

                <div className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar pb-6 mt-6">
                    {filteredSections.map((section) => {
                        const Icon = section.icon;
                        const isActive = activeSection === section.id;
                        return (
                            <button
                                key={section.id}
                                onClick={() => {
                                    setActiveSection(section.id);
                                    setShowMobileMenu(false); // Close menu on mobile selection
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 group ${isActive
                                    ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/30 scale-[1.02]'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 font-medium hover:pl-5'
                                    }`}
                            >
                                <Icon size={20} className={`transition-transform duration-300 ${isActive ? 'text-white scale-110' : 'text-slate-400 group-hover:scale-110'}`} />
                                <div className="text-left">
                                    <div className="text-sm">{section.label}</div>
                                </div>
                                {isActive && <ChevronRight size={16} className="ml-auto text-white animate-fade-in" />}
                            </button>
                        );
                    })}
                </div>

                <div className="p-4 border-t border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-[#0B0F19]">
                    <div className="flex items-center gap-3 px-2">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shadow-md border-2 border-white dark:border-[#0B0F19]">
                            {user?.username?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-slate-900 truncate dark:text-white">{user?.username}</div>
                            <div className="text-xs text-slate-500 truncate dark:text-slate-500">{user?.email}</div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className={`flex-1 h-screen flex flex-col relative bg-slate-50 dark:bg-[#030712] transition-all duration-300
                ${showMobileMenu ? 'hidden md:flex' : 'flex'}
                md:ml-64 w-full`}>
                {/* Top Header */}
                <header className="h-20 px-8 lg:px-12 flex items-center justify-between border-b border-slate-200/60 dark:border-white/5 bg-white/70 dark:bg-[#030712]/70 backdrop-blur-2xl z-10 sticky top-0 transition-all duration-300">
                    {/* Left: Title */}
                    <div className="flex items-center gap-3">
                        <button
                            className="md:hidden p-2 -ml-2 mr-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                            onClick={() => setShowMobileMenu(true)}
                        >
                            <Menu size={24} />
                        </button>

                        <div className="hidden md:block p-2 bg-indigo-50 dark:bg-white/5 rounded-xl text-indigo-600 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10">
                            <SettingsIcon size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Settings</h1>
                        </div>
                    </div>

                    {/* Middle: Search Bar */}
                    <div className="flex-1 max-w-lg mx-12">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors duration-300" size={16} />
                            <input
                                type="text"
                                placeholder="Search settings..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-white/50 dark:bg-[#111827]/50 border border-slate-200/60 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none dark:text-white transition-all duration-300 shadow-sm focus:shadow-lg focus:bg-white dark:focus:bg-[#111827]"
                            />
                        </div>
                    </div>

                    {/* Right: Back Button */}
                    <button
                        onClick={handleBackNavigation}
                        className="px-4 py-2 bg-white dark:bg-[#111827] border border-slate-200/60 dark:border-white/10 rounded-xl shadow-sm hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-500/30 text-slate-600 dark:text-slate-300 font-bold text-sm flex items-center gap-2 transition-all duration-300 group hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
                    >
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform duration-300" />
                        Back
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 custom-scrollbar">
                    <div className="max-w-4xl mx-auto space-y-10 pb-32">
                        {/* Content Area */}
                        <div className="pt-2">

                            {activeSection === 'profile' && (
                                <ProfileTab
                                    user={user}
                                    profileData={profileData}
                                    setProfileData={setProfileData}
                                    loading={loading}
                                    handleProfileUpdate={handleProfileUpdate}
                                />
                            )}
                            {activeSection === 'notifications' && (
                                <NotificationsTab
                                    notifications={notifications}
                                    setNotifications={setNotifications}
                                />
                            )}
                            {activeSection === 'privacy' && (
                                <PrivacyTab
                                    privacy={privacy}
                                    setPrivacy={setPrivacy}
                                />
                            )}
                            {activeSection === 'region' && (
                                <RegionTab
                                    region={region}
                                    setRegion={setRegion}
                                />
                            )}
                            {activeSection === 'appearance' && (
                                <AppearanceTab
                                    theme={theme}
                                    toggleTheme={toggleTheme}
                                />
                            )}
                            {activeSection === 'security' && (
                                <SecurityTab
                                    passwordData={passwordData}
                                    setPasswordData={setPasswordData}
                                    showCurrentPassword={showCurrentPassword}
                                    setShowCurrentPassword={setShowCurrentPassword}
                                    showNewPassword={showNewPassword}
                                    loading={loading}
                                    handlePasswordChange={handlePasswordChange}
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
                            {activeSection === 'advanced' && (
                                <AdvancedTab />
                            )}

                            {/* Fallback for debugging */}
                            {!['profile', 'notifications', 'privacy', 'region', 'appearance', 'security', 'sessions', 'advanced'].includes(activeSection) && (
                                <div className="p-8 text-center text-slate-500">
                                    <p>Invalid section: {activeSection}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Settings;
