import React from 'react';
import { ChevronLeft, Key, Shield, CheckCircle2, Check, Laptop, Smartphone, Monitor, LogOut, AlertCircle, Trash2 } from 'lucide-react';
import PasswordInput from '../shared/PasswordInput';

/**
 * SecurityView Component
 * Password management, 2FA toggle, active sessions, and account deletion
 */
const SecurityView = ({
    user,
    passData,
    setPassData,
    showPasswords,
    setShowPasswords,
    sessions,
    onBack,
    onSavePassword,
    onLogoutSession,
    onLogoutAllSessions,
    onDeleteAccount
}) => {
    return (
        <div className="w-80 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col animate-fade-in max-h-[80vh]">
            <div className="p-4 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50 sticky top-0 z-10">
                <button onClick={onBack} className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white flex items-center text-xs font-bold transition-colors">
                    <ChevronLeft size={14} className="mr-1" /> Back
                </button>
                <span className="font-bold text-gray-900 dark:text-white text-sm">Security</span>
                <div className="w-8"></div>
            </div>

            <div className="p-5 overflow-y-auto custom-scrollbar space-y-8">
                {/* Password Section */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-2">
                        <Key size={16} className="text-gray-400" />
                        <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wide">Password</h4>
                    </div>

                    {/* OAuth Info Banner - Show if user signed up with OAuth */}
                    {user?.authProvider && user.authProvider !== 'local' && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                                <div className="flex-shrink-0 mt-0.5">
                                    {user.authProvider === 'google' && (
                                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                        </svg>
                                    )}
                                    {user.authProvider === 'github' && (
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                                        </svg>
                                    )}
                                    {user.authProvider === 'linkedin' && (
                                        <svg className="w-4 h-4" fill="#0077B5" viewBox="0 0 24 24">
                                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                                        </svg>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-bold text-blue-900 dark:text-blue-300">
                                            Signed up with {user.authProvider.charAt(0).toUpperCase() + user.authProvider.slice(1)}
                                        </p>
                                        {user.passwordSetAt && (
                                            <div className="flex items-center gap-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                                                <CheckCircle2 size={12} />
                                                <span className="text-[10px] font-bold">Password Set</span>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-blue-700 dark:text-blue-400 mt-0.5">
                                        {user.passwordSetAt
                                            ? 'You can login with either OAuth or email + password'
                                            : 'Set a password to enable email + password login as an alternative'
                                        }
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Show "Current Password" field ONLY for users who signed up with email (local auth) */}
                    {(!user?.authProvider || user.authProvider === 'local') && (
                        <PasswordInput
                            label="Current Password"
                            value={passData.old}
                            onChange={e => setPassData({ ...passData, old: e.target.value })}
                            show={showPasswords.old}
                            onToggle={() => setShowPasswords(prev => ({ ...prev, old: !prev.old }))}
                            fieldType="current"
                        />
                    )}

                    <div>
                        <PasswordInput
                            label="New Password"
                            value={passData.new}
                            onChange={e => setPassData({ ...passData, new: e.target.value })}
                            show={showPasswords.new}
                            onToggle={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                            fieldType="new"
                        />

                        {/* Password Rules Checklist */}
                        <div className="mt-3 grid grid-cols-2 gap-2 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                            <div className={`text-[10px] flex items-center font-medium ${passData.new.length >= 8 ? "text-green-600 dark:text-green-400" : "text-gray-400"}`}>
                                <span className="mr-1.5">{passData.new.length >= 8 ? <Check size={10} /> : <div className="w-2.5 h-2.5 rounded-full border border-gray-300 dark:border-gray-600"></div>}</span> 8+ chars
                            </div>

                            <div className={`text-[10px] flex items-center font-medium ${/[A-Z]/.test(passData.new) ? "text-green-600 dark:text-green-400" : "text-gray-400"}`}>
                                <span className="mr-1.5">{/[A-Z]/.test(passData.new) ? <Check size={10} /> : <div className="w-2.5 h-2.5 rounded-full border border-gray-300 dark:border-gray-600"></div>}</span> Uppercase
                            </div>
                            <div className={`text-[10px] flex items-center font-medium ${/\d/.test(passData.new) ? "text-green-600 dark:text-green-400" : "text-gray-400"}`}>
                                <span className="mr-1.5">{/\d/.test(passData.new) ? <Check size={10} /> : <div className="w-2.5 h-2.5 rounded-full border border-gray-300 dark:border-gray-600"></div>}</span> Number
                            </div>
                            <div className={`text-[10px] flex items-center font-medium ${/[!@#$%^&*(),.?":{}|<>]/.test(passData.new) ? "text-green-600 dark:text-green-400" : "text-gray-400"}`}>
                                <span className="mr-1.5">{/[!@#$%^&*(),.?":{}|<>]/.test(passData.new) ? <Check size={10} /> : <div className="w-2.5 h-2.5 rounded-full border border-gray-300 dark:border-gray-600"></div>}</span> Special
                            </div>
                        </div>
                    </div>

                    <PasswordInput
                        label="Confirm New Password"
                        value={passData.confirm}
                        onChange={e => setPassData({ ...passData, confirm: e.target.value })}
                        show={showPasswords.confirm}
                        onToggle={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                        fieldType="confirm"
                    />

                    <button onClick={onSavePassword} className="w-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all">
                        {user?.authProvider && user.authProvider !== 'local' ? 'Set Password' : 'Update Password'}
                    </button>
                </div>

                {/* 2FA Section */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-2">
                        <Shield size={16} className="text-gray-400" />
                        <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wide">Two-Factor Authentication</h4>
                    </div>
                    <div className="flex items-center justify-between py-2">
                        <div>
                            <div className="text-sm font-bold text-gray-900 dark:text-white">Enable 2FA</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Add an extra layer of security</div>
                        </div>
                        <button className="bg-gray-200 relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                            <span className="translate-x-0 pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"></span>
                        </button>
                    </div>
                </div>

                {/* Active Sessions Section */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-2">
                        <Laptop size={16} className="text-gray-400" />
                        <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wide">Logged-in Devices</h4>
                    </div>
                    <div className="space-y-3">
                        {sessions.map((session) => (
                            <div key={session.id} className="flex items-start justify-between p-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-300">
                                        {session.type === 'laptop' ? <Laptop size={18} /> : session.type === 'mobile' ? <Smartphone size={18} /> : <Monitor size={18} />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                                                {session.device}
                                                {session.browser && <span className="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">• {session.browser}</span>}
                                            </span>
                                            {session.current && <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-bold rounded-full">Current</span>}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{session.location} • {session.lastActive}</div>
                                    </div>
                                </div>
                                {!session.current && (
                                    <button
                                        onClick={() => onLogoutSession(session.id)}
                                        className="text-xs font-bold text-gray-500 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                                    >
                                        Log Out
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    {sessions.length > 1 && (
                        <button
                            onClick={onLogoutAllSessions}
                            className="w-full border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex items-center justify-center gap-2"
                        >
                            <LogOut size={14} />
                            Log Out All Other Devices
                        </button>
                    )}
                </div>

                {/* Delete Account Section - Personal Users Only */}
                {user?.userType === "personal" && !user?.companyId && (
                    <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-800">
                        <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-2">
                            <AlertCircle size={16} className="text-red-400" />
                            <h4 className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wide">
                                Danger Zone
                            </h4>
                        </div>
                        <button
                            onClick={onDeleteAccount}
                            className="w-full border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex items-center justify-center gap-2"
                        >
                            <Trash2 size={14} />
                            Delete Account Permanently
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SecurityView;
