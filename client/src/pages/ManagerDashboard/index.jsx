import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../contexts/CompanyContext';
import { useToast } from '../../contexts/ToastContext';
import { RefreshCw, LayoutGrid, Shield } from 'lucide-react';

import MyWorkspaces from './MyWorkspaces';
import TeamLoad from './TeamLoad';
import UnassignedEmployees from './UnassignedEmployees';

import {
  getMyWorkspaces,
  getTeamLoad,
  getUnassignedEmployees
} from '../../services/managerDashboardService';

const ManagerDashboard = () => {
  // We can reuse isCompanyAdmin check or create a specific isManager helper if available
  // For now, assuming managers have at least some specific role or just reusing admin/owner logic + manager logic
  // But better to strictly use what permissions allow.
  // However, the backend middleware 'requireManager' allows owner, admin, manager.
  // Context probably needs an update to expose isManager or we check role manually.
  const { userCompanyRole, isCompanyOwner } = useCompany();
  const isManagerOrAbove = ['owner', 'admin', 'manager'].includes(userCompanyRole) || isCompanyOwner();

  const { showToast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [workspacesData, setWorkspacesData] = useState(null);
  const [teamLoadData, setTeamLoadData] = useState(null);
  const [unassignedData, setUnassignedData] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [wsData, teamData, unassigned] = await Promise.all([
        getMyWorkspaces(),
        getTeamLoad(),
        getUnassignedEmployees()
      ]);

      setWorkspacesData(wsData);
      setTeamLoadData(teamData);
      setUnassignedData(unassigned);
    } catch (error) {
      console.error("Error fetching manager dashboard data:", error);
      // Don't show toast on every error to avoid spamming if user is just not a manager of anything yet
      if (error.response?.status !== 404) {
        showToast("Failed to load dashboard data", "error");
      }
    }
  }, [showToast]);

  useEffect(() => {
    if (!isManagerOrAbove) return;

    const loadInitialData = async () => {
      setLoading(true);
      await fetchData();
      setLoading(false);
    };

    loadInitialData();
  }, [isManagerOrAbove, fetchData]);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
    showToast("Dashboard refreshed", "success");
  };

  if (!isManagerOrAbove) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="text-center">
          <LayoutGrid className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">You need manager privileges to access this page.</p>
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
            <LayoutGrid className="text-indigo-600 dark:text-indigo-400" size={24} />
            Manager Console
          </h2>
          <p className="text-xs text-slate-500 dark:text-gray-400 font-medium ml-8">
            Delivery & Team Allocation · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Show Admin Console button only if user is admin/owner */}
          {['owner', 'admin'].includes(userCompanyRole) && (
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="px-4 py-2 bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-gray-600 transition-colors shadow-sm flex items-center gap-2"
            >
              <Shield size={16} />
              Admin Console
            </button>
          )}
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
            {/* Top Row: Unassigned Employees (Critical Action) & Team Load */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <UnassignedEmployees data={unassignedData} />
              <TeamLoad data={teamLoadData} />
            </div>

            {/* Bottom Row: My Workspaces */}
            <MyWorkspaces data={workspacesData} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ManagerDashboard;
