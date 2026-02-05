import React, { useState } from 'react';
import { Lock, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';

/**
 * Password Unlock Modal
 * 
 * Appears when user has password-protected identity keys
 * but session is rehydrated without password.
 * 
 * This is NOT a crypto bug - it's expected behavior for:
 * - Page refresh
 * - New device login
 * - Session rehydration
 */
export default function PasswordUnlockModal({ onSubmit }) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleUnlock = async (e) => {
        e.preventDefault();

        if (!password.trim()) {
            setError('Password is required');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await onSubmit(password);
            // Success - modal will be closed by parent component
        } catch (err) {
            console.error('❌ [UNLOCK] Password unlock failed:', err);
            setError(err.message || 'Incorrect password. Please try again.');
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !loading) {
            handleUnlock(e);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center animate-fade-in backdrop-blur-sm p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="unlock-modal-title"
        >
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
                {/* Header */}
                <div className="p-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                            <Lock size={24} strokeWidth={2} />
                        </div>
                        <div>
                            <h2 id="unlock-modal-title" className="text-xl font-bold">
                                Unlock Encryption
                            </h2>
                            <p className="text-indigo-100 text-sm mt-0.5">
                                Enter your password to access secure messaging
                            </p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <form onSubmit={handleUnlock} className="p-6 space-y-4">
                    {/* Info Message */}
                    <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <AlertCircle size={18} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-900 dark:text-blue-100">
                            <p className="font-medium">Your messages are encrypted</p>
                            <p className="text-blue-700 dark:text-blue-300 mt-1">
                                To decrypt your conversation history, please enter your account password.
                            </p>
                        </div>
                    </div>

                    {/* Password Input */}
                    <div>
                        <label
                            htmlFor="unlock-password"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                        >
                            Password
                        </label>
                        <div className="relative">
                            <input
                                id="unlock-password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    setError(null);
                                }}
                                onKeyDown={handleKeyDown}
                                placeholder="Enter your password"
                                autoFocus
                                autoComplete="current-password"
                                disabled={loading}
                                className={`
                  w-full px-4 py-3 pr-12 border rounded-lg 
                  bg-white dark:bg-gray-800 
                  text-gray-900 dark:text-gray-100
                  placeholder-gray-400 dark:placeholder-gray-500
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${error ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600'}
                `}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded"
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-200">
                            <AlertCircle size={16} className="flex-shrink-0" />
                            <p>{error}</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-col gap-3 pt-2">
                        <button
                            type="submit"
                            disabled={loading || !password.trim()}
                            className="
                w-full py-3 px-4 
                bg-indigo-600 hover:bg-indigo-700 
                disabled:bg-gray-300 dark:disabled:bg-gray-700
                text-white font-medium rounded-lg 
                transition-colors duration-200
                flex items-center justify-center gap-2
                disabled:cursor-not-allowed
                shadow-lg shadow-indigo-500/30
              "
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    <span>Unlocking...</span>
                                </>
                            ) : (
                                <>
                                    <Lock size={18} />
                                    <span>Unlock Encryption</span>
                                </>
                            )}
                        </button>

                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                            Your password is never stored and is only used to decrypt your encryption keys.
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
}
