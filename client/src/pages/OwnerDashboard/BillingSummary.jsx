import React from 'react';
import { CreditCard, Calendar, Users } from 'lucide-react';

const BillingSummary = ({ data }) => {
    const info = data || {
        currentPlan: 'Free',
        seatUsage: { used: 0, total: 10, percentage: 0 },
        monthlyCost: 0,
        renewalDate: null
    };

    return (
        <section>
            <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wide">Plan & Billing</h3>
                <p className="text-xs text-slate-500 dark:text-gray-500">Current subscription status</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {}
                <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-xl shadow-lg p-6 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-20">
                        <CreditCard className="w-24 h-24 transform rotate-12" />
                    </div>
                    <div className="relative z-10">
                        <div className="text-indigo-200 text-sm font-bold uppercase tracking-wider mb-1">Current Plan</div>
                        <div className="text-3xl font-black mb-4">{info.currentPlan}</div>
                        <div className="flex items-baseline gap-1 mb-6">
                            <span className="text-2xl font-bold">${info.monthlyCost}</span>
                            <span className="text-indigo-200">/month</span>
                        </div>
                        {info.renewalDate && (
                            <div className="flex items-center gap-2 text-sm text-indigo-100 bg-white/10 px-3 py-2 rounded-lg backdrop-blur-sm inline-flex">
                                <Calendar size={14} />
                                <span>Renews {new Date(info.renewalDate).toLocaleDateString()}</span>
                            </div>
                        )}
                    </div>
                </div>

                {}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6 transition-colors">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-900 dark:text-white">Seat Usage</h4>
                                <p className="text-xs text-slate-500 dark:text-gray-400">Active seats vs plan limit</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-black text-slate-900 dark:text-white">
                                {info.seatUsage.used} <span className="text-slate-400 text-lg font-medium">/ {info.seatUsage.total}</span>
                            </div>
                        </div>
                    </div>

                    <div className="mb-2 flex justify-between text-xs font-bold">
                        <span className="text-slate-500 dark:text-gray-400">Utilization</span>
                        <span className={`${info.seatUsage.percentage > 90 ? 'text-red-500' : 'text-slate-700 dark:text-gray-300'
                            }`}>{info.seatUsage.percentage}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-gray-700 h-3 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${info.seatUsage.percentage > 90 ? 'bg-red-500' : 'bg-blue-600'
                                }`}
                            style={{ width: `${info.seatUsage.percentage}%` }}
                        ></div>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300">
                            Manage Subscription →
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default BillingSummary;
