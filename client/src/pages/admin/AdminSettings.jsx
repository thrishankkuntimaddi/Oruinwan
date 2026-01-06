// client/src/pages/admin/AdminSettings.jsx
// Comprehensive Company Settings for Admin

import React, { useState } from 'react';
import {
    Building, Shield, Bell, CreditCard, Users, Globe,
    Palette, Database, Download, Upload, Check,
    AlertCircle, ExternalLink, Key, Zap
} from 'lucide-react';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import AdminSidebar from '../../components/admin/AdminSidebar';
import DomainSettings from '../../components/company/DomainSettings';

const AdminSettings = () => {
    const { company } = useCompany();
    const { } = useAuth();
    const [activeTab, setActiveTab] = useState('company');
    const [isSaving, setIsSaving] = useState(false);

    // Mock state for settings (would come from backend)
    const [settings, setSettings] = useState({
        // Company Profile
        companyName: company?.name || '',
        companyEmail: company?.email || '',
        companyPhone: '',
        companyAddress: '',
        companyWebsite: '',
        companyLogo: '',

        // Security
        require2FA: false,
        passwordMinLength: 8,
        sessionTimeout: 60,
        ssoEnabled: false,

        // Notifications
        emailOnNewUser: true,
        emailOnWorkspaceCreate: true,
        weeklyDigest: true,

        // User Defaults
        defaultRole: 'member',
        autoApproveJoin: false,

        // Branding
        primaryColor: '#4F46E5',
        accentColor: '#10B981',
    });

    const tabs = [
        { id: 'company', label: 'Company Profile', icon: Building },
        { id: 'security', label: 'Security', icon: Shield },
        { id: 'domain', label: 'Domain & SSO', icon: Globe },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'billing', label: 'Billing & Plan', icon: CreditCard },
        { id: 'users', label: 'User Defaults', icon: Users },
        { id: 'branding', label: 'Branding', icon: Palette },
        { id: 'data', label: 'Data & Privacy', icon: Database },
    ];

    const handleSave = async () => {
        setIsSaving(true);
        // TODO: Call backend API to save settings
        setTimeout(() => {
            setIsSaving(false);
            // Show success toast
        }, 1000);
    };

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900 font-sans text-slate-900 dark:text-slate-100 overflow-hidden">
            <AdminSidebar />

            <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 dark:bg-slate-900/50 relative">
                {/* Header */}
                <header className="h-16 px-8 flex items-center justify-between z-10 bg-white border-b border-slate-200">
                    <div>
                        <h2 className="text-xl font-black text-slate-800">Company Settings</h2>
                        <p className="text-xs text-slate-500 font-medium">Configure your organization</p>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
                    >
                        {isSaving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Saving...
                            </>
                        ) : (
                            <>
                                <Check size={16} /> Save Changes
                            </>
                        )}
                    </button>
                </header>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Tabs */}
                    <div className="w-64 bg-white border-r border-slate-200 overflow-y-auto custom-scrollbar">
                        <nav className="p-4 space-y-1">
                            {tabs.map((tab) => {
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id
                                            ? 'bg-indigo-50 text-indigo-600'
                                            : 'text-slate-600 hover:bg-slate-50'
                                            }`}
                                    >
                                        <Icon size={18} />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </nav>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        {/* COMPANY PROFILE TAB */}
                        {activeTab === 'company' && (
                            <div className="max-w-3xl space-y-6">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800 mb-1">Company Profile</h3>
                                    <p className="text-sm text-slate-500">Manage your organization's basic information</p>
                                </div>

                                <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Company Name</label>
                                        <input
                                            type="text"
                                            value={settings.companyName}
                                            disabled
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed"
                                        />
                                        <p className="text-xs text-slate-400 mt-1">Contact support to change company name</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Company Email</label>
                                        <input
                                            type="email"
                                            value={settings.companyEmail}
                                            onChange={(e) => setSettings({ ...settings, companyEmail: e.target.value })}
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                            placeholder="contact@company.com"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Phone Number</label>
                                        <input
                                            type="tel"
                                            value={settings.companyPhone}
                                            onChange={(e) => setSettings({ ...settings, companyPhone: e.target.value })}
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                            placeholder="+1 (555) 123-4567"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Address</label>
                                        <textarea
                                            value={settings.companyAddress}
                                            onChange={(e) => setSettings({ ...settings, companyAddress: e.target.value })}
                                            rows={3}
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                            placeholder="123 Main St, City, State, ZIP"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Website</label>
                                        <input
                                            type="url"
                                            value={settings.companyWebsite}
                                            onChange={(e) => setSettings({ ...settings, companyWebsite: e.target.value })}
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                            placeholder="https://www.company.com"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Company Logo</label>
                                        <div className="flex items-center gap-4">
                                            <div className="w-20 h-20 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center">
                                                <Building className="w-8 h-8 text-slate-400" />
                                            </div>
                                            <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                                                <Upload className="w-4 h-4 inline mr-2" />
                                                Upload Logo
                                            </button>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-2">Recommended: 512x512px, PNG or SVG</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SECURITY TAB */}
                        {activeTab === 'security' && (
                            <div className="max-w-3xl space-y-6">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800 mb-1">Security Settings</h3>
                                    <p className="text-sm text-slate-500">Configure authentication and access controls</p>
                                </div>

                                <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Key className="w-4 h-4 text-slate-600" />
                                                <h4 className="text-sm font-bold text-slate-800">Two-Factor Authentication (2FA)</h4>
                                            </div>
                                            <p className="text-xs text-slate-500">Require all users to enable 2FA</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={settings.require2FA}
                                                onChange={(e) => setSettings({ ...settings, require2FA: e.target.checked })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                        </label>
                                    </div>

                                    <hr className="border-slate-100" />

                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Minimum Password Length</label>
                                        <input
                                            type="number"
                                            min="6"
                                            max="32"
                                            value={settings.passwordMinLength}
                                            onChange={(e) => setSettings({ ...settings, passwordMinLength: parseInt(e.target.value) })}
                                            className="w-32 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                        />
                                        <p className="text-xs text-slate-400 mt-1">Characters (minimum 6, recommended 12+)</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Session Timeout</label>
                                        <select
                                            value={settings.sessionTimeout}
                                            onChange={(e) => setSettings({ ...settings, sessionTimeout: parseInt(e.target.value) })}
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                        >
                                            <option value={15}>15 minutes</option>
                                            <option value={30}>30 minutes</option>
                                            <option value={60}>1 hour</option>
                                            <option value={120}>2 hours</option>
                                            <option value={480}>8 hours</option>
                                            <option value={1440}>24 hours</option>
                                        </select>
                                        <p className="text-xs text-slate-400 mt-1">Automatically log out inactive users</p>
                                    </div>
                                </div>

                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-bold text-amber-900">Security Recommendation</p>
                                        <p className="text-xs text-amber-700 mt-1">
                                            Enable 2FA for all admin accounts and set a minimum password length of 12 characters for enhanced security.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* DOMAIN & SSO TAB */}
                        {activeTab === 'domain' && (
                            <div className="max-w-3xl space-y-6">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800 mb-1">Domain & SSO</h3>
                                    <p className="text-sm text-slate-500">Verify your domain and enable Single Sign-On</p>
                                </div>

                                {company?._id && <DomainSettings companyId={company._id} />}

                                <div className="bg-white rounded-xl border border-slate-200 p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Zap className="w-4 h-4 text-slate-600" />
                                                <h4 className="text-sm font-bold text-slate-800">Single Sign-On (SSO)</h4>
                                                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">Enterprise</span>
                                            </div>
                                            <p className="text-xs text-slate-500">Enable SAML/OAuth SSO for your organization</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-not-allowed opacity-50">
                                            <input
                                                type="checkbox"
                                                checked={settings.ssoEnabled}
                                                disabled
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-indigo-600"></div>
                                        </label>
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        SSO is available on Enterprise plans. <button className="text-indigo-600 font-medium hover:underline bg-transparent border-none cursor-pointer p-0">Upgrade now</button>
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* NOTIFICATIONS TAB */}
                        {activeTab === 'notifications' && (
                            <div className="max-w-3xl space-y-6">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800 mb-1">Notification Preferences</h3>
                                    <p className="text-sm text-slate-500">Control what emails you receive as an admin</p>
                                </div>

                                <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                                    <div className="p-6 flex items-start justify-between">
                                        <div className="flex-1">
                                            <h4 className="text-sm font-bold text-slate-800 mb-1">New User Joined</h4>
                                            <p className="text-xs text-slate-500">Get notified when someone joins your company</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={settings.emailOnNewUser}
                                                onChange={(e) => setSettings({ ...settings, emailOnNewUser: e.target.checked })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                        </label>
                                    </div>

                                    <div className="p-6 flex items-start justify-between">
                                        <div className="flex-1">
                                            <h4 className="text-sm font-bold text-slate-800 mb-1">Workspace Created</h4>
                                            <p className="text-xs text-slate-500">Get notified when a new workspace is created</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={settings.emailOnWorkspaceCreate}
                                                onChange={(e) => setSettings({ ...settings, emailOnWorkspaceCreate: e.target.checked })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                        </label>
                                    </div>

                                    <div className="p-6 flex items-start justify-between">
                                        <div className="flex-1">
                                            <h4 className="text-sm font-bold text-slate-800 mb-1">Weekly Digest</h4>
                                            <p className="text-xs text-slate-500">Receive a weekly summary of company activity</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={settings.weeklyDigest}
                                                onChange={(e) => setSettings({ ...settings, weeklyDigest: e.target.checked })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* BILLING TAB */}
                        {activeTab === 'billing' && (
                            <div className="max-w-3xl space-y-6">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800 mb-1">Billing & Subscription</h3>
                                    <p className="text-sm text-slate-500">Manage your plan and payment methods</p>
                                </div>

                                <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <h4 className="text-2xl font-black mb-1">Pro Plan</h4>
                                            <p className="text-sm text-indigo-100">Active subscription</p>
                                        </div>
                                        <CreditCard className="w-8 h-8 text-indigo-200" />
                                    </div>
                                    <div className="flex items-baseline gap-2 mb-4">
                                        <span className="text-4xl font-black">$49</span>
                                        <span className="text-indigo-200">/month</span>
                                    </div>
                                    <button className="w-full bg-white text-indigo-600 px-4 py-2 rounded-lg font-bold hover:bg-indigo-50 transition-colors">
                                        Upgrade to Enterprise
                                    </button>
                                </div>

                                <div className="bg-white rounded-xl border border-slate-200 p-6">
                                    <h4 className="text-sm font-bold text-slate-800 mb-4">Payment Method</h4>
                                    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                                        <CreditCard className="w-8 h-8 text-slate-400" />
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-slate-900">•••• •••• •••• 4242</p>
                                            <p className="text-xs text-slate-500">Expires 12/2025</p>
                                        </div>
                                        <button className="text-sm text-indigo-600 font-medium hover:underline">Update</button>
                                    </div>
                                </div>

                                <div className="bg-white rounded-xl border border-slate-200 p-6">
                                    <h4 className="text-sm font-bold text-slate-800 mb-4">Billing History</h4>
                                    <div className="space-y-2">
                                        {[1, 2, 3].map((i) => (
                                            <div key={i} className="flex items-center justify-between py-2">
                                                <div>
                                                    <p className="text-sm font-medium text-slate-900">Dec {i}, 2025</p>
                                                    <p className="text-xs text-slate-500">Pro Plan - Monthly</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm font-bold text-slate-900">$49.00</span>
                                                    <button className="text-xs text-indigo-600 font-medium hover:underline flex items-center gap-1">
                                                        <Download size={12} /> PDF
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* USER DEFAULTS TAB */}
                        {activeTab === 'users' && (
                            <div className="max-w-3xl space-y-6">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800 mb-1">User Defaults</h3>
                                    <p className="text-sm text-slate-500">Set default settings for new users</p>
                                </div>

                                <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Default Role for New Users</label>
                                        <select
                                            value={settings.defaultRole}
                                            onChange={(e) => setSettings({ ...settings, defaultRole: e.target.value })}
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                        >
                                            <option value="member">Member (Standard)</option>
                                            <option value="manager">Manager</option>
                                            <option value="admin">Admin</option>
                                            <option value="guest">Guest (Limited)</option>
                                        </select>
                                        <p className="text-xs text-slate-400 mt-1">New users will be assigned this role by default</p>
                                    </div>

                                    <hr className="border-slate-100" />

                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h4 className="text-sm font-bold text-slate-800 mb-1">Auto-Approve Domain Join</h4>
                                            <p className="text-xs text-slate-500">Automatically approve users with verified domain email</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={settings.autoApproveJoin}
                                                onChange={(e) => setSettings({ ...settings, autoApproveJoin: e.target.checked })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* BRANDING TAB */}
                        {activeTab === 'branding' && (
                            <div className="max-w-3xl space-y-6">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800 mb-1">Branding & Appearance</h3>
                                    <p className="text-sm text-slate-500">Customize the look and feel</p>
                                </div>

                                <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Primary Color</label>
                                        <div className="flex items-center gap-4">
                                            <input
                                                type="color"
                                                value={settings.primaryColor}
                                                onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                                                className="w-16 h-16 rounded-lg border border-slate-200 cursor-pointer"
                                            />
                                            <div>
                                                <p className="text-sm font-medium text-slate-900">{settings.primaryColor}</p>
                                                <p className="text-xs text-slate-500">Used for buttons, links, and highlights</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Accent Color</label>
                                        <div className="flex items-center gap-4">
                                            <input
                                                type="color"
                                                value={settings.accentColor}
                                                onChange={(e) => setSettings({ ...settings, accentColor: e.target.value })}
                                                className="w-16 h-16 rounded-lg border border-slate-200 cursor-pointer"
                                            />
                                            <div>
                                                <p className="text-sm font-medium text-slate-900">{settings.accentColor}</p>
                                                <p className="text-xs text-slate-500">Used for success states and notifications</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
                                    <Palette className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-bold text-blue-900">Branding Preview</p>
                                        <p className="text-xs text-blue-700 mt-1">
                                            Changes will apply to your workspace after saving. Some elements may require a page refresh.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* DATA & PRIVACY TAB */}
                        {activeTab === 'data' && (
                            <div className="max-w-3xl space-y-6">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800 mb-1">Data & Privacy</h3>
                                    <p className="text-sm text-slate-500">Manage your company data and privacy settings</p>
                                </div>

                                <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-800 mb-3">Export Data</h4>
                                        <button className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <Download className="w-5 h-5 text-slate-600" />
                                                <div className="text-left">
                                                    <p className="text-sm font-medium text-slate-900">Export All Company Data</p>
                                                    <p className="text-xs text-slate-500">Download a complete backup of your data</p>
                                                </div>
                                            </div>
                                            <ExternalLink className="w-4 h-4 text-slate-400" />
                                        </button>
                                    </div>

                                    <div>
                                        <h4 className="text-sm font-bold text-slate-800 mb-3">Data Retention</h4>
                                        <select className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none">
                                            <option>Keep all data indefinitely</option>
                                            <option>Delete after 1 year</option>
                                            <option>Delete after 2 years</option>
                                            <option>Delete after 5 years</option>
                                        </select>
                                        <p className="text-xs text-slate-400 mt-1">How long to retain deleted messages and files</p>
                                    </div>
                                </div>

                                <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                                    <h4 className="text-sm font-bold text-red-900 mb-2 flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4" />
                                        Danger Zone
                                    </h4>
                                    <p className="text-xs text-red-700 mb-4">
                                        Permanent actions that cannot be undone
                                    </p>
                                    <button className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-colors">
                                        Delete Company Account
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AdminSettings;
