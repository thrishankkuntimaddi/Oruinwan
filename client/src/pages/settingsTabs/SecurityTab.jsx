// client/src/pages/settingsTabs/SecurityTab.jsx
// Security settings: password change + full 2FA (TOTP) flow

import React, { useState, useEffect, useCallback } from 'react';
import { Eye, EyeOff, Shield, ShieldCheck, ShieldOff, Check, X, AlertCircle, Key, Loader, QrCode, Copy } from 'lucide-react';
import Card from './Card';
import api from '../../services/api';

// ── Password strength calculator ─────────────────────────────────────────────
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

// ── 2FA Step states ───────────────────────────────────────────────────────────
const STEP = { IDLE: 'idle', SETUP: 'setup', CONFIRMING: 'confirming', DISABLING: 'disabling' };

// ── SecurityTab component ─────────────────────────────────────────────────────
const SecurityTab = ({ passwordData, setPasswordData, showCurrentPassword, setShowCurrentPassword, loading, handlePasswordChange }) => {
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const strength = calculatePasswordStrength(passwordData.newPassword);

    // 2FA state
    const [tfaEnabled, setTfaEnabled] = useState(false);
    const [tfaStep, setTfaStep] = useState(STEP.IDLE);
    const [tfaSetup, setTfaSetup] = useState(null); // { secret, otpauthUrl }
    const [otpInput, setOtpInput] = useState('');
    const [tfaLoading, setTfaLoading] = useState(false);
    const [tfaError, setTfaError] = useState('');
    const [copied, setCopied] = useState(false);

    // Load 2FA status on mount
    const load2FAStatus = useCallback(async () => {
        try {
            const { data } = await api.get('/api/auth/2fa/status');
            setTfaEnabled(data.twoFactorEnabled);
        } catch { /* non-critical */ }
    }, []);

    useEffect(() => { load2FAStatus(); }, [load2FAStatus]);

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

    // 2FA: Start setup — call backend to get secret + QR URI
    const handleStartSetup = async () => {
        setTfaLoading(true);
        setTfaError('');
        try {
            const { data } = await api.post('/api/auth/2fa/setup');
            setTfaSetup(data);
            setTfaStep(STEP.SETUP);
        } catch (err) {
            setTfaError(err.response?.data?.message || 'Failed to start setup');
        } finally {
            setTfaLoading(false);
        }
    };

    // 2FA: Confirm OTP to enable
    const handleVerifySetup = async () => {
        if (!otpInput || otpInput.length < 6) {
            setTfaError('Enter the 6-digit code from your authenticator app');
            return;
        }
        setTfaLoading(true);
        setTfaError('');
        try {
            await api.post('/api/auth/2fa/verify-setup', { otp: otpInput });
            setTfaEnabled(true);
            setTfaStep(STEP.IDLE);
            setTfaSetup(null);
            setOtpInput('');
        } catch (err) {
            setTfaError(err.response?.data?.message || 'Invalid OTP. Try again.');
        } finally {
            setTfaLoading(false);
        }
    };

    // 2FA: Disable with OTP gate
    const handleDisable = async () => {
        if (!otpInput || otpInput.length < 6) {
            setTfaError('Enter your 6-digit OTP to disable 2FA');
            return;
        }
        setTfaLoading(true);
        setTfaError('');
        try {
            await api.post('/api/auth/2fa/disable', { otp: otpInput });
            setTfaEnabled(false);
            setTfaStep(STEP.IDLE);
            setOtpInput('');
        } catch (err) {
            setTfaError(err.response?.data?.message || 'Failed to disable 2FA');
        } finally {
            setTfaLoading(false);
        }
    };

    const handleCancelTfa = () => {
        setTfaStep(STEP.IDLE);
        setTfaSetup(null);
        setOtpInput('');
        setTfaError('');
    };

    const copySecret = () => {
        if (tfaSetup?.secret) {
            navigator.clipboard.writeText(tfaSetup.secret);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="space-y-4">
            {/* ── Password Section ──────────────────────────────────────── */}
            <Card title="Change Password" subtitle="Update your account password">
                <div className="space-y-4 max-w-lg">
                    <PasswordInput label="Current Password" fieldKey="currentPassword" show={showCurrentPassword} setShow={setShowCurrentPassword} placeholder="Enter current password" />
                    <div className="grid grid-cols-2 gap-3">
                        <PasswordInput label="New Password" fieldKey="newPassword" show={showNew} setShow={setShowNew} placeholder="New password" />
                        <PasswordInput label="Confirm Password" fieldKey="confirmPassword" show={showConfirm} setShow={setShowConfirm} placeholder="Confirm password" />
                    </div>

                    {passwordData.newPassword && (
                        <div className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[10.5px] font-bold uppercase tracking-widest text-gray-400">Strength</span>
                                <span className={`text-[11px] font-bold ${strength.score < 40 ? 'text-red-500' : strength.score < 60 ? 'text-orange-500' : strength.score < 80 ? 'text-yellow-600' : 'text-green-600'}`}>{strength.label}</span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div className={`h-full ${strength.color} transition-all duration-300 rounded-full`} style={{ width: `${strength.score}%` }} />
                            </div>
                            <div className="grid grid-cols-3 gap-x-3 gap-y-1">
                                {[['length', '8+ chars'], ['uppercase', 'Uppercase'], ['lowercase', 'Lowercase'], ['number', 'Number'], ['special', 'Symbol']].map(([k, l]) => (
                                    <div key={k} className={`flex items-center gap-1 text-[11px] ${strength.checks?.[k] ? 'text-green-600' : 'text-gray-400'}`}>
                                        {strength.checks?.[k] ? <Check size={10} /> : <X size={10} />}
                                        {l}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

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

            {/* ── 2FA Section ───────────────────────────────────────────── */}
            <Card title="Two-Factor Authentication" subtitle="Add extra security with a one-time password app">
                {/* Status header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${tfaEnabled ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-100 dark:bg-gray-800'}`}>
                            {tfaEnabled
                                ? <ShieldCheck size={16} className="text-green-600 dark:text-green-400" />
                                : <Shield size={16} className="text-gray-400" />}
                        </div>
                        <div>
                            <div className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">
                                Authenticator App (TOTP)
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`inline-flex h-1.5 w-1.5 rounded-full ${tfaEnabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                                <span className={`text-[11.5px] font-medium ${tfaEnabled ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                                    {tfaEnabled ? '2FA Enabled' : '2FA Disabled'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {tfaStep === STEP.IDLE && (
                        <button
                            onClick={tfaEnabled ? () => setTfaStep(STEP.DISABLING) : handleStartSetup}
                            disabled={tfaLoading}
                            className={`flex items-center gap-2 px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-colors ${tfaEnabled
                                ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                        >
                            {tfaLoading ? <Loader size={13} className="animate-spin" /> : null}
                            {tfaEnabled ? <><ShieldOff size={13} />Disable 2FA</> : <><Key size={13} />Enable 2FA</>}
                        </button>
                    )}
                </div>

                {/* Error message */}
                {tfaError && (
                    <div className="mb-3 flex items-center gap-2 p-2.5 bg-red-50 dark:bg-red-900/20 rounded-lg text-[12px] text-red-600 dark:text-red-400">
                        <AlertCircle size={13} />{tfaError}
                    </div>
                )}

                {/* ── SETUP STEP 1: Show QR code ───────────── */}
                {tfaStep === STEP.SETUP && tfaSetup && (
                    <div className="space-y-4 border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-gray-50 dark:bg-gray-800/50">
                        <div>
                            <p className="text-[12.5px] font-semibold text-gray-700 dark:text-gray-200 mb-1">Step 1 — Scan with your authenticator app</p>
                            <p className="text-[11.5px] text-gray-500 dark:text-gray-400">Open Google Authenticator, Authy, or any TOTP app and scan the QR code below.</p>
                        </div>

                        {/* QR Code rendered via Google Charts (no extra library) */}
                        <div className="flex flex-col sm:flex-row gap-4 items-start">
                            <div className="border-4 border-white dark:border-gray-700 rounded-xl overflow-hidden shadow-md flex-shrink-0">
                                <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(tfaSetup.otpauthUrl)}`}
                                    alt="2FA QR Code"
                                    className="w-40 h-40"
                                />
                            </div>
                            <div className="flex-1 space-y-2.5">
                                <p className="text-[11.5px] text-gray-500 dark:text-gray-400">Can't scan? Enter this key manually:</p>
                                <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg">
                                    <code className="flex-1 text-[11px] font-mono text-gray-700 dark:text-gray-200 break-all select-all">
                                        {tfaSetup.secret}
                                    </code>
                                    <button onClick={copySecret} className="text-gray-400 hover:text-blue-500 transition-colors flex-shrink-0" title="Copy">
                                        {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div>
                            <p className="text-[12.5px] font-semibold text-gray-700 dark:text-gray-200 mb-2">Step 2 — Enter the 6-digit OTP to confirm</p>
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                value={otpInput}
                                onChange={e => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="000000"
                                className={`${inputClass} max-w-[140px] text-center font-mono text-lg tracking-[0.5em]`}
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={handleVerifySetup}
                                disabled={tfaLoading || otpInput.length < 6}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-[12.5px] font-semibold rounded-lg transition-colors disabled:opacity-50"
                            >
                                {tfaLoading ? <Loader size={13} className="animate-spin" /> : <Check size={13} />}
                                Confirm & Enable 2FA
                            </button>
                            <button onClick={handleCancelTfa} className="px-4 py-2 text-gray-500 text-[12.5px] font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* ── DISABLING STEP: OTP gate ──────────────── */}
                {tfaStep === STEP.DISABLING && (
                    <div className="space-y-3 border border-red-200 dark:border-red-800 rounded-xl p-4 bg-red-50 dark:bg-red-900/10">
                        <div className="flex items-start gap-2">
                            <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                            <p className="text-[12px] text-red-700 dark:text-red-400">
                                Disabling 2FA reduces your account security. Enter your current OTP to confirm.
                            </p>
                        </div>
                        <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={otpInput}
                            onChange={e => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="000000"
                            className={`${inputClass} max-w-[140px] text-center font-mono text-lg tracking-[0.5em]`}
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={handleDisable}
                                disabled={tfaLoading || otpInput.length < 6}
                                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-[12.5px] font-semibold rounded-lg transition-colors disabled:opacity-50"
                            >
                                {tfaLoading ? <Loader size={13} className="animate-spin" /> : <ShieldOff size={13} />}
                                Disable 2FA
                            </button>
                            <button onClick={handleCancelTfa} className="px-4 py-2 text-gray-500 text-[12.5px] font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* If idle and enabled, show info box */}
                {tfaStep === STEP.IDLE && tfaEnabled && (
                    <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg">
                        <p className="text-[12px] text-green-700 dark:text-green-400">
                            ✅ Your account is protected with two-factor authentication. You'll be asked for a 6-digit OTP at login on new devices.
                        </p>
                    </div>
                )}

                {/* If idle and disabled, show benefit description */}
                {tfaStep === STEP.IDLE && !tfaEnabled && (
                    <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <p className="text-[12px] text-amber-700 dark:text-amber-400">
                            ⚠️ 2FA is not enabled. Enable it to protect your account even if your password is compromised.
                        </p>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default SecurityTab;
