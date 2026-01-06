import React, { useState, useEffect, useRef } from 'react';
import { X, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

const OTPModal = ({ isOpen, onClose, target, targetType, onVerify, onResend }) => {
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
    const [isVerifying, setIsVerifying] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const inputRefs = useRef([]);

    // Timer countdown
    useEffect(() => {
        if (!isOpen || success) return;

        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isOpen, success]);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setOtp(['', '', '', '', '', '']);
            setTimeLeft(300);
            setError('');
            setSuccess(false);
            // Auto-focus first input
            setTimeout(() => inputRefs.current[0]?.focus(), 100);
        }
    }, [isOpen]);

    const handleChange = (index, value) => {
        // Only allow digits
        if (value && !/^\d$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);
        setError('');

        // Auto-focus next input
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index, e) => {
        // Handle backspace
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
        // Handle paste
        if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            navigator.clipboard.readText().then((text) => {
                const digits = text.replace(/\D/g, '').slice(0, 6);
                const newOtp = digits.split('').concat(Array(6 - digits.length).fill(''));
                setOtp(newOtp);
                const nextIndex = Math.min(digits.length, 5);
                inputRefs.current[nextIndex]?.focus();
            });
        }
    };

    const handleVerify = async () => {
        const otpString = otp.join('');
        if (otpString.length !== 6) {
            setError('Please enter all 6 digits');
            return;
        }

        setIsVerifying(true);
        setError('');

        try {
            await onVerify(otpString);
            setSuccess(true);
            setTimeout(() => {
                onClose();
            }, 1500);
        } catch (err) {
            setError(err.message || 'Invalid OTP. Please try again.');
            setOtp(['', '', '', '', '', '']);
            inputRefs.current[0]?.focus();
        } finally {
            setIsVerifying(false);
        }
    };

    const handleResend = async () => {
        setIsResending(true);
        setError('');

        try {
            await onResend();
            setOtp(['', '', '', '', '', '']);
            setTimeLeft(300);
            inputRefs.current[0]?.focus();
        } catch (err) {
            setError(err.message || 'Failed to resend OTP');
        } finally {
            setIsResending(false);
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={!success ? onClose : undefined}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 p-8 animate-slideUp">
                {/* Close Button */}
                {!success && (
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <X size={20} className="text-gray-500 dark:text-gray-400" />
                    </button>
                )}

                {!success ? (
                    <>
                        {/* Header */}
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 mx-auto mb-4 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
                                <svg className="w-8 h-8 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                                Verify {targetType === 'email' ? 'Email' : 'Phone'}
                            </h2>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Enter the 6-digit code sent to
                            </p>
                            <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mt-1">
                                {target}
                            </p>
                        </div>

                        {/* OTP Inputs */}
                        <div className="flex gap-2 justify-center mb-6">
                            {otp.map((digit, index) => (
                                <input
                                    key={index}
                                    ref={(el) => (inputRefs.current[index] = el)}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={1}
                                    value={digit}
                                    onChange={(e) => handleChange(index, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(index, e)}
                                    className={`w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 ${error
                                            ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                                            : 'border-gray-300 dark:border-gray-700 focus:border-indigo-500 dark:focus:border-indigo-400'
                                        } bg-white dark:bg-slate-800 text-gray-900 dark:text-white outline-none transition-all`}
                                />
                            ))}
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                                <AlertCircle size={16} />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Timer */}
                        <div className="text-center mb-6">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                {timeLeft > 0 ? (
                                    <>
                                        Code expires in{' '}
                                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                            {formatTime(timeLeft)}
                                        </span>
                                    </>
                                ) : (
                                    <span className="text-red-600 dark:text-red-400 font-semibold">
                                        Code expired
                                    </span>
                                )}
                            </p>
                        </div>

                        {/* Verify Button */}
                        <button
                            onClick={handleVerify}
                            disabled={otp.join('').length !== 6 || isVerifying}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-bold rounded-xl transition-all disabled:cursor-not-allowed mb-4"
                        >
                            {isVerifying ? (
                                <span className="flex items-center justify-center gap-2">
                                    <RefreshCw size={18} className="animate-spin" />
                                    Verifying...
                                </span>
                            ) : (
                                'Verify Code'
                            )}
                        </button>

                        {/* Resend Button */}
                        <button
                            onClick={handleResend}
                            disabled={timeLeft > 0 || isResending}
                            className="w-full py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 disabled:text-gray-400 dark:disabled:text-gray-600 font-semibold disabled:cursor-not-allowed transition-colors"
                        >
                            {isResending ? (
                                <span className="flex items-center justify-center gap-2">
                                    <RefreshCw size={16} className="animate-spin" />
                                    Resending...
                                </span>
                            ) : (
                                `Didn't receive the code? Resend`
                            )}
                        </button>
                    </>
                ) : (
                    /* Success State */
                    <div className="text-center py-8">
                        <div className="w-20 h-20 mx-auto mb-4 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                            <CheckCircle size={40} className="text-green-600 dark:text-green-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                            Verified Successfully!
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400">
                            Your {targetType} has been verified
                        </p>
                    </div>
                )}
            </div>

            <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
        </div>
    );
};

export default OTPModal;
