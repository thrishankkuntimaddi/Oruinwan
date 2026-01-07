// client/src/components/auth/FirstLoginPasswordModal.jsx
import React, { useState } from 'react';
import { Lock, Eye, EyeOff, Check, AlertCircle } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import axios from 'axios';

const FirstLoginPasswordModal = ({ isOpen, onContinue, companyName }) => {
    const { showToast } = useToast();

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    // Password strength indicators
    const hasMinLength = newPassword.length >= 8;
    const hasNumber = /\d/.test(newPassword);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
    const hasUpperCase = /[A-Z]/.test(newPassword);
    const passwordsMatch = newPassword && newPassword === confirmPassword;

    const isPasswordValid = hasMinLength && hasNumber && hasSpecialChar && hasUpperCase && passwordsMatch;

    const handleChangePassword = async () => {
        if (!isPasswordValid) {
            showToast('Please meet all password requirements', 'error');
            return;
        }

        setLoading(true);

        try {
            await axios.post('/api/auth/change-password', {
                newPassword
            }, { withCredentials: true });

            showToast('Password changed successfully!', 'success');

            // Proceed to dashboard
            setTimeout(() => {
                onContinue();
            }, 500);

        } catch (error) {
            console.error('Password change error:', error);
            showToast(
                error.response?.data?.message || 'Failed to change password',
                'error'
            );
        } finally {
            setLoading(false);
        }
    };

    const handleSkip = () => {
        showToast('You can change your password later from settings', 'info');
        onContinue();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-[300] flex items-center justify-center backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-[500px] overflow-hidden transition-colors">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-black p-8 text-white text-center">
                    <h1 className="text-3xl font-bold mb-2">Welcome to {companyName}!</h1>
                    <p className="text-indigo-100">Let's secure your account</p>
                </div>

                {/* Content */}
                <div className="p-8">
                    <div className="mb-6">
                        <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                        <p className="text-center text-gray-700 dark:text-gray-300 text-sm">
                            For security, we recommend changing your temporary password.
                            You can skip this step and do it later in settings.
                        </p>
                    </div>

                    {/* New Password */}
                    <div className="mb-4">
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            New Password
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type={showNewPassword ? "text" : "password"}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full pl-10 pr-12 py-3 border border-gray-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900 dark:text-white transition-all"
                                placeholder="Enter new password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                                {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>

                    {/* Confirm Password */}
                    <div className="mb-4">
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            Confirm Password
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full pl-10 pr-12 py-3 border border-gray-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900 dark:text-white transition-all"
                                placeholder="Confirm new password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>

                    {/* Password Requirements */}
                    {newPassword && (
                        <div className="mb-6 p-4 bg-gray-50 dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700">
                            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Password Requirements:</p>
                            <div className="space-y-1">
                                <div className={`flex items-center gap-2 text-xs ${hasMinLength ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                    {hasMinLength ? <Check size={14} /> : <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-300"></span>}
                                    <span>At least 8 characters</span>
                                </div>
                                <div className={`flex items-center gap-2 text-xs ${hasUpperCase ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                    {hasUpperCase ? <Check size={14} /> : <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-300"></span>}
                                    <span>One uppercase letter</span>
                                </div>
                                <div className={`flex items-center gap-2 text-xs ${hasNumber ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                    {hasNumber ? <Check size={14} /> : <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-300"></span>}
                                    <span>One number</span>
                                </div>
                                <div className={`flex items-center gap-2 text-xs ${hasSpecialChar ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                    {hasSpecialChar ? <Check size={14} /> : <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-300"></span>}
                                    <span>One special character (!@#$%^&*)</span>
                                </div>
                                {confirmPassword && (
                                    <div className={`flex items-center gap-2 text-xs ${passwordsMatch ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {passwordsMatch ? <Check size={14} /> : <span className="w-3.5 h-3.5 rounded-full border-2 border-red-500"></span>}
                                        <span>Passwords match</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={handleChangePassword}
                            disabled={!isPasswordValid || loading}
                            className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Changing Password...
                                </>
                            ) : (
                                <>
                                    <Lock size={18} />
                                    Change Password
                                </>
                            )}
                        </button>

                        <button
                            onClick={handleSkip}
                            disabled={loading}
                            className="w-full py-3 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                        >
                            Skip for Now
                        </button>
                    </div>

                    <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-4">
                        You can always change your password later in Account Settings
                    </p>
                </div>
            </div>
        </div>
    );
};

export default FirstLoginPasswordModal;
