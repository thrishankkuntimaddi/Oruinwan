import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../contexts/CompanyContext';
import { useToast } from '../../contexts/ToastContext';
import { RefreshCw, Crown, Shield } from 'lucide-react';

import OrganizationOverview from './OrganizationOverview';
import ActivityHealth from './ActivityHealth';
import BillingSummary from './BillingSummary';
import SecurityRisk from './SecurityRisk';

import {
    getOwnerOverview,
    getActivityHealth,
    getBillingSummary,
    getSecurityRisk
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
    const [billingData, setBillingData] = useState(null);
    const [securityData, setSecurityData] = useState(null);

    // Wrapped in useCallback to satisfy linter
    const fetchData = useCallback(async () => {
        try {
            const [overview, activity, billing, security] = await Promise.all([
                getOwnerOverview(),
                getActivityHealth(),
                getBillingSummary(),
                getSecurityRisk()
            ]);

            setOverviewData(overview);
            setActivityData(activity);
            setBillingData(billing);
            setSecurityData(security);
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
                        <OrganizationOverview data={overviewData} />
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            <ActivityHealth data={activityData} />
                            <SecurityRisk data={securityData} />
                        </div>
                        <BillingSummary data={billingData} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default OwnerDashboard;
