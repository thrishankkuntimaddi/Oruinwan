// client/src/components/E2EESetup.jsx
/**
 * E2EE Setup Component
 * Modal for first-time E2EE setup on signup or later
 */

import React, { useState } from 'react';
import { useEncryption } from '../hooks/useEncryption';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Shield, X } from 'lucide-react';

/**
 * Modal component for E2EE setup
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {function} props.onClose - Close callback
 * @param {function} props.onComplete - Completion callback
 */
function E2EESetup({ isOpen, onClose, onComplete }) {
    const { user } = useAuth();
    const { initializeEncryption, loading } = useEncryption(user?.sub || user?._id);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSetup = async (e) => {
        e.preventDefault();
        setError('');

        // Validation
        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        try {
            const result = await initializeEncryption(password);
            if (result) {
                setSuccess(true);
                setTimeout(() => {
                    onComplete?.();
                    onClose?.();
                }, 1500);
            } else {
                setError('Failed to initialize encryption');
            }
        } catch (err) {
            setError(err.message || 'Setup failed');
        }
    };

    const handleSkip = () => {
        onClose?.();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
                {/* Close button */}
                <button
                    onClick={handleSkip}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                    <X size={20} />
                </button>

                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                        <Shield size={24} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                            Enable End-to-End Encryption
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Secure your direct messages
                        </p>
                    </div>
                </div>

                {success ? (
                    <div className="py-8 text-center">
                        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Lock size={32} className="text-green-600 dark:text-green-400" />
                        </div>
                        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            E2EE Enabled Successfully!
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                            Your messages are now encrypted
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Info */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                                <strong>What is E2EE?</strong> End-to-end encryption ensures only you and your
                                conversation partner can read messages. Not even the server can decrypt them.
                            </p>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSetup} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Enter your account password
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Password"
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Confirm password
                                </label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm password"
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    required
                                />
                            </div>

                            {error && (
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={handleSkip}
                                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                    disabled={loading}
                                >
                                    Skip for now
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Setting up...
                                        </>
                                    ) : (
                                        <>
                                            <Lock size={16} />
                                            Enable E2EE
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>

                        {/* Security note */}
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
                            🔒 Your private key will be encrypted with your password and stored securely
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}

export default E2EESetup;
