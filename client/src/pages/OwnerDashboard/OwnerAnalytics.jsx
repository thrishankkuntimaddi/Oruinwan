import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { useCompany } from '../../contexts/CompanyContext';
import { RefreshCw, BarChart3 } from 'lucide-react';
import ActivityHealth from './ActivityHealth';
import SecurityRisk from './SecurityRisk';
import BillingSummary from './BillingSummary';

import {
    getActivityHealth,
    getSecurityRisk,
    getBillingSummary
} from '../../services/ownerDashboardService';

const OwnerAnalytics = () => {
    const { isCompanyOwner } = useCompany();
    const { showToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Data states
    const [activityData, setActivityData] = useState(null);
    const [securityData, setSecurityData] = useState(null);
    const [billingData, setBillingData] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            const [activity, security, billing] = await Promise.all([
                getActivityHealth(),
                getSecurityRisk(),
                getBillingSummary()
            ]);

            setActivityData(activity);
            setSecurityData(security);
            setBillingData(billing);
        } catch (error) {
            console.error("Error fetching owner analytics data:", error);
            showToast("Failed to load analytics data", "error");
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
        showToast("Analytics refreshed", "success");
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
            {/* Header */}
            <header className="h-16 px-8 flex items-center justify-between z-10 bg-white dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700 shadow-sm">
                <div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <BarChart3 className="text-indigo-500" size={24} />
                        Analytics
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-gray-400 font-medium ml-8">
                        Deep dive into health, risk, and billing metrics
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
                    <ActivityHealth data={activityData} />
                    <SecurityRisk data={securityData} />
                    <BillingSummary data={billingData} />
                </div>
            </div>
        </div>
    );
};

export default OwnerAnalytics;
