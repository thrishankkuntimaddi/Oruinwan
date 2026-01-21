import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, Check, AlertCircle, Shield, X, Key, CheckCircle2, Sun, Moon } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import axios from 'axios';

const SetPassword = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { user } = useAuth();
    const { theme, toggleTheme } = useTheme();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [skipPassword, setSkipPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    // Password strength indicators
    const hasMinLength = password.length >= 8;
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const hasUpperCase = /[A-Z]/.test(password);
    const passwordsMatch = password && password === confirmPassword;

    const isPasswordValid = hasMinLength && hasNumber && hasSpecialChar && hasUpperCase && passwordsMatch;

    // Redirect if user is not OAuth or already has password set
    useEffect(() => {
        if (!user) return;

        // Redirect to workspaces if this is not an OAuth user or password is already set
        if (user.authProvider === 'local' || user.passwordSetAt) {
            navigate('/workspaces', { replace: true });
        }
    }, [user, navigate]);

    const handleSetPassword = async () => {
        if (!isPasswordValid) {
            showToast('Please meet all password requirements', 'error');
            return;
        }

        setLoading(true);
        try {
            await axios.post('/api/auth/oauth/set-password', {
                password
            }, { withCredentials: true });

            showToast('Password set successfully!', 'success');

            // Clear the OAuth setup flag
            localStorage.removeItem("oauthPasswordSetupRequired");
            localStorage.removeItem("oauthProvider");

            // Redirect to workspaces
            setTimeout(() => {
                navigate('/workspaces', { replace: true });
            }, 500);

        } catch (error) {
            console.error('Password set error:', error);
            showToast(
                error.response?.data?.message || 'Failed to set password',
                'error'
            );
        } finally {
            setLoading(false);
        }
    };

    const handleSkip = async () => {
        setLoading(true);
        try {
            await axios.post('/api/auth/oauth/skip-password', {}, { withCredentials: true });

            showToast('You can set a password later from settings', 'info');

            // Clear the OAuth setup flag
            localStorage.removeItem("oauthPasswordSetupRequired");
            localStorage.removeItem("oauthProvider");

            // Redirect to workspaces
            setTimeout(() => {
                navigate('/workspaces', { replace: true });
            }, 500);

        } catch (error) {
            console.error('Skip password error:', error);
            showToast(
                error.response?.data?.message || 'Failed to skip password setup',
                'error'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-[#030712] transition-colors duration-500 relative overflow-hidden">
            {/* Background Effects */}
            <div className={`absolute inset-0 transition-opacity duration-500 ${theme === 'dark' ? 'opacity-100' : 'opacity-0'}`}>
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2"></div>
            </div>

            <div className={`absolute inset-0 transition-opacity duration-500 ${theme === 'dark' ? 'opacity-0' : 'opacity-100'}`}>
                <div className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-blue-100/60 via-purple-100/30 to-transparent blur-[80px]"></div>
                <div className="absolute top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-gradient-to-bl from-indigo-100/60 via-pink-100/30 to-transparent blur-[80px]"></div>
            </div>

            {/* Toggle Theme (Top Right) */}
            <div className="absolute top-6 right-6 z-50">
                <button
                    onClick={toggleTheme}
                    className="p-3 rounded-xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-md border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-700/80 transition-all shadow-sm"
                >
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>
            </div>

            <div className="w-full max-w-lg relative z-10 px-6">

                {/* Glass Card */}
                <div className="backdrop-blur-xl bg-white/70 dark:bg-[#0B0F19]/60 border border-white/50 dark:border-white/10 shadow-2xl rounded-3xl p-8 md:p-10 transition-all duration-300">

                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 mx-auto bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/30 transform rotate-3 hover:rotate-6 transition-transform">
                            <Shield size={32} className="text-white" />
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-3">Secure Your Account</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-lg leading-relaxed">
                            You signed in with {user?.authProvider}. Set a password to enable email login.
                        </p>
                    </div>

                    <div className="space-y-6">
                        {/* Password Input */}
                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">New Password</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                                    <Lock size={20} />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-12 pr-12 py-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#030712]/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-medium"
                                    placeholder="Enter new password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Confirm Password</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                                    <Lock size={20} />
                                </div>
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full pl-12 pr-12 py-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#030712]/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-medium"
                                    placeholder="Confirm new password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                >
                                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        {/* Password Requirements */}
                        <div className={`p-5 rounded-2xl border transition-all duration-300 ${password ? 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 opacity-100 max-h-96' : 'opacity-0 max-h-0 overflow-hidden p-0 border-none'}`}>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Password Requirements</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className={`flex items-center gap-2 text-sm font-medium transition-colors ${hasMinLength ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-500'}`}>
                                    {hasMinLength ? <CheckCircle2 size={16} /> : <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600"></div>}
                                    <span>8+ characters</span>
                                </div>
                                <div className={`flex items-center gap-2 text-sm font-medium transition-colors ${hasUpperCase ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-500'}`}>
                                    {hasUpperCase ? <CheckCircle2 size={16} /> : <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600"></div>}
                                    <span>Uppercase letter</span>
                                </div>
                                <div className={`flex items-center gap-2 text-sm font-medium transition-colors ${hasNumber ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-500'}`}>
                                    {hasNumber ? <CheckCircle2 size={16} /> : <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600"></div>}
                                    <span>One number</span>
                                </div>
                                <div className={`flex items-center gap-2 text-sm font-medium transition-colors ${hasSpecialChar ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-500'}`}>
                                    {hasSpecialChar ? <CheckCircle2 size={16} /> : <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600"></div>}
                                    <span>Special char</span>
                                </div>
                            </div>
                            {confirmPassword && (
                                <div className={`mt-4 pt-3 border-t border-slate-200 dark:border-white/10 flex items-center gap-2 text-sm font-bold transition-colors ${passwordsMatch ? 'text-green-600 dark:text-green-400' : 'text-rose-500 dark:text-rose-400'}`}>
                                    {passwordsMatch ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                                    <span>{passwordsMatch ? 'Passwords match' : 'Passwords do not match'}</span>
                                </div>
                            )}
                        </div>

                        {/* Skip Option */}
                        <div className="pt-2">
                            <label className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer group ${skipPassword ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' : 'bg-transparent border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={skipPassword}
                                        onChange={(e) => setSkipPassword(e.target.checked)}
                                        className="peer sr-only"
                                    />
                                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${skipPassword ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-400 dark:border-slate-500'}`}>
                                        {skipPassword && <Check size={14} strokeWidth={4} />}
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <span className={`block font-bold text-sm ${skipPassword ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-700 dark:text-slate-300'}`}>
                                        Skip for now
                                    </span>
                                    <span className={`block text-xs mt-0.5 ${skipPassword ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400'}`}>
                                        You can set this later in account settings
                                    </span>
                                </div>
                            </label>
                        </div>

                        {/* Actions */}
                        <div className="pt-2">
                            {skipPassword ? (
                                <button
                                    onClick={handleSkip}
                                    disabled={loading}
                                    className="w-full py-4 rounded-xl border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-bold text-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-all flex items-center justify-center gap-2 shadow-sm"
                                >
                                    {loading ? (
                                        <div className="w-6 h-6 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            Skip Setup <X size={20} />
                                        </>
                                    )}
                                </button>
                            ) : (
                                <button
                                    onClick={handleSetPassword}
                                    disabled={!isPasswordValid || loading}
                                    className="w-full py-4 rounded-xl text-white font-bold text-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            Set Password <Key size={20} />
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className={`mt-8 text-center text-xs font-medium transition-colors duration-500 ${theme === 'dark' ? 'text-white/20' : 'text-slate-300'}`}>
                    Secure Authentication System
                </div>
            </div>
        </div>
    );
};

export default SetPassword;
