import React, { useState } from 'react';
import { Eye, EyeOff, Shield, Check, X, AlertCircle } from 'lucide-react';
import Card from './Card';

const calculatePasswordStrength = (password) => {
    if (!password) return { score: 0, label: '', color: '' };
    const checks = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /[0-9]/.test(password),
        special: /[^A-Za-z0-9]/.test(password),
    };
    const score = Object.values(checks).filter(Boolean).length * 20;
    let label = 'Weak', color = 'bg-red-500';
    if (score >= 80) { label = 'Strong'; color = 'bg-green-500'; }
    else if (score >= 60) { label = 'Good'; color = 'bg-yellow-500'; }
    else if (score >= 40) { label = 'Fair'; color = 'bg-orange-500'; }
    return { score, label, color, checks };
};

const inputClass = "w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[12.5px] text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all";
const labelClass = "block text-[10.5px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1.5";

const SecurityTab = ({ passwordData, setPasswordData, showCurrentPassword, setShowCurrentPassword, loading, handlePasswordChange }) => {
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const strength = calculatePasswordStrength(passwordData.newPassword);

    const PasswordInput = ({ label, fieldKey, show, setShow, placeholder }) => (
        <div>
            <label className={labelClass}>{label}</label>
            <div className="relative">
                <input
                    type={show ? 'text' : 'password'}
                    value={passwordData[fieldKey]}
                    onChange={e => setPasswordData({ ...passwordData, [fieldKey]: e.target.value })}
                    className={`${inputClass} pr-9`}
                    placeholder={placeholder}
                />
                <button type="button" onClick={() => setShow(!show)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {show ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
            </div>
        </div>
    );

    return (
        <div className="space-y-4">
            <Card title="Change Password" subtitle="Update your account password">
                <div className="space-y-4 max-w-lg">
                    <PasswordInput label="Current Password" fieldKey="currentPassword" show={showCurrentPassword} setShow={setShowCurrentPassword} placeholder="Enter current password" />

                    <div className="grid grid-cols-2 gap-3">
                        <PasswordInput label="New Password" fieldKey="newPassword" show={showNew} setShow={setShowNew} placeholder="New password" />
                        <PasswordInput label="Confirm Password" fieldKey="confirmPassword" show={showConfirm} setShow={setShowConfirm} placeholder="Confirm password" />
                    </div>

                    {/* Strength indicator */}
                    {passwordData.newPassword && (
                        <div className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[10.5px] font-bold uppercase tracking-widest text-gray-400">Strength</span>
                                <span className={`text-[11px] font-bold ${strength.score < 40 ? 'text-red-500' : strength.score < 60 ? 'text-orange-500' : strength.score < 80 ? 'text-yellow-600' : 'text-green-600'}`}>
                                    {strength.label}
                                </span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div className={`h-full ${strength.color} transition-all duration-300 rounded-full`} style={{ width: `${strength.score}%` }} />
                            </div>
                            <div className="grid grid-cols-3 gap-x-3 gap-y-1">
                                {[
                                    ['length', '8+ chars'],
                                    ['uppercase', 'Uppercase'],
                                    ['lowercase', 'Lowercase'],
                                    ['number', 'Number'],
                                    ['special', 'Symbol'],
                                ].map(([k, l]) => (
                                    <div key={k} className={`flex items-center gap-1 text-[11px] ${strength.checks?.[k] ? 'text-green-600' : 'text-gray-400'}`}>
                                        {strength.checks?.[k] ? <Check size={10} /> : <X size={10} />}
                                        {l}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Mismatch warning */}
                    {passwordData.newPassword && passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
                        <div className="flex items-center gap-2 text-[12px] text-red-500">
                            <AlertCircle size={13} /> Passwords do not match
                        </div>
                    )}

                    <div className="flex justify-end">
                        <button
                            onClick={handlePasswordChange}
                            disabled={loading || !passwordData.currentPassword || !passwordData.newPassword || passwordData.newPassword !== passwordData.confirmPassword}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[12.5px] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Updating…' : 'Update Password'}
                        </button>
                    </div>
                </div>
            </Card>

            <Card title="Two-Factor Authentication" subtitle="Add extra security to your account">
                <div className="flex items-center justify-between">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                            <Shield size={16} className="text-gray-500 dark:text-gray-400" />
                        </div>
                        <div>
                            <div className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">Authenticator App</div>
                            <p className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-0.5">Use Google Authenticator or Authy for 2FA codes.</p>
                            <p className="text-[11px] text-gray-400 mt-1">Coming soon</p>
                        </div>
                    </div>
                    <button disabled className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-400 text-[12px] font-semibold rounded-lg cursor-not-allowed opacity-60">
                        Enable 2FA
                    </button>
                </div>
            </Card>
        </div>
    );
};

export default SecurityTab;
