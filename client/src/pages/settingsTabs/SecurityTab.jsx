import React, { useState } from 'react';
import { Eye, EyeOff, Shield, Check, X, AlertCircle } from 'lucide-react';

import Card from './Card';
import Input from '../../shared/components/ui/Input';
import Button from '../../shared/components/ui/Button';

// Password strength calculator
const calculatePasswordStrength = (password) => {
    if (!password) return { score: 0, label: '', color: '' };

    let score = 0;
    const checks = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /[0-9]/.test(password),
        special: /[^A-Za-z0-9]/.test(password)
    };

    // Calculate score
    if (checks.length) score += 20;
    if (checks.uppercase) score += 20;
    if (checks.lowercase) score += 20;
    if (checks.number) score += 20;
    if (checks.special) score += 20;

    // Determine label and color
    let label = '';
    let color = '';
    if (score < 40) {
        label = 'Weak';
        color = 'bg-red-500';
    } else if (score < 60) {
        label = 'Fair';
        color = 'bg-orange-500';
    } else if (score < 80) {
        label = 'Good';
        color = 'bg-yellow-500';
    } else {
        label = 'Strong';
        color = 'bg-green-500';
    }

    return { score, label, color, checks };
};

/**
 * SecurityTab - Password and 2FA settings with strength indicator
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
    const [showNewPasswordField, setShowNewPasswordField] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const passwordStrength = calculatePasswordStrength(passwordData.newPassword);

    return (
        <div className="space-y-6 animate-fade-in-up">
            <Card title="Password" subtitle="Manage your password and authentication">
                <div className="max-w-xl space-y-5">
                    <div>
                        <Input
                            label="Current Password"
                            type={showCurrentPassword ? "text" : "password"}
                            value={passwordData.currentPassword}
                            onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                            placeholder="Enter current password"
                            icon={
                                <button
                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                    type="button"
                                    className="text-slate-400 hover:text-slate-600 focus:outline-none"
                                >
                                    {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            }
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <Input
                                label="New Password"
                                type={showNewPasswordField ? "text" : "password"}
                                value={passwordData.newPassword}
                                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                placeholder="New password"
                                icon={
                                    <button
                                        onClick={() => setShowNewPasswordField(!showNewPasswordField)}
                                        type="button"
                                        className="text-slate-400 hover:text-slate-600 focus:outline-none"
                                    >
                                        {showNewPasswordField ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                }
                            />
                        </div>
                        <div>
                            <Input
                                label="Confirm New Password"
                                type={showConfirmPassword ? "text" : "password"}
                                value={passwordData.confirmPassword}
                                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                placeholder="Confirm password"
                                icon={
                                    <button
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        type="button"
                                        className="text-slate-400 hover:text-slate-600 focus:outline-none"
                                    >
                                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                }
                            />
                        </div>
                    </div>

                    {/* Password Strength Indicator */}
                    {passwordData.newPassword && (
                        <div className="space-y-3 p-4 bg-slate-50 dark:bg-white/5 rounded-lg">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Password Strength</span>
                                <span className={`text-xs font-bold ${passwordStrength.score < 40 ? 'text-red-600' :
                                    passwordStrength.score < 60 ? 'text-orange-600' :
                                        passwordStrength.score < 80 ? 'text-yellow-600' :
                                            'text-green-600'
                                    }`}>
                                    {passwordStrength.label}
                                </span>
                            </div>

                            {/* Strength Bar */}
                            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className={`h-full ${passwordStrength.color} transition-all duration-300`}
                                    style={{ width: `${passwordStrength.score}%` }}
                                />
                            </div>

                            {/* Requirements Checklist */}
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className={`flex items-center gap-1.5 ${passwordStrength.checks.length ? 'text-green-600' : 'text-slate-400'}`}>
                                    {passwordStrength.checks.length ? <Check size={12} /> : <X size={12} />}
                                    <span>8+ characters</span>
                                </div>
                                <div className={`flex items-center gap-1.5 ${passwordStrength.checks.uppercase ? 'text-green-600' : 'text-slate-400'}`}>
                                    {passwordStrength.checks.uppercase ? <Check size={12} /> : <X size={12} />}
                                    <span>Uppercase</span>
                                </div>
                                <div className={`flex items-center gap-1.5 ${passwordStrength.checks.lowercase ? 'text-green-600' : 'text-slate-400'}`}>
                                    {passwordStrength.checks.lowercase ? <Check size={12} /> : <X size={12} />}
                                    <span>Lowercase</span>
                                </div>
                                <div className={`flex items-center gap-1.5 ${passwordStrength.checks.number ? 'text-green-600' : 'text-slate-400'}`}>
                                    {passwordStrength.checks.number ? <Check size={12} /> : <X size={12} />}
                                    <span>Number</span>
                                </div>
                                <div className={`flex items-center gap-1.5 ${passwordStrength.checks.special ? 'text-green-600' : 'text-slate-400'}`}>
                                    {passwordStrength.checks.special ? <Check size={12} /> : <X size={12} />}
                                    <span>Special char</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Password mismatch warning */}
                    {passwordData.newPassword && passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                            <AlertCircle size={16} />
                            <span>Passwords do not match</span>
                        </div>
                    )}

                    <div className="pt-2">
                        <Button
                            onClick={handlePasswordChange}
                            disabled={loading || !passwordData.currentPassword || !passwordData.newPassword || passwordData.newPassword !== passwordData.confirmPassword}
                            isLoading={loading}
                            variant="primary" // Changed to primary/indigo to match other tabs, or keep dark if intended. Assuming primary is better.
                        >
                            Update Password
                        </Button>
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
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Coming soon: Setup 2FA for enhanced security</p>
                        </div>
                    </div>
                    <Button
                        variant="secondary"
                        disabled
                        className="opacity-50 cursor-not-allowed"
                    >
                        Enable 2FA
                    </Button>
                </div>
            </Card>
        </div>
    );
};

export default SecurityTab;
