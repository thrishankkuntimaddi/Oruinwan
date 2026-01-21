import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, Check, AlertCircle, Shield, Key, CheckCircle2, Sun, Moon, Sparkles, ArrowRight } from 'lucide-react';
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
        <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-[#030712] dark:via-[#0B0F19] dark:to-[#030712] transition-colors duration-500 relative overflow-hidden">
            {/* Enhanced Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {/* Animated gradient orbs */}
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-indigo-400/30 via-purple-400/20 to-transparent dark:from-indigo-600/20 dark:via-purple-600/10 rounded-full blur-3xl animate-pulse -translate-y-1/3 translate-x-1/3"></div>
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-blue-400/30 via-cyan-400/20 to-transparent dark:from-blue-600/20 dark:via-cyan-600/10 rounded-full blur-3xl animate-pulse translate-y-1/3 -translate-x-1/3" style={{ animationDelay: '1s' }}></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-gradient-to-br from-pink-400/20 via-rose-400/10 to-transparent dark:from-pink-600/10 dark:via-rose-600/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
            </div>

            {/* Toggle Theme (Top Right) */}
            <div className="absolute top-8 right-8 z-50">
                <button
                    onClick={toggleTheme}
                    className="p-3 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-all shadow-lg shadow-slate-900/5 hover:shadow-xl hover:scale-105 active:scale-95"
                >
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>
            </div>

            <div className="w-full max-w-lg relative z-10 px-6">

                {/* Main Glass Card - Compacted */}
                <div className="backdrop-blur-2xl bg-white/80 dark:bg-[#0B0F19]/70 border border-white/60 dark:border-white/10 shadow-2xl shadow-slate-900/10 dark:shadow-black/20 rounded-2xl p-6 md:p-8 transition-all duration-300 hover:shadow-3xl hover:border-white/80 dark:hover:border-white/20">

                    {/* Header with Icon and Title - Compacted */}
                    <div className="text-center mb-6">
                        <div className="relative w-14 h-14 mx-auto mb-4">
                            {/* Glowing background */}
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl blur-lg opacity-50 animate-pulse"></div>
                            {/* Icon container */}
                            <div className="relative w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30 transform rotate-3 hover:rotate-6 transition-transform">
                                <Shield size={28} className="text-white" strokeWidth={2.5} />
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-md">
                                    <Sparkles size={10} className="text-white" strokeWidth={3} />
                                </div>
                            </div>
                        </div>
                        <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-indigo-900 to-purple-900 dark:from-white dark:via-indigo-200 dark:to-purple-200 mb-2 tracking-tight">
                            Secure Your Account
                        </h1>
                        <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed max-w-sm mx-auto">
                            You signed in with <span className="font-bold text-indigo-600 dark:text-indigo-400">{user?.authProvider}</span>. Set a password to enable email login.
                        </p>
                    </div>

                    <div className="space-y-4">
                        {/* Password Input - Compacted */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 ml-1">New Password</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                                    <Lock size={16} />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-10 py-2.5 rounded-lg border-2 border-slate-200 dark:border-white/10 bg-white/50 dark:bg-[#030712]/50 text-slate-900 dark:text-white dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium text-sm"
                                    placeholder="Enter new password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password - Compacted */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 ml-1">Confirm Password</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                                    <Lock size={16} />
                                </div>
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full pl-10 pr-10 py-2.5 rounded-lg border-2 border-slate-200 dark:border-white/10 bg-white/50 dark:bg-[#030712]/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium text-sm"
                                    placeholder="Confirm new password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                >
                                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* Password Requirements - Compacted */}
                        {password && (
                            <div className="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-blue-50/50 dark:from-white/5 dark:to-indigo-900/10 border border-slate-200/60 dark:border-white/10 transition-all duration-300 animate-fadeIn">
                                <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                    <div className="w-0.5 h-3 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></div>
                                    Password Requirements
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className={`flex items-center gap-2 text-xs font-semibold transition-all ${hasMinLength ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-500'}`}>
                                        {hasMinLength ? <CheckCircle2 size={14} className="shrink-0" /> : <div className="w-[14px] h-[14px] rounded-full border-2 border-slate-300 dark:border-slate-600 shrink-0"></div>}
                                        <span>8+ chars</span>
                                    </div>
                                    <div className={`flex items-center gap-2 text-xs font-semibold transition-all ${hasUpperCase ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-500'}`}>
                                        {hasUpperCase ? <CheckCircle2 size={14} className="shrink-0" /> : <div className="w-[14px] h-[14px] rounded-full border-2 border-slate-300 dark:border-slate-600 shrink-0"></div>}
                                        <span>Uppercase</span>
                                    </div>
                                    <div className={`flex items-center gap-2 text-xs font-semibold transition-all ${hasNumber ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-500'}`}>
                                        {hasNumber ? <CheckCircle2 size={14} className="shrink-0" /> : <div className="w-[14px] h-[14px] rounded-full border-2 border-slate-300 dark:border-slate-600 shrink-0"></div>}
                                        <span>Number</span>
                                    </div>
                                    <div className={`flex items-center gap-2 text-xs font-semibold transition-all ${hasSpecialChar ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-500'}`}>
                                        {hasSpecialChar ? <CheckCircle2 size={14} className="shrink-0" /> : <div className="w-[14px] h-[14px] rounded-full border-2 border-slate-300 dark:border-slate-600 shrink-0"></div>}
                                        <span>Special</span>
                                    </div>
                                </div>
                                {confirmPassword && (
                                    <div className={`mt-3 pt-3 border-t border-slate-200/60 dark:border-white/10 flex items-center gap-2 text-xs font-bold transition-all ${passwordsMatch ? 'text-green-600 dark:text-green-400' : 'text-rose-500 dark:text-rose-400'}`}>
                                        {passwordsMatch ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                                        <span>{passwordsMatch ? 'Passwords match' : 'Passwords do not match'}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Skip Option - Compacted */}
                        <div className="pt-1">
                            <label className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer group ${skipPassword ? 'bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/20 border-indigo-300 dark:border-indigo-700 shadow-md shadow-indigo-500/10' : 'bg-white/40 dark:bg-transparent border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 hover:border-slate-300 dark:hover:border-white/20'}`}>
                                <div className="relative flex items-center pt-0.5">
                                    <input
                                        type="checkbox"
                                        checked={skipPassword}
                                        onChange={(e) => setSkipPassword(e.target.checked)}
                                        className="peer sr-only"
                                    />
                                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${skipPassword ? 'bg-gradient-to-br from-indigo-600 to-purple-600 border-indigo-600 text-white' : 'border-slate-400 dark:border-slate-500'}`}>
                                        {skipPassword && <Check size={12} strokeWidth={4} />}
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

                        {/* Actions - Compacted */}
                        <div className="pt-2">
                            {skipPassword ? (
                                <button
                                    onClick={handleSkip}
                                    disabled={loading}
                                    className="w-full py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 font-bold text-base hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 group"
                                >
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            Skip Setup
                                            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                        </>
                                    )}
                                </button>
                            ) : (
                                <button
                                    onClick={handleSetPassword}
                                    disabled={!isPasswordValid || loading}
                                    className="w-full py-3 rounded-xl text-white font-bold text-base bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-size-200 bg-pos-0 hover:bg-pos-100 shadow-xl shadow-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-500/40 transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2 group"
                                >
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            Set Password
                                            <Key size={18} className="group-hover:rotate-12 transition-transform" />
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Text */}
                <div className="mt-8 text-center">
                    <p className="text-sm font-medium text-slate-400 dark:text-slate-500 flex items-center justify-center gap-2">
                        <Shield size={16} />
                        Secure Authentication System
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SetPassword;
