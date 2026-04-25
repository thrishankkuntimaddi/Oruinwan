import React from 'react';
import { Shield, AlertTriangle, Lock, FileText, CheckCircle } from 'lucide-react';

const SecurityRisk = ({ data }) => {
    const stats = data || {
        activeSessions: 0,
        suspiciousLogins: [],
        auditSummary: { lastWeek: 0, critical: 0, warnings: 0 },
        complianceScore: 100
    };

    return (
        <section>
            <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wide">Security & Risk</h3>
                <p className="text-xs text-slate-500 dark:text-gray-500">Access control & compliance</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6 transition-colors">
                    <div className="flex items-center gap-2 mb-4">
                        <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        <span className="text-sm font-bold text-slate-600 dark:text-gray-300">Active Sessions</span>
                    </div>
                    <div className="text-3xl font-black text-slate-900 dark:text-white">{stats.activeSessions}</div>
                    <div className="text-xs text-slate-500 dark:text-gray-400 mt-1">Users logged in (24h)</div>
                </div>

                {}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6 transition-colors">
                    <div className="flex items-center gap-2 mb-4">
                        <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        <span className="text-sm font-bold text-slate-600 dark:text-gray-300">Audit Logs</span>
                    </div>
                    <div className="flex items-end justify-between">
                        <div>
                            <div className="text-3xl font-black text-slate-900 dark:text-white">{stats.auditSummary.lastWeek}</div>
                            <div className="text-xs text-slate-500 dark:text-gray-400 mt-1">Events this week</div>
                        </div>
                        <div className="text-right">
                            {stats.auditSummary.critical > 0 && (
                                <div className="flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded-full mb-1">
                                    <AlertTriangle size={12} />
                                    {stats.auditSummary.critical} Critical
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6 transition-colors">
                    <div className="flex items-center gap-2 mb-4">
                        <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        <span className="text-sm font-bold text-slate-600 dark:text-gray-300">Compliance</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-3xl font-black text-slate-900 dark:text-white">{stats.complianceScore}%</div>
                            <div className="text-xs text-slate-500 dark:text-gray-400 mt-1">Security score</div>
                        </div>
                        <CheckCircle className="w-10 h-10 text-green-500 opacity-20" />
                    </div>
                </div>
            </div>
        </section>
    );
};

export default SecurityRisk;
