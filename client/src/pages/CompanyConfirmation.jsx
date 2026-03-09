import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
    CheckCircle, ArrowRight, Shield, Zap, MessageSquare,
    CheckSquare, FileText, Layers, Sun, Moon, Users, Star
} from 'lucide-react';

const FEATURES = [
    { icon: MessageSquare, label: 'Real-time Channels & DMs', color: 'text-indigo-400' },
    { icon: CheckSquare, label: 'Task Management & Tracking', color: 'text-emerald-400' },
    { icon: Layers, label: 'Collaborative Canvas & Notes', color: 'text-violet-400' },
    { icon: Users, label: 'Unlimited Team Members', color: 'text-blue-400' },
    { icon: Shield, label: 'Enterprise-grade Security', color: 'text-amber-400' },
];

const CompanyConfirmation = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [accepted, setAccepted] = useState(false);
    const { theme, toggleTheme } = useTheme();

    // The login response stores company data under user.company (top-level response)
    // but after loadUser from /me, it may be under user.companyId (populated or just id)
    // We defensively handle both:
    const company = user?.company || {};
    const companyId = company.id || company._id || user?.companyId?._id || user?.companyId;
    const companyName = company.name || user?.companyName || 'Your Company';
    const companyDomain = company.domain || user?.companyDomain || '';
    const adminProfile = user || {};

    const handleConfirm = async () => {
        if (!accepted) return;
        if (!companyId) {
            console.error('No company ID found on user', user);
            return;
        }
        setIsLoading(true);
        try {
            await axios.post(
                `${import.meta.env.VITE_BACKEND_URL}/api/companies/${companyId}/start-setup`,
                { acceptedTerms: true },
                { withCredentials: true }
            );
            navigate('/company/setup');
        } catch (err) {
            console.error('Setup Start Error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    if (!user) return null;

    return (
        <div className="min-h-screen w-full bg-slate-50 dark:bg-[#050810] flex relative overflow-hidden font-sans transition-colors duration-500">

            {/* Theme Toggle */}
            <div className="absolute top-5 right-5 z-50">
                <button
                    onClick={toggleTheme}
                    className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 shadow-md border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:scale-110 transition-transform"
                >
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
            </div>

            {/* ─── LEFT PANEL ─── */}
            <div className="hidden lg:flex w-[45%] bg-slate-900 relative overflow-hidden flex-col justify-between p-12">
                {/* Gradient blobs */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                    <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-indigo-600/20 blur-[100px]" />
                    <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-violet-600/20 blur-[100px]" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-blue-600/10 blur-[80px]" />
                </div>

                {/* Subtle grid */}
                <div className="absolute inset-0 opacity-[0.03]"
                    style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

                <div className="relative z-10">
                    {/* Logo */}
                    <div className="flex items-center gap-3 mb-14">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                            <Zap size={20} className="text-white fill-white/20" />
                        </div>
                        <span className="font-bold text-2xl text-white tracking-tight">Chttrix</span>
                    </div>

                    {/* Company card */}
                    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm mb-8">
                        <div className="flex items-center gap-4 mb-5">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-purple-600/30 border border-white/10 flex items-center justify-center text-2xl font-black text-white">
                                {company.name?.charAt(0)?.toUpperCase() || 'C'}
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-white">{companyName}</h2>
                                <p className="text-sm text-slate-400">{companyDomain}</p>
                            </div>
                        </div>
                        <div className="h-px bg-white/10 mb-5" />
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Primary Admin</p>
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold text-sm">
                                {adminProfile.name?.charAt(0) || 'A'}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-white">{adminProfile.name}</p>
                                <p className="text-xs text-slate-400">{adminProfile.email}</p>
                            </div>
                        </div>
                    </div>

                    {/* Plan badge */}
                    <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                        <div className="flex items-center gap-2 mb-2">
                            <Star size={14} className="text-amber-400 fill-amber-400" />
                            <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">Enterprise Trial</span>
                        </div>
                        <p className="text-white font-bold text-lg mb-1">14-Day Full Access</p>
                        <p className="text-sm text-slate-400">All features unlocked — no credit card required</p>
                    </div>
                </div>

                {/* What you get */}
                <div className="relative z-10">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-5">What's included</p>
                    <div className="space-y-4">
                        {FEATURES.map((f, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                                    <f.icon size={15} className={f.color} />
                                </div>
                                <span className="text-sm text-slate-300 font-medium">{f.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ─── RIGHT PANEL ─── */}
            <div className="flex-1 flex items-center justify-center p-6 lg:p-16">
                <div className="w-full max-w-xl">

                    {/* Verified badge */}
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-bold uppercase tracking-wider mb-6">
                        <CheckCircle size={12} strokeWidth={3} /> Company Verified
                    </span>

                    <h1 className="text-4xl lg:text-5xl font-black text-slate-900 dark:text-white mb-4 tracking-tight leading-tight">
                        One Last<br />Step Before Launch
                    </h1>
                    <p className="text-base text-slate-500 dark:text-slate-400 mb-10 leading-relaxed">
                        Review and accept our terms to activate your workspace and deploy your team collaboration environment.
                    </p>

                    {/* Terms Box */}
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden mb-6">
                        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                            <Shield size={16} className="text-indigo-500" />
                            <h4 className="font-bold text-slate-800 dark:text-white text-sm">Terms of Service & Privacy Policy</h4>
                        </div>
                        <div className="h-44 overflow-y-auto px-5 py-4 text-xs text-slate-500 dark:text-slate-400 leading-relaxed space-y-3">
                            <div>
                                <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">1. Acceptance of Terms</p>
                                <p>By accessing and using Chttrix, you agree to be bound by these Terms. If you do not agree, do not use the service. Continued use after any modifications constitutes acceptance of the revised terms.</p>
                            </div>
                            <div>
                                <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">2. User Responsibilities</p>
                                <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify Chttrix immediately of any unauthorized use.</p>
                            </div>
                            <div>
                                <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">3. Data Privacy</p>
                                <p>We collect and use your data as described in our Privacy Policy. We employ industry-standard encryption and security practices. We do not sell your personal data to third parties.</p>
                            </div>
                            <div>
                                <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">4. Enterprise Trial</p>
                                <p>Your 14-day Enterprise Trial provides full access to all features. At the end of the trial, your workspace will continue on the free tier unless you choose to upgrade.</p>
                            </div>
                            <div>
                                <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">5. Intellectual Property</p>
                                <p>Chttrix and its associated marks are the intellectual property of Chttrix Inc. You retain ownership of all content you upload to the platform.</p>
                            </div>
                        </div>

                        {/* Checkbox */}
                        <label className="flex items-center gap-3 px-5 py-4 border-t border-slate-100 dark:border-slate-800 cursor-pointer group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${accepted
                                    ? 'bg-indigo-600 border-indigo-600 scale-110'
                                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                                    }`}
                            >
                                {accepted && <CheckCircle size={12} className="text-white" strokeWidth={3} />}
                                <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} className="hidden" />
                            </div>
                            <span className={`text-sm font-medium transition-colors ${accepted ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400'}`}>
                                I have read and agree to the Terms of Service and Privacy Policy
                            </span>
                        </label>
                    </div>

                    {/* Summary row */}
                    <div className="flex gap-4 mb-8">
                        {[
                            { val: 'Verified', label: 'Status' },
                            { val: '14 Days', label: 'Trial Period' },
                            { val: 'All', label: 'Features Included' },
                        ].map((item, i) => (
                            <div key={i} className="flex-1 text-center py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                                <p className="font-black text-slate-900 dark:text-white text-base">{item.val}</p>
                                <p className="text-xs text-slate-400 mt-0.5">{item.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* CTA Button */}
                    <button
                        onClick={handleConfirm}
                        disabled={isLoading || !accepted}
                        className={`relative w-full py-4 font-bold rounded-2xl text-base overflow-hidden group flex items-center justify-center gap-3 transition-all duration-300
                            ${isLoading || !accepted
                                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xl shadow-indigo-500/30 hover:-translate-y-0.5'
                            }`}
                    >
                        {/* Shimmer */}
                        {accepted && !isLoading && (
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                        )}
                        {isLoading ? (
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                Accept & Start Setup
                                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>

                    <p className="text-center text-xs text-slate-400 dark:text-slate-600 mt-5">
                        © 2026 Chttrix Inc. · By proceeding you accept our terms
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CompanyConfirmation;
