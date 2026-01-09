import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../contexts/CompanyContext';
import { useToast } from '../../contexts/ToastContext';
import { RefreshCw, Crown, Shield, ArrowRight } from 'lucide-react';

import OrganizationOverview from './OrganizationOverview';
import ActivityHealth from './ActivityHealth';

import {
    getOwnerOverview,
    getActivityHealth
} from '../../services/ownerDashboardService';

const OwnerDashboard = () => {
    const { isCompanyOwner } = useCompany();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Data states
    const [overviewData, setOverviewData] = useState(null);
    const [activityData, setActivityData] = useState(null);

    // Wrapped in useCallback to satisfy linter
    const fetchData = useCallback(async () => {
        try {
            const [overview, activity] = await Promise.all([
                getOwnerOverview(),
                getActivityHealth()
            ]);

            setOverviewData(overview);
            setActivityData(activity);
        } catch (error) {
            console.error("Error fetching owner dashboard data:", error);
            showToast("Failed to load dashboard data", "error");
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
        showToast("Dashboard refreshed", "success");
    };

    // Access Control
    if (!isCompanyOwner()) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
                <div className="text-center">
                    <Crown className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">Only the Company Owner can view this strategic overview.</p>
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

    return (
        <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
            {/* Header */}
            <header className="h-16 px-8 flex items-center justify-between z-10 bg-white dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700 shadow-sm">
                <div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <Crown className="text-yellow-500" size={24} />
                        Owner Overview
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-gray-400 font-medium ml-8">
                        Strategic Health & Growth · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/admin/dashboard')}
                        className="px-4 py-2 bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-gray-600 transition-colors shadow-sm flex items-center gap-2"
                    >
                        <Shield size={16} />
                        Admin Console
                    </button>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing || loading}
                        className="px-4 py-2 bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-gray-600 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                        {refreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto w-full px-8 py-8 z-10 custom-scrollbar">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <div className="space-y-8 max-w-7xl mx-auto">
                        {/* Organization Overview - Unique to Dashboard */}
                        <OrganizationOverview data={overviewData} />

                        {/* Activity & Health - High-level metrics */}
                        <ActivityHealth data={activityData} />

                        {/* Quick Links Section - Navigate to detailed pages */}
                        <section>
                            <div className="mb-4">
                                <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wide">Deep Dive</h3>
                                <p className="text-xs text-slate-500 dark:text-gray-500">Access detailed views and management</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <QuickLinkCard
                                    title="Analytics & Insights"
                                    description="Historical trends, charts & growth metrics"
                                    link="/owner/analytics"
                                    icon="📊"
                                    color="indigo"
                                />
                                <QuickLinkCard
                                    title="Billing & Plan"
                                    description="Subscription, invoices & usage details"
                                    link="/owner/billing"
                                    icon="💳"
                                    color="green"
                                />
                                <QuickLinkCard
                                    title="Security & Risk"
                                    description="Sessions, compliance & audit logs"
                                    link="/owner/security"
                                    icon="🔒"
                                    color="red"
                                />
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </div>
    );
};

// Quick Link Card Component
const QuickLinkCard = ({ title, description, link, icon, color }) => {
    const navigate = useNavigate();

    const colorClasses = {
        indigo: 'border-indigo-200 dark:border-indigo-800 hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20',
        green: 'border-green-200 dark:border-green-800 hover:border-green-400 dark:hover:border-green-600 hover:bg-green-50 dark:hover:bg-green-900/20',
        red: 'border-red-200 dark:border-red-800 hover:border-red-400 dark:hover:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
    };

    return (
        <button
            onClick={() => navigate(link)}
            className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 ${colorClasses[color]} p-6 transition-all hover:shadow-md text-left w-full group`}
        >
            <div className="flex items-start justify-between mb-3">
                <div className="text-3xl">{icon}</div>
                <ArrowRight className="w-5 h-5 text-slate-400 dark:text-gray-500 group-hover:text-slate-700 dark:group-hover:text-gray-300 group-hover:translate-x-1 transition-all" />
            </div>
            <h4 className="text-base font-bold text-slate-800 dark:text-white mb-2">{title}</h4>
            <p className="text-xs text-slate-500 dark:text-gray-400 leading-relaxed">{description}</p>
        </button>
    );
};

export default OwnerDashboard;

