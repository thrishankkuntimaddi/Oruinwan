import React from 'react';
import { Eye, EyeOff, Shield, Loader } from 'lucide-react';
import Card from './Card';

/**
 * SecurityTab - Password and 2FA settings
 * @param {object} props - Component props
 * @param {object} props.passwordData - Password form state
 * @param {function} props.setPasswordData - Update password form
 * @param {boolean} props.showCurrentPassword - Show/hide current password state
 * @param {function} props.setShowCurrentPassword - Toggle password visibility
 * @param {boolean} props.showNewPassword - Show/hide new password state
 * @param {boolean} props.loading - Loading state
 * @param {function} props.handlePasswordChange - Change password handler
 */
const SecurityTab = ({
    passwordData,
    setPasswordData,
    showCurrentPassword,
    setShowCurrentPassword,
    showNewPassword,
    loading,
    handlePasswordChange
}) => {
    return (
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
};

export default SecurityTab;
