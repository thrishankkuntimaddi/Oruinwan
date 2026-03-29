import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    CreditCard, Download, TrendingUp, AlertCircle,
    Users, DollarSign, RefreshCw, Crown, CheckCircle, XCircle,
    Clock, ArrowUpRight, ArrowDownRight, FileText
} from 'lucide-react';
import { useCompany } from '../../contexts/CompanyContext';
import { useToast } from '../../contexts/ToastContext';
import { getBillingSummary } from '../../services/ownerDashboardService';
import api from '@services/api';

const OwnerBilling = () => {
    const { isCompanyOwner } = useCompany();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [billingData, setBillingData] = useState(null);
    const [invoices, setInvoices] = useState([]);
    const [paymentMethod, setPaymentMethod] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            const [billing, invoicesRes, paymentRes] = await Promise.all([
                getBillingSummary(),
                api.get('/api/owner-dashboard/invoices?limit=10'),
                api.get('/api/owner-dashboard/payment-methods')
            ]);

            setBillingData(billing);
            setInvoices(invoicesRes.data.invoices || []);
            setPaymentMethod(paymentRes.data.paymentMethod || { type: 'card', last4: '4242', brand: 'visa' });
        } catch (error) {
            console.error("Error fetching billing data:", error);
            showToast("Failed to load billing data", "error");
            // Set defaults on error
            setInvoices([]);
            setPaymentMethod({ type: 'card', last4: '4242', brand: 'visa' });
        }
    }, [showToast]);

    useEffect(() => {
        if (!isCompanyOwner()) return;

        const loadInitialData = async () => {
            setLoading(true);
            await fetchData();
            setLoading(false);
        };

        loadInitialData();
    }, [isCompanyOwner, fetchData]);

    const handleRefresh = async () => {
        if (refreshing) return;
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
        showToast("Billing data refreshed", "success");
    };

    const handleUpgradePlan = () => {
        showToast("Upgrade functionality coming soon", "info");
    };

    const handleDownloadInvoice = (invoiceId) => {
        showToast(`Downloading invoice ${invoiceId}...`, "info");
    };

    if (!isCompanyOwner()) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
                <div className="text-center">
                    <Crown className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">Only the Company Owner can view billing information.</p>
                    <button
                        onClick={() => navigate('/admin/dashboard')}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        Go to Admin Dashboard
                    </button>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="h-screen bg-gray-50 dark:bg-gray-900 p-8 animate-pulse space-y-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <div className="h-6 w-44 bg-gray-200 dark:bg-gray-700 rounded-xl" />
                        <div className="h-3 w-60 bg-gray-100 dark:bg-gray-800 rounded" />
                    </div>
                    <div className="h-9 w-28 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                    {[1,2,3].map(i => (
                        <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 space-y-3">
                            <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                            <div className="h-10 w-16 bg-gray-300 dark:bg-gray-600 rounded-xl" />
                        </div>
                    ))}
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
                    {[75,55,85,60,70].map((w,i) => (
                        <div key={i} className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                            <div className="flex-1 space-y-1.5">
                                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded" style={{width:`${w}%`}} />
                                <div className="h-2.5 bg-gray-100 dark:bg-gray-700/50 rounded" style={{width:`${w-20}%`}} />
                            </div>
                            <div className="h-7 w-20 bg-gray-100 dark:bg-gray-700 rounded-xl" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
            {/* Header */}
            <header className="h-16 px-8 flex items-center justify-between z-10 bg-white dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700 shadow-sm">
                <div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <CreditCard className="text-indigo-500" size={24} />
                        Billing & Plan Management
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-gray-400 font-medium ml-8">
                        Subscription, invoices, and payment history
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="px-4 py-2 bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-gray-600 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                        {refreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto w-full px-8 py-8 z-10 custom-scrollbar">
                <div className="space-y-8 max-w-7xl mx-auto">
                    {/* Current Plan Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Plan Card */}
                        <div className="lg:col-span-2 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-8 text-white shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32"></div>
                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <p className="text-indigo-200 text-sm font-medium mb-1">CURRENT PLAN</p>
                                        <h3 className="text-4xl font-black">{billingData?.currentPlan || 'Free'}</h3>
                                    </div>
                                    <CreditCard className="w-16 h-16 opacity-20" />
                                </div>

                                <div className="grid grid-cols-2 gap-6 mb-8">
                                    <div>
                                        <p className="text-indigo-200 text-xs mb-1">Monthly Cost</p>
                                        <p className="text-3xl font-bold">${billingData?.monthlyCost || 0}</p>
                                    </div>
                                    <div>
                                        <p className="text-indigo-200 text-xs mb-1">Renewal Date</p>
                                        <p className="text-lg font-semibold">
                                            {billingData?.renewalDate
                                                ? new Date(billingData.renewalDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                                : 'N/A'}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={handleUpgradePlan}
                                    className="w-full py-3 bg-white text-indigo-600 rounded-lg font-bold hover:bg-indigo-50 transition-colors shadow-lg"
                                >
                                    Upgrade Plan
                                </button>
                            </div>
                        </div>

                        {/* Seat Usage Card */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
                                    <Users className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Seat Usage</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-500">Active users</p>
                                </div>
                            </div>

                            <div className="mb-4">
                                <div className="flex items-end justify-between mb-2">
                                    <span className="text-3xl font-black text-gray-900 dark:text-white">
                                        {billingData?.seatUsage?.used || 0}
                                    </span>
                                    <span className="text-lg font-medium text-gray-500 dark:text-gray-400">
                                        / {billingData?.seatUsage?.total || 10}
                                    </span>
                                </div>
                                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${(billingData?.seatUsage?.percentage || 0) > 80
                                            ? 'bg-red-500'
                                            : 'bg-indigo-600'
                                            }`}
                                        style={{ width: `${billingData?.seatUsage?.percentage || 0}%` }}
                                    ></div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Utilization</span>
                                <span className="font-bold text-gray-900 dark:text-white">
                                    {billingData?.seatUsage?.percentage || 0}%
                                </span>
                            </div>

                            {(billingData?.seatUsage?.percentage || 0) > 80 && (
                                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                                    <div className="flex gap-2">
                                        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                                        <p className="text-xs text-amber-700 dark:text-amber-400">
                                            You're approaching your seat limit. Consider upgrading.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Spending Overview */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                            Spending Overview
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">This Month</p>
                                <p className="text-2xl font-black text-gray-900 dark:text-white">${billingData?.monthlyCost || 0}</p>
                                <div className="flex items-center gap-1 mt-1">
                                    <ArrowUpRight className="w-3 h-3 text-green-500" />
                                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">+0%</span>
                                </div>
                            </div>

                            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Last 3 Months</p>
                                <p className="text-2xl font-black text-gray-900 dark:text-white">${(billingData?.monthlyCost || 0) * 3}</p>
                                <div className="flex items-center gap-1 mt-1">
                                    <ArrowDownRight className="w-3 h-3 text-red-500" />
                                    <span className="text-xs text-red-600 dark:text-red-400 font-medium">-5%</span>
                                </div>
                            </div>

                            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">This Year</p>
                                <p className="text-2xl font-black text-gray-900 dark:text-white">${(billingData?.monthlyCost || 0) * 12}</p>
                                <div className="flex items-center gap-1 mt-1">
                                    <ArrowUpRight className="w-3 h-3 text-green-500" />
                                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">+12%</span>
                                </div>
                            </div>

                            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Projected (Annual)</p>
                                <p className="text-2xl font-black text-gray-900 dark:text-white">${(billingData?.monthlyCost || 0) * 12}</p>
                                <div className="flex items-center gap-1 mt-1">
                                    <DollarSign className="w-3 h-3 text-blue-500" />
                                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Estimate</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Payment History */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                Payment History & Invoices
                            </h3>
                            <button className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                                View All
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <th className="text-left py-3 px-4 text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Invoice</th>
                                        <th className="text-left py-3 px-4 text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Date</th>
                                        <th className="text-left py-3 px-4 text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Plan</th>
                                        <th className="text-left py-3 px-4 text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Seats</th>
                                        <th className="text-right py-3 px-4 text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Amount</th>
                                        <th className="text-center py-3 px-4 text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Status</th>
                                        <th className="text-right py-3 px-4 text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {invoices.map((invoice) => (
                                        <tr key={invoice._id || invoice.invoiceNumber} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                            <td className="py-4 px-4 text-sm font-medium text-gray-900 dark:text-white">
                                                {invoice.invoiceNumber || 'N/A'}
                                            </td>
                                            <td className="py-4 px-4 text-sm text-gray-600 dark:text-gray-400">
                                                {new Date(invoice.issueDate || invoice.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </td>
                                            <td className="py-4 px-4 text-sm text-gray-900 dark:text-white font-medium">
                                                {invoice.planName || 'N/A'}
                                            </td>
                                            <td className="py-4 px-4 text-sm text-gray-600 dark:text-gray-400">
                                                {invoice.seatsUsed || 0} seats
                                            </td>
                                            <td className="py-4 px-4 text-sm text-right font-bold text-gray-900 dark:text-white">
                                                ${invoice.total || invoice.amount || 0}
                                            </td>
                                            <td className="py-4 px-4 text-center">
                                                {invoice.status === 'paid' ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                        <CheckCircle size={12} />
                                                        Paid
                                                    </span>
                                                ) : invoice.status === 'pending' ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                                                        <Clock size={12} />
                                                        Pending
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                                        <XCircle size={12} />
                                                        {invoice.status}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-4 px-4 text-right">
                                                <button
                                                    onClick={() => handleDownloadInvoice(invoice.invoiceNumber)}
                                                    className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm font-medium flex items-center gap-1 ml-auto"
                                                >
                                                    <Download size={14} />
                                                    Download
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Billing Settings */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Payment Method</h3>
                            <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                                    <CreditCard className="w-6 h-6 text-white" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                                        **** **** **** {paymentMethod?.last4 || '4242'}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Expires {paymentMethod?.expiryMonth || 12}/{paymentMethod?.expiryYear || 2027}
                                    </p>
                                </div>
                                <button className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                                    Update
                                </button>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Billing Contact</h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Email</span>
                                    <span className="font-medium text-gray-900 dark:text-white">
                                        {billingData?.billingContact?.email || 'Not configured'}
                                    </span>
                                </div>
                                {billingData?.billingContact?.address && (
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600 dark:text-gray-400">Address</span>
                                        <span className="font-medium text-gray-900 dark:text-white">
                                            {billingData.billingContact.address}
                                        </span>
                                    </div>
                                )}
                                <button className="w-full mt-2 py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg font-medium transition-colors">
                                    Update Details
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OwnerBilling;
