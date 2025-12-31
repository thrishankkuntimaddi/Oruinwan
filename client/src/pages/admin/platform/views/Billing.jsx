import React from 'react';
import { DollarSign, TrendingUp, CreditCard, Download, FileText } from 'lucide-react';

const Billing = () => {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-black text-gray-900 dark:text-white">Revenue & Billing</h2>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-2xl">
                            <DollarSign size={24} />
                        </div>
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded-lg text-xs font-bold leading-none">+12%</span>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-sm font-bold uppercase tracking-wider">Total MRR</p>
                    <h3 className="text-3xl font-black text-gray-900 dark:text-white">$24,500</h3>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl">
                            <TrendingUp size={24} />
                        </div>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-sm font-bold uppercase tracking-wider">Projected Next Month</p>
                    <h3 className="text-3xl font-black text-gray-900 dark:text-white">$28,200</h3>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-2xl">
                            <CreditCard size={24} />
                        </div>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-sm font-bold uppercase tracking-wider">Active Subscriptions</p>
                    <h3 className="text-3xl font-black text-gray-900 dark:text-white">85</h3>
                </div>
            </div>

            {/* Transactions */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recent Transactions</h3>
                    <button className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300">View All</button>
                </div>
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-900/50">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Company</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Plan</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Amount</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Date</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase text-right">Invoice</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                        {[
                            { company: "Acme Corp", plan: "Enterprise", amount: "$999.00", date: "Oct 24, 2024" },
                            { company: "Stark Ind", plan: "Professional", amount: "$299.00", date: "Oct 23, 2024" },
                            { company: "Wayne Ent", plan: "Enterprise", amount: "$999.00", date: "Oct 23, 2024" },
                            { company: "Cyberdyne", plan: "Starter", amount: "$49.00", date: "Oct 22, 2024" },
                        ].map((tx, i) => (
                            <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors">
                                <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{tx.company}</td>
                                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{tx.plan}</td>
                                <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{tx.amount}</td>
                                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{tx.date}</td>
                                <td className="px-6 py-4 text-right">
                                    <button className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                                        <Download size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Billing;
