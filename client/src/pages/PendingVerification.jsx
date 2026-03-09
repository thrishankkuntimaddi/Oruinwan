import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ArrowLeft, Shield, CheckCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

const PendingVerification = () => {
    const navigate = useNavigate();
    const { theme } = useTheme();
    const { logout } = useAuth();

    return (
        <div className="min-h-screen w-full bg-white dark:bg-[#030712] relative overflow-hidden font-sans selection:bg-indigo-500 selection:text-white flex flex-col items-center justify-center p-6 transition-colors duration-500">

            {/* Background Effects */}
            <div className={`absolute inset-0 transition-opacity duration-1000 ${theme === 'dark' ? 'opacity-100' : 'opacity-0'}`}>
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2"></div>
            </div>

            <div className={`absolute inset-0 transition-opacity duration-1000 ${theme === 'dark' ? 'opacity-0' : 'opacity-100'}`}>
                <div className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-blue-50 via-purple-50 to-transparent blur-[100px]"></div>
            </div>

            {/* Content Card */}
            <div className="relative z-10 w-full max-w-lg bg-white/70 dark:bg-slate-900/50 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/50 dark:border-white/10 p-8 md:p-12 text-center animate-fade-in-up">

                {/* Icon Animation */}
                <div className="relative w-24 h-24 mx-auto mb-8">
                    <div className="absolute inset-0 bg-blue-100 dark:bg-blue-900/30 rounded-full animate-ping opacity-75"></div>
                    <div className="relative w-full h-full bg-blue-50 dark:bg-blue-900/50 rounded-full flex items-center justify-center border-4 border-white dark:border-slate-800 shadow-xl">
                        <Clock className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="absolute -bottom-2 -right-2 bg-white dark:bg-slate-800 rounded-full p-2 shadow-lg border border-gray-100 dark:border-gray-700">
                        <Shield className="w-5 h-5 text-indigo-500" />
                    </div>
                </div>

                <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">
                    Verification Pending
                </h1>

                <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
                    Thanks for applying! Your company registration is currently under review by our administration team.
                </p>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 mb-8 text-left border border-slate-100 dark:border-slate-700/50">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        What's Next?
                    </h3>
                    <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                        <li className="flex gap-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 mt-2 shrink-0"></span>
                            <span>We will review your provided documents and details.</span>
                        </li>
                        <li className="flex gap-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 mt-2 shrink-0"></span>
                            <span>You will receive an email notification once approved.</span>
                        </li>
                        <li className="flex gap-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 mt-2 shrink-0"></span>
                            <span>Usually takes 2-4 hours during business days.</span>
                        </li>
                    </ul>
                </div>

                <button
                    onClick={async () => {
                        await logout();
                        navigate('/login');
                    }}
                    className="group flex items-center justify-center gap-2 w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:bg-slate-800 dark:hover:bg-slate-100 transition-all transform hover:-translate-y-1 shadow-lg hover:shadow-xl"
                >
                    <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                    Logout
                </button>
            </div>

            {/* Footer */}
            <div className="absolute bottom-6 text-xs text-slate-400 dark:text-slate-600 font-medium">
                &copy; 2026 Chttrix Inc.
            </div>
        </div>
    );
};

export default PendingVerification;
