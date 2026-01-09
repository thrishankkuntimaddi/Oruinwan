// client/src/pages/admin/AdminSettingsLimited.jsx
// Limited Settings for Admin (NOT Owner) - Only Notifications and User Defaults

import React, { useState } from 'react';
import {
    Bell, Users, Check, AlertCircle
} from 'lucide-react';

const AdminSettingsLimited = () => {
    const [activeTab, setActiveTab] = useState('notifications');
    const [isSaving, setIsSaving] = useState(false);

    // Mock state for settings (would come from backend)
    const [settings, setSettings] = useState({
        // Notifications
        emailOnNewUser: true,
        emailOnWorkspaceCreate: true,
        weeklyDigest: true,
        emailOnDepartmentCreate: true,
        emailOnSecurityAlert: true,

        // User Defaults
        defaultRole: 'member',
        autoApproveJoin: false,
    });

    const tabs = [
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'users', label: 'User Defaults', icon: Users },
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
        <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
            {/* Header */}
            <header className="h-16 px-8 flex items-center justify-between z-10 bg-white dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700 shadow-sm">
                <div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-white">Admin Settings</h2>
                    <p className="text-xs text-slate-500 dark:text-gray-400 font-medium">Configure your admin preferences</p>
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
                <div className="w-64 bg-white dark:bg-gray-800 border-r border-slate-200 dark:border-gray-700 overflow-y-auto custom-scrollbar">
                    <nav className="p-4 space-y-1">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id
                                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                        : 'text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700'
                                        }`}
                                >
                                    <Icon size={18} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </nav>

                    {/* Info Box */}
                    <div className="m-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                        <div className="flex gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-bold text-amber-900 dark:text-amber-300">Limited Access</p>
                                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                                    As an admin, you have access to limited settings. Billing and security settings are managed by the workspace owner.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {/* NOTIFICATIONS TAB */}
                    {activeTab === 'notifications' && (
                        <div className="max-w-3xl space-y-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Notification Preferences</h3>
                                <p className="text-sm text-slate-500 dark:text-gray-400">Control what emails you receive as an admin</p>
                            </div>

                            <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 divide-y divide-slate-100 dark:divide-gray-700">
                                <div className="p-6 flex items-start justify-between">
                                    <div className="flex-1">
                                        <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-1">New User Joined</h4>
                                        <p className="text-xs text-slate-500 dark:text-gray-400">Get notified when someone joins your company</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={settings.emailOnNewUser}
                                            onChange={(e) => setSettings({ ...settings, emailOnNewUser: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-slate-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300/50 dark:peer-focus:ring-indigo-800/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>

                                <div className="p-6 flex items-start justify-between">
                                    <div className="flex-1">
                                        <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-1">Workspace Created</h4>
                                        <p className="text-xs text-slate-500 dark:text-gray-400">Get notified when a new workspace is created</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={settings.emailOnWorkspaceCreate}
                                            onChange={(e) => setSettings({ ...settings, emailOnWorkspaceCreate: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-slate-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300/50 dark:peer-focus:ring-indigo-800/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>

                                <div className="p-6 flex items-start justify-between">
                                    <div className="flex-1">
                                        <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-1">Department Created</h4>
                                        <p className="text-xs text-slate-500 dark:text-gray-400">Get notified when a new department is created</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={settings.emailOnDepartmentCreate}
                                            onChange={(e) => setSettings({ ...settings, emailOnDepartmentCreate: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-slate-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300/50 dark:peer-focus:ring-indigo-800/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>

                                <div className="p-6 flex items-start justify-between">
                                    <div className="flex-1">
                                        <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-1">Security Alerts</h4>
                                        <p className="text-xs text-slate-500 dark:text-gray-400">Get notified of security events and suspicious activity</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={settings.emailOnSecurityAlert}
                                            onChange={(e) => setSettings({ ...settings, emailOnSecurityAlert: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-slate-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300/50 dark:peer-focus:ring-indigo-800/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>

                                <div className="p-6 flex items-start justify-between">
                                    <div className="flex-1">
                                        <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-1">Weekly Digest</h4>
                                        <p className="text-xs text-slate-500 dark:text-gray-400">Receive a weekly summary of company activity</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={settings.weeklyDigest}
                                            onChange={(e) => setSettings({ ...settings, weeklyDigest: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-slate-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300/50 dark:peer-focus:ring-indigo-800/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* USER DEFAULTS TAB */}
                    {activeTab === 'users' && (
                        <div className="max-w-3xl space-y-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">User Defaults</h3>
                                <p className="text-sm text-slate-500 dark:text-gray-400">Set default settings for new users</p>
                            </div>

                            <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-6 space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-gray-300 mb-2">Default Role for New Users</label>
                                    <select
                                        value={settings.defaultRole}
                                        onChange={(e) => setSettings({ ...settings, defaultRole: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                    >
                                        <option value="member">Member (Standard)</option>
                                        <option value="manager">Manager</option>
                                        <option value="guest">Guest (Limited)</option>
                                    </select>
                                    <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">New users will be assigned this role by default</p>
                                </div>

                                <hr className="border-slate-100 dark:border-gray-700" />

                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-1">Auto-Approve Domain Join</h4>
                                        <p className="text-xs text-slate-500 dark:text-gray-400">Automatically approve users with verified domain email</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={settings.autoApproveJoin}
                                            onChange={(e) => setSettings({ ...settings, autoApproveJoin: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-slate-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300/50 dark:peer-focus:ring-indigo-800/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>
                            </div>

                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex gap-3">
                                <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-bold text-blue-900 dark:text-blue-300">Note</p>
                                    <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                                        These settings apply to new users joining the organization. Existing users are not affected.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminSettingsLimited;
