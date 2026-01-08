import React, { useState } from 'react';
import { UserPlus, Upload, FileText, ChevronRight, Users, Play, DownloadCloud, X } from 'lucide-react';
import OnboardingWizard from '../../components/admin/onboarding/OnboardingWizard';

const OnboardingPage = () => {
    const [mode, setMode] = useState(null); // 'individual' | 'bulk'

    return (
        <div className="flex-1 h-full overflow-hidden flex flex-col bg-white dark:bg-[#0f172a] transition-colors duration-200 relative">

            {/* Overlay for Wizard / Bulk Upload */}
            {mode && (
                <div className="absolute inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-md animate-fadeIn transition-all duration-300">

                    {/* Individual Wizard */}
                    {mode === 'individual' && (
                        <div className="w-full max-w-4xl h-full max-h-[90vh] flex flex-col animate-scaleIn">
                            <OnboardingWizard onComplete={() => setMode(null)} />
                        </div>
                    )}

                    {/* Bulk Upload Modal */}
                    {mode === 'bulk' && (
                        <div className="bg-white dark:bg-[#1e293b] rounded-2xl p-8 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-700 relative animate-scaleIn">
                            <button
                                onClick={() => setMode(null)}
                                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>

                            <div className="flex flex-col items-center text-center">
                                <div className="w-16 h-16 bg-green-50 dark:bg-green-900/20 rounded-2xl flex items-center justify-center mb-6 ring-1 ring-green-100 dark:ring-green-900/40">
                                    <FileText className="w-8 h-8 text-green-600 dark:text-green-500" />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">Bulk Team Import</h3>
                                <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm leading-relaxed max-w-sm">
                                    Upload a generic CSV file containing employee details to create accounts in bulk.
                                </p>

                                <div className="w-full space-y-3">
                                    <button className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl shadow-lg shadow-green-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                                        <Upload size={18} /> Choose CSV File
                                    </button>
                                    <button
                                        onClick={() => setMode(null)}
                                        className="w-full py-3 px-4 text-slate-500 dark:text-slate-400 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Main Content */}
            <div className={`flex-1 overflow-y-auto flex flex-col items-center justify-center p-6 sm:p-8 ${mode ? 'blur-sm grayscale-[0.5] opacity-40 scale-[0.98]' : 'scale-100'} transition-all duration-500 ease-out origin-center`}>
                <div className="max-w-4xl w-full">

                    {/* Header */}
                    <div className="mb-12 text-center">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-full text-indigo-600 dark:text-indigo-400 text-xs font-semibold mb-6 tracking-wide uppercase">
                            <Users size={12} /> Team Growth
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4 tracking-tight">
                            Grow Your Team
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto text-base leading-relaxed">
                            Select a method to onboard new employees to your workspace.
                        </p>
                    </div>

                    {/* Cards Grid */}
                    <div className="grid md:grid-cols-2 gap-6">

                        {/* Individual Card */}
                        <button
                            onClick={() => setMode('individual')}
                            className="group relative p-6 bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 text-left overflow-hidden flex flex-col h-full"
                        >
                            <div className="flex items-start justify-between mb-6">
                                <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 ring-1 ring-indigo-100 dark:ring-indigo-500/20">
                                    <UserPlus className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                                    <ChevronRight size={16} />
                                </div>
                            </div>

                            <div className="relative z-10 flex-1">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                    Individual Setup
                                </h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
                                    Launch the wizard for a single employee. Configure roles, access details, and workspace assignments manually.
                                </p>
                            </div>

                            <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-700/50">
                                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                                    Start Setup <Play size={10} fill="currentColor" />
                                </span>
                            </div>
                        </button>

                        {/* Bulk Card */}
                        <button
                            onClick={() => setMode('bulk')}
                            className="group relative p-6 bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-green-500 dark:hover:border-green-500 hover:shadow-xl hover:shadow-green-500/5 transition-all duration-300 text-left overflow-hidden flex flex-col h-full"
                        >
                            <div className="flex items-start justify-between mb-6">
                                <div className="w-12 h-12 bg-green-50 dark:bg-green-500/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 ring-1 ring-green-100 dark:ring-green-500/20">
                                    <Upload className="w-6 h-6 text-green-600 dark:text-green-400" />
                                </div>
                                <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-green-600 group-hover:text-white transition-all duration-300">
                                    <ChevronRight size={16} />
                                </div>
                            </div>

                            <div className="relative z-10 flex-1">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                                    Bulk Import
                                </h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
                                    Upload a CSV file to add multiple team members at once. Ideal for migrating teams or large batches.
                                </p>
                            </div>

                            <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-700/50">
                                <span className="text-xs font-semibold text-green-600 dark:text-green-400 flex items-center gap-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                                    Import Now <DownloadCloud size={12} />
                                </span>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OnboardingPage;
