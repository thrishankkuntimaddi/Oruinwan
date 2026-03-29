import React, { useState, useEffect } from 'react';
import api from '@services/api';
import { DollarSign, TrendingUp, CreditCard, Calendar, Download, Search } from 'lucide-react';

const Billing = () => {
    const [stats, setStats] = useState({
        totalRevenue: 0,
        monthlyRevenue: 0,
        avgPerCompany: 0,
        growthRate: 0,
        projectedRevenue: 0
    });
    const [billingData, setBillingData] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchBillingData();
    }, []);

    const fetchBillingData = async () => {
        try {
            // Fetch overview stats
            const statsRes = await api.get(`/api/admin/billing/overview`);
            setStats(statsRes.data);

            // Fetch company billing data
            const billingRes = await api.get(`/api/admin/billing/companies`);
            setBillingData(billingRes.data);

            setLoading(false);
        } catch (err) {
            console.error('Failed to fetch billing data:', err);
            setLoading(false);
        }
    };

    const filteredBilling = billingData.filter(item => {
        const matchesSearch = item.companyName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterStatus === 'all' || item.status === filterStatus;
        return matchesSearch && matchesFilter;
    });

    const StatCard = ({ icon: Icon, label, value, subtitle, trend, color }) => (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700">
            <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center`}>
                    <Icon className="text-white" size={24} />
                </div>
                {trend && (
                    <div className={`flex items-center gap-1 text-sm font-bold ${trend >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                        <TrendingUp size={16} />
                        {Math.abs(trend)}%
                    </div>
                )}
            </div>
            <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                {label}
            </p>
            <p className="text-3xl font-black text-gray-900 dark:text-white mb-1">
                {value}
            </p>
            {subtitle && (
                <p className="text-xs text-gray-400">
                    {subtitle}
                </p>
            )}
        </div>
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2 flex items-center gap-3">
                    <DollarSign size={32} />
                    Revenue & Billing
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                    Track revenue, billing, and financial analytics
                </p>
            </div>

            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    icon={DollarSign}
                    label="Total Revenue"
                    value={`$${stats.totalRevenue.toLocaleString()}`}
                    subtitle="All time"
                    color="from-green-500 to-emerald-600"
                />
                <StatCard
                    icon={Calendar}
                    label="Monthly Revenue"
                    value={`$${stats.monthlyRevenue.toLocaleString()}`}
                    subtitle="Current month"
                    trend={stats.growthRate}
                    color="from-blue-500 to-blue-600"
                />
                <StatCard
                    icon={TrendingUp}
                    label="Avg Per Company"
                    value={`$${stats.avgPerCompany.toLocaleString()}`}
                    subtitle="Monthly average"
                    color="from-purple-500 to-purple-600"
                />
                <StatCard
                    icon={CreditCard}
                    label="Projected (Next Month)"
                    value={`$${stats.projectedRevenue.toLocaleString()}`}
                    subtitle="Based on current trends"
                    color="from-orange-500 to-orange-600"
                />
            </div>

            {/* Note for no active billing */}
            {billingData.length === 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-2xl p-6">
                    <h3 className="font-bold text-blue-900 dark:text-blue-200 mb-2">
                        📊 Billing System Ready
                    </h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                        No active billing records yet. Companies are currently using free tier.
                        Revenue calculations will appear here once billing is activated for companies.
                    </p>
                </div>
            )}

            {/* Billing Table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                {/* Table Header with Filters */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex flex-col md:flex-row gap-4 justify-between">
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search companies..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 text-gray-900 dark:text-white"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {['all', 'active', 'pending', 'overdue'].map(status => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filterStatus === status
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                        }`}
                                >
                                    {status.charAt(0).toUpperCase() + status.slice(1)}
                                </button>
                            ))}
                        </div>
                        <button className="px-4 py-2 bg-gray-900 dark:bg-indigo-600 text-white rounded-xl font-bold hover:bg-black dark:hover:bg-indigo-700 transition-all flex items-center gap-2">
                            <Download size={16} />
                            Export
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Company</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Plan</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Amount</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Billing Cycle</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Next Payment</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                            {filteredBilling.map(item => (
                                <tr key={item._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                                                {item.companyName.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900 dark:text-white">{item.companyName}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{item.companyDomain}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${item.plan === 'enterprise' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' :
                                                item.plan === 'professional' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                                                    item.plan === 'basic' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                                                        'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                            }`}>
                                            {item.plan}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                                        ${item.amount.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 capitalize">
                                        {item.billingCycle}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                                        {item.nextPaymentDate ? new Date(item.nextPaymentDate).toLocaleDateString() : 'N/A'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${item.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                                                item.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                                                    item.status === 'overdue' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                                                        'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                            }`}>
                                            {item.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredBilling.length === 0 && (
                        <div className="p-12 text-center text-gray-400">
                            No billing records found
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Billing;
