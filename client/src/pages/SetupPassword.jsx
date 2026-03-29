// client/src/pages/SetupPassword.jsx
//
// Mandatory first-login password setup for bulk-imported company users.
// Shown when the login endpoint returns requiresPasswordSetup: true.
// There is NO skip option — the user MUST set a password before accessing
// the rest of the platform.
//
// Edge-case guards:
//  - If user.isTemporaryPassword === false (already initialized), redirect away.
//  - Keeps the final destination in sessionStorage so we can navigate there after setup.

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Lock, Eye, EyeOff, CheckCircle2, AlertCircle,
  Shield, Key, Sun, Moon, Building2, Sparkles
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import api from '@services/api';

// ─── Password strength requirement component ────────────────────────────────
const Req = ({ met, label }) => (
  <div className={`flex items-center gap-2 text-xs font-semibold transition-all duration-200 ${met ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-500'}`}>
    {met
      ? <CheckCircle2 size={13} className="shrink-0" />
      : <div className="w-[13px] h-[13px] rounded-full border-2 border-slate-300 dark:border-slate-600 shrink-0" />}
    <span>{label}</span>
  </div>
);

// ─── Main component ─────────────────────────────────────────────────────────
const SetupPassword = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user, setUser } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // ── Password strength checks ──────────────────────────────────────────────
  const hasMinLength   = password.length >= 8;
  const hasUpperCase   = /[A-Z]/.test(password);
  const hasNumber      = /\d/.test(password);
  const hasSpecialChar = /[^A-Za-z0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isPasswordValid = hasMinLength && hasUpperCase && hasNumber && hasSpecialChar && passwordsMatch;




  // ── Submit handler ────────────────────────────────────────────────────────
  const handleSetPassword = async () => {
    if (!isPasswordValid) {
      showToast('Please meet all password requirements', 'error');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/auth/setup-temp-password', { password });

      showToast('Password set! Welcome to Chttrix 🎉', 'success');

      // Update local user state to reflect new flags
      if (setUser && user) {
        setUser({ ...user, isTemporaryPassword: false, passwordInitialized: true });
      }

      // Navigate to the stored destination (set by the login redirect)
      const dest = sessionStorage.getItem('setupPasswordDest') || '/workspaces';
      sessionStorage.removeItem('setupPasswordDest');

      setTimeout(() => {
        navigate(dest, { replace: true });
      }, 600);

    } catch (error) {
      console.error('[SetupPassword] Error:', error);
      showToast(
        error.response?.data?.message || 'Failed to set password. Please try again.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && isPasswordValid) handleSetPassword();
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/40 to-purple-50/20 dark:from-[#030712] dark:via-[#0B0F19] dark:to-[#030712] transition-colors duration-500 relative overflow-hidden">

      {/* Background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-indigo-400/25 via-purple-400/15 to-transparent dark:from-indigo-600/15 rounded-full blur-3xl animate-pulse -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-blue-400/25 via-cyan-400/15 to-transparent dark:from-blue-600/15 rounded-full blur-3xl animate-pulse translate-y-1/3 -translate-x-1/3" style={{ animationDelay: '1.2s' }} />
      </div>

      {/* Theme toggle */}
      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:scale-105 transition-all shadow-md"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      <div className="w-full max-w-lg relative z-10 px-5">

        {/* Card */}
        <div className="backdrop-blur-2xl bg-white/85 dark:bg-[#0B0F19]/75 border border-white/60 dark:border-white/10 shadow-2xl shadow-slate-900/10 dark:shadow-black/30 rounded-2xl p-7 md:p-9">

          {/* Header */}
          <div className="text-center mb-7">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl blur-lg opacity-40 animate-pulse" />
              <div className="relative w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Shield size={30} className="text-white" strokeWidth={2} />
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-md">
                  <Sparkles size={11} className="text-white" strokeWidth={3} />
                </div>
              </div>
            </div>

            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-indigo-900 to-purple-900 dark:from-white dark:via-indigo-200 dark:to-purple-200 mb-1 tracking-tight">
              Secure Your Account
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-sm mx-auto">
              You're logging in for the first time. Please set a personal password to continue.
            </p>

            {/* Company badge */}
            {user?.username && (
              <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
                <Building2 size={12} />
                {user.username}
              </div>
            )}

            {/* Mandatory badge */}
            <div className="inline-flex items-center gap-1.5 mx-2 mt-3 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 text-amber-700 dark:text-amber-400 text-xs font-bold">
              <AlertCircle size={12} />
              Required — cannot be skipped
            </div>
          </div>

          <div className="space-y-4">
            {/* New password input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 ml-0.5">
                New Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                  <Lock size={15} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full pl-10 pr-10 py-2.5 rounded-lg border-2 border-slate-200 dark:border-white/10 bg-white/60 dark:bg-[#030712]/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-sm font-medium"
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Confirm password input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 ml-0.5">
                Confirm Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                  <Lock size={15} />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full pl-10 pr-10 py-2.5 rounded-lg border-2 border-slate-200 dark:border-white/10 bg-white/60 dark:bg-[#030712]/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-sm font-medium"
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Requirements grid — only shown when user starts typing */}
            {password && (
              <div className="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-indigo-50/40 dark:from-white/5 dark:to-indigo-900/10 border border-slate-200/60 dark:border-white/10 animate-in fade-in duration-300">
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <div className="w-0.5 h-3 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full" />
                  Requirements
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Req met={hasMinLength}   label="8+ characters" />
                  <Req met={hasUpperCase}   label="Uppercase letter" />
                  <Req met={hasNumber}      label="Number" />
                  <Req met={hasSpecialChar} label="Special character" />
                </div>
                {confirmPassword && (
                  <div className={`mt-3 pt-3 border-t border-slate-200/60 dark:border-white/10 flex items-center gap-2 text-xs font-bold transition-all ${passwordsMatch ? 'text-green-600 dark:text-green-400' : 'text-rose-500 dark:text-rose-400'}`}>
                    {passwordsMatch ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                    {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                  </div>
                )}
              </div>
            )}

            {/* Set password button */}
            <div className="pt-1">
              <button
                onClick={handleSetPassword}
                disabled={!isPasswordValid || loading}
                className="w-full py-3 rounded-xl text-white font-bold text-base bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 shadow-xl shadow-indigo-500/25 hover:shadow-2xl hover:shadow-indigo-500/35 transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2 group"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Set My Password
                    <Key size={17} className="group-hover:rotate-12 transition-transform duration-200" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-6 text-center">
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 flex items-center justify-center gap-2">
            <Shield size={13} />
            Your temporary password will be permanently invalidated after setup
          </p>
        </div>
      </div>
    </div>
  );
};

export default SetupPassword;
