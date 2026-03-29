import React, { useState } from 'react';
import api from '@services/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
    CheckCircle, ArrowRight, Shield,
    MessageSquare, CheckSquare, Layers, Sun, Moon, Users, Star
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

    const company = user?.company || {};
    const companyId = company.id || company._id || user?.companyId?._id || user?.companyId;
    const companyName = company.name || user?.companyName || 'Your Company';
    const companyDomain = company.domain || user?.companyDomain || '';
    const adminProfile = user || {};

    const handleConfirm = async () => {
        if (!accepted || !companyId) return;
        setIsLoading(true);
        try {
            await api.post(
                `/api/companies/${companyId}/start-setup`,
                { acceptedTerms: true }
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
        <div className="h-screen w-full bg-slate-100 dark:bg-[#060a14] flex overflow-hidden font-sans">

            {/* ── Theme toggle ── */}
            <button
                onClick={toggleTheme}
                className="absolute top-4 right-4 z-50 w-9 h-9 rounded-xl bg-white dark:bg-slate-800 shadow border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 hover:scale-105 transition-transform"
            >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* ════════════════ LEFT PANEL ════════════════ */}
            <div className="hidden lg:flex w-[40%] shrink-0 bg-[#0e1220] flex-col h-full relative overflow-hidden">

                {/* Decorative blobs */}
                <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-indigo-600/15 blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-72 h-72 rounded-full bg-purple-600/10 blur-3xl pointer-events-none" />
                {/* Subtle grid */}
                <div className="absolute inset-0 opacity-[0.025]"
                    style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)', backgroundSize: '36px 36px' }} />

                <div className="relative z-10 flex flex-col h-full p-8">

                    {/* Logo — real image + wordmark */}
                    <div className="flex items-center gap-3 mb-8">
                        <img
                            src="/chttrix-logo.jpg"
                            alt="Chttrix"
                            className="h-10 w-10 object-contain rounded-xl"
                            onError={e => { e.target.style.display = 'none'; }}
                        />
                        <span className="text-2xl font-black text-white tracking-tight">Chttrix</span>
                    </div>

                    {/* Company card */}
                    <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 mb-4">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-600/30 border border-white/10 flex items-center justify-center text-xl font-black text-white">
                                {companyName?.charAt(0)?.toUpperCase() || 'C'}
                            </div>
                            <div>
                                <h2 className="text-base font-black text-white leading-tight">{companyName}</h2>
                                <p className="text-xs text-slate-400">{companyDomain}</p>
                            </div>
                        </div>
                        <div className="h-px bg-white/10 mb-4" />
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Primary Admin</p>
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold text-xs">
                                {adminProfile.name?.charAt(0)?.toUpperCase() || adminProfile.username?.charAt(0)?.toUpperCase() || 'A'}
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-white">{adminProfile.name || adminProfile.username}</p>
                                <p className="text-[11px] text-slate-400">{adminProfile.email}</p>
                            </div>
                        </div>
                    </div>

                    {/* Enterprise Trial badge */}
                    <div className="p-4 rounded-xl bg-amber-500/8 border border-amber-500/20 mb-6">
                        <div className="flex items-center gap-1.5 mb-1">
                            <Star size={12} className="text-amber-400 fill-amber-400" />
                            <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">Enterprise Trial</span>
                        </div>
                        <p className="text-white font-bold text-sm mb-0.5">14-Day Full Access</p>
                        <p className="text-[11px] text-slate-400">All features unlocked — no credit card required</p>
                    </div>

                    {/* What's included — pushed to fill remaining space */}
                    <div className="flex-1 flex flex-col justify-end">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">What's included</p>
                        <div className="space-y-2.5">
                            {FEATURES.map((f, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                                        <f.icon size={13} className={f.color} />
                                    </div>
                                    <span className="text-xs text-slate-300 font-medium">{f.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>

            {/* ════════════════ RIGHT PANEL ════════════════ */}
            <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-8 lg:px-14 py-8">
                <div className="w-full max-w-lg">

                    {/* Mobile logo */}
                    <div className="flex items-center gap-2 mb-6 lg:hidden">
                        <img src="/chttrix-logo.jpg" alt="Chttrix" className="h-8 rounded-md" onError={e => e.target.style.display = 'none'} />
                    </div>

                    {/* Verified badge */}
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 rounded-full text-[11px] font-bold uppercase tracking-wider mb-5">
                        <CheckCircle size={11} strokeWidth={3} /> Company Verified
                    </span>

                    <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white mb-3 tracking-tight leading-tight">
                        One Last Step<br />Before Launch
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                        Review and accept our terms to activate your workspace and deploy your team.
                    </p>

                    {/* Terms Box */}
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden mb-4">
                        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                            <Shield size={14} className="text-indigo-500" />
                            <h4 className="font-bold text-slate-800 dark:text-white text-xs">Terms of Service & Privacy Policy</h4>
                        </div>
                        <div className="h-36 overflow-y-auto px-4 py-3 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed space-y-2.5">
                            {[
                                ['1. Acceptance of Terms', 'By accessing and using Chttrix, you agree to be bound by these Terms. Continued use after any modifications constitutes acceptance of the revised terms.'],
                                ['2. User Responsibilities', 'You are responsible for maintaining the confidentiality of your account credentials and must notify Chttrix immediately of any unauthorized use.'],
                                ['3. Data Privacy', 'We collect and use your data as described in our Privacy Policy. We employ industry-standard encryption and do not sell your personal data.'],
                                ['4. Enterprise Trial', 'Your 14-day Enterprise Trial gives full feature access. After the trial, your workspace continues on the free tier unless upgraded.'],
                                ['5. Intellectual Property', 'Chttrix trademarks belong to Chttrix Inc. You retain ownership of all content you upload to the platform.'],
                            ].map(([title, body]) => (
                                <div key={title}>
                                    <p className="font-bold text-slate-700 dark:text-slate-300 mb-0.5">{title}</p>
                                    <p>{body}</p>
                                </div>
                            ))}
                        </div>

                        {/* Checkbox */}
                        <label className="flex items-center gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all duration-200
                                ${accepted ? 'bg-indigo-600 border-indigo-600 scale-110' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'}`}>
                                {accepted && <CheckCircle size={11} className="text-white" strokeWidth={3} />}
                                <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} className="hidden" />
                            </div>
                            <span className={`text-xs font-medium transition-colors ${accepted ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400'}`}>
                                I have read and agree to the Terms of Service and Privacy Policy
                            </span>
                        </label>
                    </div>

                    {/* Summary row */}
                    <div className="flex gap-3 mb-5">
                        {[
                            { val: 'Verified', label: 'Status' },
                            { val: '14 Days', label: 'Trial Period' },
                            { val: 'All', label: 'Features Included' },
                        ].map((item, i) => (
                            <div key={i} className="flex-1 text-center py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                                <p className="font-black text-slate-900 dark:text-white text-sm">{item.val}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">{item.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* CTA */}
                    <button
                        onClick={handleConfirm}
                        disabled={isLoading || !accepted}
                        className={`relative w-full py-3.5 font-bold rounded-2xl text-sm overflow-hidden group flex items-center justify-center gap-2.5 transition-all duration-300
                            ${isLoading || !accepted
                                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-500/25 hover:-translate-y-0.5'}`}
                    >
                        {accepted && !isLoading && (
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                        )}
                        {isLoading
                            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            : <><span>Accept & Start Setup</span><ArrowRight size={17} className="group-hover:translate-x-1 transition-transform" /></>
                        }
                    </button>

                    <p className="text-center text-[10px] text-slate-400 dark:text-slate-600 mt-4">
                        © 2026 Chttrix Inc. · By proceeding you accept our terms
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CompanyConfirmation;
