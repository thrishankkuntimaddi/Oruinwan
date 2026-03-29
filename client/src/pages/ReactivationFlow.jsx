import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Mail, KeyRound } from 'lucide-react';
import api from '@services/api';

const ReactivationFlow = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const emailFromUrl = searchParams.get('email') || '';

    const [email] = useState(emailFromUrl);
    const [otpCode, setOtpCode] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleReactivate = async (e) => {
        e.preventDefault();

        if (otpCode.length !== 6) {
            setError('Please enter a valid 6-digit code');
            return;
        }

        if (!password) {
            setError('Please enter your password');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await api.post(
                `/api/auth/reactivate/verify-otp`,
                { email, otpCode, password }
            );

            // Save access token
            if (response.data.accessToken) {
                localStorage.setItem('accessToken', response.data.accessToken);
            }

            // Show success message
            alert('Account reactivated successfully!');

            // Navigate to workspaces
            navigate('/workspaces');
        } catch (err) {
            setError(err.response?.data?.message || 'Reactivation failed. Please try again.');
            // Clear OTP if it's invalid
            if (err.response?.data?.message?.includes('OTP') || err.response?.data?.message?.includes('expired')) {
                setOtpCode('');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Lock className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
                        Reactivate Your Account
                    </h1>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        Enter the verification code sent to your email
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {/* Single Form with OTP + Password */}
                <form onSubmit={handleReactivate} className="space-y-6">
                    <div>
                        <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                            <Mail size={16} />
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            disabled
                            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-70"
                        />
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                            <KeyRound size={16} />
                            Verification Code
                        </label>
                        <input
                            type="text"
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="Enter 6-digit code"
                            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-center text-2xl tracking-widest font-bold"
                            maxLength={6}
                            autoFocus
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                            Check your email for the verification code (expires in 10 minutes)
                        </p>
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                            <Lock size={16} />
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || otpCode.length !== 6 || !password}
                        className="w-full py-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Reactivating...' : 'Reactivate Account'}
                    </button>
                </form>

                {/* Back to Login */}
                <div className="mt-6 text-center">
                    <button
                        onClick={() => navigate('/login')}
                        className="text-sm text-purple-600 dark:text-purple-400 hover:underline font-medium"
                    >
                        ← Back to Login
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReactivationFlow;
