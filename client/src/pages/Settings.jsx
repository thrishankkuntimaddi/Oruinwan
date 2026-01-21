import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    User, Lock, Palette,
    ChevronRight, Loader,
    Eye, EyeOff, Smartphone, Monitor,
    Search, Bell, Moon, Sun, Shield, CheckCircle2, Laptop, ArrowLeft, Settings as SettingsIcon,
    Globe, Mail
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import axios from 'axios';

// Toggle Switch Component
const Toggle = ({ label, description, checked, onChange }) => (
    <div className="flex items-center justify-between py-4">
        <div className="pr-8">
            <div className="font-bold text-slate-800 dark:text-white text-sm">{label}</div>
            {description && <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{description}</div>}
        </div>
        <button
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${checked ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}
        >
            <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`}
            />
        </button>
    </div>
);

// Selection Radio Component
const RadioSelect = ({ options, selected, onChange }) => (
    <div className="space-y-2">
        {options.map((option) => (
            <button
                key={option.value}
                onClick={() => onChange(option.value)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${selected === option.value
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-500/50'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
            >
                <div className="flex items-center gap-3">
                    {option.icon && <option.icon size={18} className={selected === option.value ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} />}
                    <span className={`text-sm font-medium ${selected === option.value ? 'text-indigo-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                        {option.label}
                    </span>
                </div>
                {selected === option.value && <div className="w-4 h-4 rounded-full bg-indigo-600 border-2 border-white dark:border-indigo-900"></div>}
            </button>
        ))}
    </div>
);

const Settings = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, refreshUser } = useAuth();
    const { showToast } = useToast();
    const { theme, toggleTheme } = useTheme();

    // Smart back navigation - return to previous page if from workspace, else /workspaces
    const handleBackNavigation = () => {
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
            const response = await axios.get('/api/auth/sessions', { withCredentials: true });
            setSessions(response.data);
        } catch (error) {
            console.error('Failed to load sessions:', error);
        }
    };

    const handleProfileUpdate = async () => {
        setLoading(true);
        try {
            await axios.put('/api/auth/me', profileData, { withCredentials: true });
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
            await axios.put('/api/auth/me/password', {
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword
            }, { withCredentials: true });
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
            await axios.delete(`/api/auth/sessions/${sessionId}`, { withCredentials: true });
            showToast('Session logged out', 'success');
            loadSessions();
        } catch (error) {
            showToast('Failed to logout session', 'error');
        }
    };

    const handleLogoutOthers = async () => {
        try {
            await axios.delete('/api/auth/sessions/others', { withCredentials: true });
            showToast('All other sessions logged out', 'success');
            loadSessions();
        } catch (error) {
            showToast('Failed to logout other sessions', 'error');
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
        ];

        if (!searchQuery) return sections;
        return sections.filter(s =>
            s.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.description.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [searchQuery]);

    // Renders
    const Card = ({ children, title, subtitle, className = "" }) => (
        <div className={`bg-white dark:bg-[#0B0F19] rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-200/60 dark:border-white/5 overflow-hidden ${className}`}>
            {(title || subtitle) && (
                <div className="px-6 py-5 border-b border-slate-100 dark:border-white/5 bg-slate-50/30 dark:bg-[#0B0F19]">
                    {title && <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">{title}</h3>}
                    {subtitle && <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">{subtitle}</p>}
                </div>
            )}
            <div className="p-6">
                {children}
            </div>
        </div>
    );

    const renderProfile = () => (
        <div className="space-y-6 animate-fade-in-up">
            <Card title="Personal Information" subtitle="Update your photo and personal details">
                <div className="flex flex-col md:flex-row gap-8 items-start">
                    {/* Avatar Side */}
                    <div className="flex flex-col items-center space-y-4">
                        <div className="relative group">
                            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-4xl font-black shadow-lg ring-4 ring-white dark:ring-[#0B0F19]">
                                {user?.profilePicture ? (
                                    <img src={user.profilePicture} alt="Profile" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    <span>{user?.username?.charAt(0)?.toUpperCase()}</span>
                                )}
                            </div>
                            <button className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                <span className="text-white text-xs font-bold">Change</span>
                            </button>
                        </div>
                        <div className="text-center">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{user?.username}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{user?.role || 'Member'}</p>
                        </div>
                    </div>

                    {/* Form Side */}
                    <div className="flex-1 space-y-5 w-full">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">Display Name</label>
                                <input
                                    type="text"
                                    value={profileData.username}
                                    onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">Email Address</label>
                                <div className="px-4 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-lg text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed flex items-center gap-2">
                                    <Mail size={14} />
                                    {user?.email}
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">Phone Number</label>
                            <div className="flex gap-3">
                                <select
                                    value={profileData.phoneCode}
                                    onChange={(e) => setProfileData({ ...profileData, phoneCode: e.target.value })}
                                    className="w-28 px-3 py-2.5 bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                                >
                                    <option value="+1">+1 (US)</option>
                                    <option value="+91">+91 (IN)</option>
                                    <option value="+44">+44 (UK)</option>
                                </select>
                                <input
                                    type="tel"
                                    value={profileData.phone}
                                    onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                                    className="flex-1 px-4 py-2.5 bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none dark:text-white"
                                    placeholder="123-456-7890"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">About Bio</label>
                            <textarea
                                value={profileData.about}
                                onChange={(e) => setProfileData({ ...profileData, about: e.target.value })}
                                rows={4}
                                maxLength={500}
                                className="w-full px-4 py-3 bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none dark:text-white"
                                placeholder="Tell us a bit about user experience..."
                            />
                            <div className="text-right text-xs text-slate-400 mt-1">{profileData.about?.length || 0}/500</div>
                        </div>

                        <div className="pt-4 flex justify-end">
                            <button
                                onClick={handleProfileUpdate}
                                disabled={loading}
                                className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-lg shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-70 flex items-center gap-2"
                            >
                                {loading && <Loader size={16} className="animate-spin" />}
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );

    const renderNotifications = () => (
        <div className="space-y-6 animate-fade-in-up">
            <Card title="Email Notifications" subtitle="Choose what you want to receive via email">
                <div className="space-y-2">
                    <Toggle
                        label="Product Updates"
                        description="New features, improvements, and roadmap updates."
                        checked={notifications.productUpdates}
                        onChange={(v) => setNotifications({ ...notifications, productUpdates: v })}
                    />
                    <div className="border-t border-slate-100 dark:border-white/5"></div>
                    <Toggle
                        label="Security Alerts"
                        description="Important alerts about your account security."
                        checked={notifications.securityEmails}
                        onChange={(v) => setNotifications({ ...notifications, securityEmails: v })}
                    />
                    <div className="border-t border-slate-100 dark:border-white/5"></div>
                    <Toggle
                        label="Marketing Emails"
                        description="Tips, offers, and Chttrix news."
                        checked={notifications.marketingEmails}
                        onChange={(v) => setNotifications({ ...notifications, marketingEmails: v })}
                    />
                </div>
            </Card>

            <Card title="Push Notifications" subtitle="Manage mobile and desktop alerts">
                <div className="space-y-2">
                    <Toggle
                        label="Direct Messages"
                        description="Get notified when someone messages you directly."
                        checked={notifications.dmPush}
                        onChange={(v) => setNotifications({ ...notifications, dmPush: v })}
                    />
                    <div className="border-t border-slate-100 dark:border-white/5"></div>
                    <Toggle
                        label="Mentions"
                        description="Get notified when you are mentioned in a channel."
                        checked={notifications.mentionPush}
                        onChange={(v) => setNotifications({ ...notifications, mentionPush: v })}
                    />
                    <div className="border-t border-slate-100 dark:border-white/5"></div>
                    <Toggle
                        label="Thread Replies"
                        description="Get notified about replies to your threads."
                        checked={notifications.threadPush}
                        onChange={(v) => setNotifications({ ...notifications, threadPush: v })}
                    />
                </div>
            </Card>

            <Card title="App Sounds" subtitle="In-app auditory feedback">
                <Toggle
                    label="Enable Sound Effects"
                    description="Play sounds for new messages and interactions."
                    checked={notifications.soundEffects}
                    onChange={(v) => setNotifications({ ...notifications, soundEffects: v })}
                />
            </Card>
        </div>
    );

    const renderPrivacy = () => (
        <div className="space-y-6 animate-fade-in-up">
            <Card title="Privacy" subtitle="Control who can see your activity">
                <div className="space-y-2">
                    <Toggle
                        label="Read Receipts"
                        description="Let others know when you've seen their messages."
                        checked={privacy.readReceipts}
                        onChange={(v) => setPrivacy({ ...privacy, readReceipts: v })}
                    />
                    <div className="border-t border-slate-100 dark:border-white/5"></div>
                    <Toggle
                        label="Typing Indicators"
                        description="Show others when you are writing a message."
                        checked={privacy.typingIndicators}
                        onChange={(v) => setPrivacy({ ...privacy, typingIndicators: v })}
                    />
                </div>
            </Card>

            <Card title="Data & Safety" subtitle="Manage your data footprint">
                <div className="space-y-2">
                    <Toggle
                        label="Allow Discovery"
                        description="Let people find you by your email or phone number."
                        checked={privacy.allowDiscovery}
                        onChange={(v) => setPrivacy({ ...privacy, allowDiscovery: v })}
                    />
                    <div className="border-t border-slate-100 dark:border-white/5"></div>
                    <Toggle
                        label="Share Usage Data"
                        description="Help us improve Chttrix by sharing anonymous usage data."
                        checked={privacy.dataSharing}
                        onChange={(v) => setPrivacy({ ...privacy, dataSharing: v })}
                    />
                </div>
            </Card>

            <Card title="Danger Zone" className="border-red-200 dark:border-red-900/30">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="font-bold text-red-600 dark:text-red-400 text-sm">Delete Account</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Permanently remove your account and all data. This cannot be undone.</div>
                    </div>
                    <button className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-bold hover:bg-red-100 transition-colors dark:bg-red-900/10 dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-900/20">
                        Delete Account
                    </button>
                </div>
            </Card>
        </div>
    );

    const renderRegion = () => (
        <div className="space-y-6 animate-fade-in-up">
            <Card title="Language" subtitle="Select your preferred interface language">
                <RadioSelect
                    selected={region.language}
                    onChange={(v) => setRegion({ ...region, language: v })}
                    options={[
                        { value: 'en', label: 'English (US)', icon: Globe },
                        { value: 'es', label: 'Español', icon: Globe },
                        { value: 'fr', label: 'Français', icon: Globe },
                        { value: 'de', label: 'Deutsch', icon: Globe },
                    ]}
                />
            </Card>

            <Card title="Date & Time" subtitle="Regional formatting preferences">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">Timezone</label>
                        <select
                            className="w-full px-4 py-2.5 bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                            value={region.timezone}
                            onChange={(e) => setRegion({ ...region, timezone: e.target.value })}
                        >
                            <option value="auto">Automatic (Browser Default)</option>
                            <option value="utc">UTC</option>
                            <option value="est">Eastern Time (US)</option>
                            <option value="pst">Pacific Time (US)</option>
                            <option value="ist">Indian Standard Time</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">Date Format</label>
                        <select
                            className="w-full px-4 py-2.5 bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                            value={region.dateFormat}
                            onChange={(e) => setRegion({ ...region, dateFormat: e.target.value })}
                        >
                            <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2025)</option>
                            <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2025)</option>
                            <option value="YYYY-MM-DD">YYYY-MM-DD (2025-12-31)</option>
                        </select>
                    </div>
                </div>
            </Card>
        </div>
    );

    const renderSecurity = () => (
        <div className="space-y-6 animate-fade-in-up">
            <Card title="Password" subtitle="Manage your password and authentication">
                <div className="max-w-xl space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">Current Password</label>
                        <div className="relative">
                            <input
                                type={showCurrentPassword ? "text" : "password"}
                                value={passwordData.currentPassword}
                                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                className="w-full px-4 py-2.5 bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none dark:text-white"
                            />
                            <button
                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">New Password</label>
                            <input
                                type={showNewPassword ? "text" : "password"}
                                value={passwordData.newPassword}
                                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                className="w-full px-4 py-2.5 bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">Confirm New Password</label>
                            <input
                                type={showNewPassword ? "text" : "password"}
                                value={passwordData.confirmPassword}
                                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                className="w-full px-4 py-2.5 bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none dark:text-white"
                            />
                        </div>
                    </div>

                    <div className="pt-2">
                        <button
                            onClick={handlePasswordChange}
                            disabled={loading || !passwordData.currentPassword || !passwordData.newPassword}
                            className="px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-black font-bold rounded-lg hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-black/20"
                        >
                            {loading && <Loader size={16} className="animate-spin" />}
                            Update Password
                        </button>
                    </div>
                </div>
            </Card>

            <Card title="Two-Factor Authentication" subtitle="Add an extra layer of security">
                <div className="flex items-center justify-between">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                            <Shield className="text-indigo-600 dark:text-indigo-400" size={24} />
                        </div>
                        <div>
                            <div className="font-bold text-slate-800 dark:text-white mb-1">Authenticator App</div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">Use Google Authenticator or Authy to generate verification codes.</p>
                        </div>
                    </div>
                    <button className="px-5 py-2.5 border border-slate-300 dark:border-white/20 rounded-lg text-sm font-bold text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                        Enable 2FA
                    </button>
                </div>
            </Card>
        </div>
    );

    const renderSessions = () => (
        <div className="space-y-6 animate-fade-in-up">
            <Card title="Active Sessions" subtitle="Devices currently logged into your account">
                <div className="space-y-4">
                    {sessions.map((session) => (
                        <div key={session._id} className="flex items-center justify-between p-4 border border-slate-100 dark:border-white/5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${session.isCurrent ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-slate-100 text-slate-500 dark:bg-[#111827] dark:text-slate-400'}`}>
                                    {session.deviceType === 'mobile' ? <Smartphone size={22} /> : <Monitor size={22} />}
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-sm">
                                        {session.deviceInfo || 'Unknown Device'}
                                        {session.isCurrent && (
                                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full dark:bg-green-500/20 dark:text-green-400 font-bold">Current</span>
                                        )}
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        {new Date(session.lastActive).toLocaleString()} · {session.ipAddress}
                                    </p>
                                </div>
                            </div>
                            {!session.isCurrent && (
                                <button
                                    onClick={() => handleLogoutSession(session._id)}
                                    className="text-xs font-bold text-red-500 hover:text-white px-3 py-1.5 hover:bg-red-500 rounded-lg transition-colors border border-red-100 dark:border-transparent bg-red-50 dark:bg-red-900/20 opacity-0 group-hover:opacity-100"
                                >
                                    Revoke
                                </button>
                            )}
                        </div>
                    ))}
                    {sessions.length === 0 && (
                        <div className="text-center py-12 text-slate-400">No active sessions found</div>
                    )}
                </div>
                {sessions.length > 1 && (
                    <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/5 flex justify-end">
                        <button
                            onClick={handleLogoutOthers}
                            className="px-4 py-2 bg-red-50 text-red-600 font-bold rounded-lg hover:bg-red-100 transition-colors text-sm dark:bg-red-900/10 dark:text-red-400 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-900/30"
                        >
                            Log Out All Other Devices
                        </button>
                    </div>
                )}
            </Card>
        </div>
    );

    const renderAppearance = () => (
        <div className="space-y-6 animate-fade-in-up">
            <Card title="Interface Theme" subtitle="Customize the look and feel of Chttrix">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {[
                        { id: 'light', label: 'Light Mode', icon: Sun },
                        { id: 'dark', label: 'Dark Mode', icon: Moon },
                        { id: 'auto', label: 'System Default', icon: Laptop }
                    ].map((mode) => (
                        <button
                            key={mode.id}
                            onClick={() => toggleTheme(mode.id)}
                            className={`p-6 border-2 rounded-2xl flex flex-col items-center gap-4 transition-all relative overflow-hidden group ${theme === mode.id
                                ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-600/10 dark:border-indigo-500'
                                : 'border-slate-200 dark:border-white/10 hover:border-indigo-300 dark:hover:border-white/30 bg-white dark:bg-[#0B0F19]'
                                }`}
                        >
                            <div className={`p-4 rounded-full ${theme === mode.id ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-600 dark:text-white shadow-lg' : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400 group-hover:scale-110 transition-transform'}`}>
                                <mode.icon size={24} />
                            </div>
                            <div className="text-center z-10">
                                <h4 className={`font-bold ${theme === mode.id ? 'text-indigo-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>{mode.label}</h4>
                            </div>
                            {theme === mode.id && <div className="absolute top-3 right-3 text-indigo-600 dark:text-indigo-400"><CheckCircle2 size={18} /></div>}
                        </button>
                    ))}
                </div>
            </Card>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#030712] transition-colors duration-300 flex text-slate-900 dark:text-slate-100 font-sans">
            {/* Sidebar Navigation */}
            <aside className="w-64 bg-white dark:bg-[#0B0F19] border-r border-slate-200 dark:border-white/5 flex flex-col fixed inset-y-0 z-20">
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
                                onClick={() => setActiveSection(section.id)}
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
            <main className="flex-1 ml-64 overflow-hidden h-screen flex flex-col relative bg-slate-50 dark:bg-[#030712]">
                {/* Top Header */}
                <header className="h-20 px-8 lg:px-12 flex items-center justify-between border-b border-slate-200/60 dark:border-white/5 bg-white/70 dark:bg-[#030712]/70 backdrop-blur-2xl z-10 sticky top-0 transition-all duration-300">
                    {/* Left: Title */}
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 dark:bg-white/5 rounded-xl text-indigo-600 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10">
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

                <div className="flex-1 overflow-y-auto p-8 lg:p-12 custom-scrollbar">
                    <div className="max-w-4xl mx-auto space-y-10 pb-32">
                        {/* Content Area - No Redundant Header */
                        }
                        <div className="pt-2">

                            {activeSection === 'profile' && renderProfile()}
                            {activeSection === 'notifications' && renderNotifications()}
                            {activeSection === 'privacy' && renderPrivacy()}
                            {activeSection === 'region' && renderRegion()}
                            {activeSection === 'appearance' && renderAppearance()}
                            {activeSection === 'security' && renderSecurity()}
                            {activeSection === 'sessions' && renderSessions()}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Settings;
