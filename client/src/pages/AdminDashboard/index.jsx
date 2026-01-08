import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../contexts/CompanyContext';
import { useToast } from '../../contexts/ToastContext';
import { RefreshCw, Shield, LayoutGrid } from 'lucide-react';

import UsersAccess from './UsersAccess';
import DepartmentsView from './DepartmentsView';
import WorkspacesAccess from './WorkspacesAccess';
import AuditSecurity from './AuditSecurity';

import {
    getUsersAccess,
    getDepartmentsView,
    getWorkspacesAccess,
    getAuditSecurity
} from '../../services/adminDashboardService';

const AdminDashboard = () => {
    const { isCompanyAdmin } = useCompany(); // Assuming useCompany exposes isOwner or we check user role
    const { showToast } = useToast();
    const navigate = useNavigate();

    // 👑 Explicit Owner Redirect
    useEffect(() => {
        // If the context doesn't expose isOwner directly, we can check it via user object or role
        // For now, assuming useCompany or AuthContext provides this info.
        // Let's use a safer approach getting user from AuthContext if strictly needed, 
        // but let's see if we can just redirect if companyRole is owner.
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                if (user.companyRole === 'owner') {
                    navigate('/owner/dashboard', { replace: true });
                }
            } catch (e) {
                // ignore
            }
        }
    }, [navigate]);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [usersData, setUsersData] = useState(null);
    const [deptData, setDeptData] = useState(null);
    const [workspaceData, setWorkspaceData] = useState(null);
    const [auditData, setAuditData] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            const [users, depts, workspaces, audit] = await Promise.all([
                getUsersAccess(),
                getDepartmentsView(),
                getWorkspacesAccess(),
                getAuditSecurity()
            ]);

            setUsersData(users);
            setDeptData(depts);
            setWorkspaceData(workspaces);
            setAuditData(audit);
        } catch (error) {
            console.error("Error fetching admin dashboard data:", error);
            showToast("Failed to load dashboard data", "error");
        }
    }, [showToast]);

    useEffect(() => {
        if (!isCompanyAdmin()) return;

        const loadInitialData = async () => {
            setLoading(true);
            await fetchData();
            setLoading(false);
        };

        loadInitialData();
    }, [isCompanyAdmin, fetchData]);

    const handleRefresh = async () => {
        if (refreshing) return;
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
        showToast("Dashboard refreshed", "success");
    };

    if (!isCompanyAdmin()) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
                <div className="text-center">
                    <Shield className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">You need admin privileges to access this page.</p>
                    <button
                        onClick={() => navigate('/workspaces')}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        Go to Workspaces
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
                        <Shield className="text-indigo-600 dark:text-indigo-400" size={24} />
                        Admin Console
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-gray-400 font-medium ml-8">
                        People, Structure & Compliance · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/admin/onboard')}
                        className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-md hover:shadow-lg flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <line x1="19" y1="8" x2="19" y2="14" />
                            <line x1="22" y1="11" x2="16" y2="11" />
                        </svg>
                        Onboard Employee
                    </button>
                    <button
                        onClick={() => navigate('/manager/dashboard')}
                        className="px-4 py-2 bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-gray-600 transition-colors shadow-sm flex items-center gap-2"
                    >
                        <LayoutGrid size={16} />
                        Manager Console
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
                        <UsersAccess data={usersData} />
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <DepartmentsView data={deptData} />
                            <WorkspacesAccess data={workspaceData} />
                        </div>
                        <AuditSecurity data={auditData} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;
