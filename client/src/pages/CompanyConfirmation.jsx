import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle, FileText, ArrowRight, Building, Sparkles, Mail, Phone, Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const CompanyConfirmation = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [accepted, setAccepted] = useState(false);
    const { theme, toggleTheme } = useTheme();

    const company = user?.company || {};
    const adminProfile = user || {};

    const handleConfirm = async () => {
        if (!accepted) return;
        setIsLoading(true);
        try {
            await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/companies/${company.id}/start-setup`, {
                plan: "free",
                acceptedTerms: true
            }, { withCredentials: true });

            navigate('/company/setup');
        } catch (err) {
            console.error("Setup Start Error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    if (!user) return null;

    return (
        <div className="min-h-screen w-full bg-white dark:bg-[#030712] relative overflow-hidden font-sans flex flex-col items-center justify-center p-6 transition-colors duration-500">

            {/* Dark Mode Toggle */}
            <div className="absolute top-6 right-6 z-50">
                <button
                    onClick={toggleTheme}
                    className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>
            </div>

            {/* Background Effects */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <div className={`absolute -top-[10%] -left-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-indigo-100/40 via-purple-50/40 to-transparent blur-[100px] transition-opacity duration-1000 ${theme === 'dark' ? 'opacity-20' : 'opacity-100'}`}></div>
                <div className={`absolute top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-gradient-to-bl from-blue-100/40 via-teal-50/40 to-transparent blur-[100px] transition-opacity duration-1000 ${theme === 'dark' ? 'opacity-20' : 'opacity-100'}`}></div>
            </div>

            <div className="max-w-5xl w-full bg-white/70 dark:bg-slate-900/60 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 dark:shadow-none border border-white/60 dark:border-white/10 overflow-hidden relative z-10 flex flex-col md:flex-row transition-all animate-fadeIn">

                {/* Left Side: Detail Summary */}
                <div className="w-full md:w-5/12 bg-slate-900 dark:bg-black text-white p-10 flex flex-col justify-between relative overflow-hidden">
                    {/* Abstract Shapes */}
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-600/30 to-transparent z-0"></div>
                    <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl"></div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/10 shadow-lg">
                                <Building className="text-indigo-300" size={28} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-xl font-bold">{company.name}</h3>
                                <p className="text-sm text-slate-400">{company.domain || "No domain connected"}</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Primary Admin</h4>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-300 font-bold border border-indigo-500/30">
                                        {adminProfile.name?.charAt(0) || 'A'}
                                    </div>
                                    <div>
                                        <p className="font-medium text-white">{adminProfile.name}</p>
                                        <p className="text-xs text-slate-400 flex items-center gap-1">
                                            <Mail size={10} /> {adminProfile.email}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            {company.phone && (
                                <div>
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Contact</h4>
                                    <p className="text-sm text-white flex items-center gap-2">
                                        <Phone size={14} className="text-slate-400" /> {company.phone}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="relative z-10 mt-10 p-5 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10">
                        <div className="flex items-center gap-3 mb-2">
                            <Sparkles size={16} className="text-yellow-400" />
                            <p className="text-xs text-slate-300 font-bold uppercase tracking-wider">Plan Details</p>
                        </div>
                        <p className="font-bold text-xl text-white">Enterprise Trial</p>
                        <p className="text-xs text-slate-400 mt-1">Full access to all features for 14 days.</p>
                    </div>
                </div>

                {/* Right Side: Action */}
                <div className="w-full md:w-7/12 p-10 md:p-12 flex flex-col bg-white/40 dark:bg-transparent">
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-6">
                            <span className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-full bg-green-100/80 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-bold uppercase tracking-wider border border-green-200 dark:border-green-800">
                                <CheckCircle size={12} strokeWidth={3} /> Verified
                            </span>
                            <div className="flex items-center gap-2 text-slate-800 dark:text-white font-bold text-xl">
                                <img src="/chttrix-logo.jpg" alt="Chttrix" className="w-8 h-8 rounded-lg shadow-sm" />
                                Chttrix
                            </div>
                        </div>

                        <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-3 tracking-tight">One Last Step</h1>
                        <p className="text-slate-600 dark:text-slate-400 text-lg">
                            Review your workspace details and accept the terms to initialize your environment.
                        </p>
                    </div>

                    <div className="flex-1 space-y-4 mb-10">
                        {/* Terms Box */}
                        <div className="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                    <FileText size={20} />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-slate-900 dark:text-white text-base">Terms of Service</h4>
                                    <div className="h-32 overflow-y-auto custom-scrollbar my-3 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700 leading-relaxed">
                                        <p className="font-bold mb-1">1. Acceptance of Terms</p>
                                        <p className="mb-2">By accessing and using Chttrix, you agree to be bound by these Terms. If you do not agree, do not use the service.</p>
                                        <p className="font-bold mb-1">2. User Responsibilities</p>
                                        <p className="mb-2">You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>
                                        <p className="font-bold mb-1">3. Data Privacy</p>
                                        <p>We collect and use your data as described in our Privacy Policy. We do not sell your personal data to third parties.</p>
                                    </div>
                                    <label className="flex items-center gap-3 mt-4 cursor-pointer group">
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${accepted ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'}`}>
                                            {accepted && <CheckCircle size={14} className="text-white" />}
                                            <input
                                                type="checkbox"
                                                checked={accepted}
                                                onChange={(e) => setAccepted(e.target.checked)}
                                                className="hidden"
                                            />
                                        </div>
                                        <span className={`text-sm font-medium transition-colors ${accepted ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400'}`}>
                                            I have read and agree to the Terms & Policies
                                        </span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto">
                        <button
                            onClick={handleConfirm}
                            disabled={isLoading || !accepted}
                            className={`w-full py-4 font-bold rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 group ${isLoading || !accepted
                                ? "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none"
                                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 dark:shadow-indigo-900/20 hover:shadow-2xl hover:scale-[1.01]"
                                }`}
                        >
                            {isLoading ? (
                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            ) : (
                                <>
                                    Accept & Start Setup
                                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CompanyConfirmation;
