import api from './api';

export const getDashboardMetrics = async (companyId) => {
    const response = await api.get(`/api/dashboard/metrics/${companyId}`);
    return response.data;
};

export const getAdminMetrics = async (companyId) => {
    const response = await api.get(`/api/dashboard/admin/${companyId}`);
    return response.data;
};

export const getManagerTeamData = async (managerId) => {
    const response = await api.get(`/api/dashboard/manager/${managerId}`);
    return response.data;
};

export const getEmployeePersonalData = async (userId) => {
    const response = await api.get(`/api/dashboard/employee/${userId}`);
    return response.data;
};

export const getWorkspaceDashboard = async (workspaceId) => {
    const response = await api.get(`/api/dashboard/workspace/${workspaceId}`);
    return response.data;
};

export const getAnalyticsSummary = async () => {
    const response = await api.get('/api/dashboard/analytics/summary');
    return response.data;
};

export const getUserActivityAnalytics = async () => {
    const response = await api.get('/api/dashboard/analytics/users');
    return response.data;
};

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
