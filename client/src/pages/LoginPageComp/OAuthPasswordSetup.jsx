// client/src/pages/LoginPageComp/OAuthPasswordSetup.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, Check, Shield, ArrowRight } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import api from '../../services/api';

const OAuthPasswordSetup = () => {
    const { showToast } = useToast();
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [provider, setProvider] = useState('OAuth');

    useEffect(() => {
        // Check if user is supposed to be here
        const setupRequired = localStorage.getItem("oauthPasswordSetupRequired");
        const oauthProvider = localStorage.getItem("oauthProvider");

        if (!setupRequired) {
            // Redirect away if they shouldn't be here
            navigate("/workspaces");
            return;
        }

        if (oauthProvider) {
            setProvider(oauthProvider.charAt(0).toUpperCase() + oauthProvider.slice(1));
        }
    }, [navigate]);

    // Password strength indicators
    const hasMinLength = password.length >= 8;
    const passwordsMatch = password && password === confirmPassword;

    const isPasswordValid = hasMinLength && passwordsMatch;

    const handleSetPassword = async () => {
        if (!isPasswordValid) {
            showToast('Please meet all password requirements', 'error');
            return;
        }

        setLoading(true);

        try {
            await api.post('/api/auth/oauth/set-password', { password });

            showToast('Password set successfully! You can now login with email & password.', 'success');

            // Clear the setup flags
            localStorage.removeItem("oauthPasswordSetupRequired");
            localStorage.removeItem("oauthProvider");

            // Wait a moment then redirect
            setTimeout(() => {
                navigate('/workspaces');
            }, 1500);

        } catch (error) {
            console.error('Password setup error:', error);
            showToast(
                error.response?.data?.message || 'Failed to set password',
                'error'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8 text-white text-center">
                    <Shield className="w-16 h-16 mx-auto mb-4" />
                    <h1 className="text-3xl font-bold mb-2">Secure Your Account</h1>
                    <p className="text-indigo-100">Set up a backup password for {provider} login</p>
                </div>

                {/* Content */}
                <div className="p-8">
                    <div className="mb-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                        <p className="text-sm text-indigo-900 dark:text-indigo-200 font-medium">
                            🔐 Why set a password?
                        </p>
                        <ul className="mt-2 space-y-1 text-sm text-indigo-700 dark:text-indigo-300">
                            <li>• Backup access if {provider} is unavailable</li>
                            <li>• Login from any device without {provider}</li>
                            <li>• Enhanced security for your account</li>
                        </ul>
                    </div>

                    {/* Password Field */}
                    <div className="mb-4">
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            New Password
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-12 py-3 border border-gray-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900 dark:text-white transition-all"
                                placeholder="Enter password (min 8 characters)"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>

                    {/* Confirm Password Field */}
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
                                placeholder="Confirm your password"
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
                    {password && (
                        <div className="mb-6 p-4 bg-gray-50 dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700">
                            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Password Requirements:</p>
                            <div className="space-y-1">
                                <div className={`flex items-center gap-2 text-xs ${hasMinLength ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                    {hasMinLength ? <Check size={14} /> : <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-300"></span>}
                                    <span>At least 8 characters</span>
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

                    {/* Set Password Button */}
                    <button
                        onClick={handleSetPassword}
                        disabled={!isPasswordValid || loading}
                        className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30"
                    >
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Setting Password...
                            </>
                        ) : (
                            <>
                                <Lock size={18} />
                                Set Password
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>

                    <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-4">
                        After setting your password, you'll be able to login using either {provider} or your email & password
                    </p>
                </div>
            </div>
        </div>
    );
};

export default OAuthPasswordSetup;
