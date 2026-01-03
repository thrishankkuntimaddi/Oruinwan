// client/src/services/dashboardService.js

import api from './api';

/**
 * Get real-time dashboard metrics for admin
 * This is the primary metrics endpoint used by AdminDashboard
 */
export const getDashboardMetrics = async (companyId) => {
    const response = await api.get(`/api/dashboard/metrics/${companyId}`);
    return response.data;
};

/**
 * Get admin dashboard data (legacy endpoint - may be deprecated)
 */
export const getAdminMetrics = async (companyId) => {
    const response = await api.get(`/api/dashboard/admin/${companyId}`);
    return response.data;
};

/**
 * Get manager team data
 */
export const getManagerTeamData = async (managerId) => {
    const response = await api.get(`/api/dashboard/manager/${managerId}`);
    return response.data;
};

/**
 * Get employee personal data
 */
export const getEmployeePersonalData = async (userId) => {
    const response = await api.get(`/api/dashboard/employee/${userId}`);
    return response.data;
};

/**
 * Get workspace dashboard data
 */
export const getWorkspaceDashboard = async (workspaceId) => {
    const response = await api.get(`/api/dashboard/workspace/${workspaceId}`);
    return response.data;
};

/**
 * Get analytics summary
 */
export const getAnalyticsSummary = async () => {
    const response = await api.get('/api/dashboard/analytics/summary');
    return response.data;
};

/**
 * Get user activity analytics
 */
export const getUserActivityAnalytics = async () => {
    const response = await api.get('/api/dashboard/analytics/users');
    return response.data;
};

/**
 * Get workspace analytics
 */
export const getWorkspaceAnalytics = async () => {
    const response = await api.get('/api/dashboard/analytics/workspaces');
    return response.data;
};

const dashboardService = {
    getDashboardMetrics,
    getAdminMetrics,
    getManagerTeamData,
    getEmployeePersonalData,
    getWorkspaceDashboard,
    getAnalyticsSummary,
    getUserActivityAnalytics,
    getWorkspaceAnalytics
};

export default dashboardService;
