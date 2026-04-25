import api, { API_BASE } from './api';

export const getAnalyticsSummary = async (period = 30) => {
    const response = await api.get(`/api/dashboard/analytics/summary?period=${period}`);
    return response.data;
};

export const getUserActivityAnalytics = async (period = 30) => {
    const response = await api.get(`/api/dashboard/analytics/users?period=${period}`);
    return response.data;
};

export const getWorkspaceAnalytics = async () => {
    const response = await api.get('/api/dashboard/analytics/workspaces');
    return response.data;
};

export const getChannelEngagementAnalytics = async () => {
    const response = await api.get('/api/dashboard/analytics/channels');
    return response.data;
};

export const getTaskAnalytics = async (period = 30) => {
    const response = await api.get(`/api/dashboard/analytics/tasks?period=${period}`);
    return response.data;
};

export const getMessageVolumeAnalytics = async (period = 30) => {
    const response = await api.get(`/api/dashboard/analytics/messages?period=${period}`);
    return response.data;
};

export const getEngagementTrends = async (period = 30) => {
    const response = await api.get(`/api/dashboard/analytics/engagement?period=${period}`);
    return response.data;
};

export const exportAnalytics = async (format = 'csv', period = 30) => {
    
    const [summary, users, workspaces, channels, tasks, messages] = await Promise.all([
        getAnalyticsSummary(period),
        getUserActivityAnalytics(period),
        getWorkspaceAnalytics(),
        getChannelEngagementAnalytics(),
        getTaskAnalytics(period),
        getMessageVolumeAnalytics(period)
    ]);

    const data = {
        summary,
        users,
        workspaces,
        channels,
        tasks,
        messages,
        exportedAt: new Date().toISOString(),
        period
    };

    if (format === 'json') {
        return data;
    }

    
    return convertToCSV(data);
};

const convertToCSV = (data) => {
    let csv = 'ChttrixCollab Analytics Export\n';
    csv += `Exported: ${new Date().toLocaleString()}\n`;
    csv += `Period: ${data.period} days\n\n`;

    csv += 'Summary Metrics\n';
    csv += 'Metric,Value\n';
    Object.entries(data.summary.summary).forEach(([key, value]) => {
        csv += `${key},${value}\n`;
    });

    csv += '\n';
    return csv;
};

export const getCompanyAnalytics = async (companyId, timeRange = '30d') => {
    const response = await api.get(`/api/analytics/company/${companyId}?timeRange=${timeRange}`);
    return response.data;
};

export const getTeamActivity = async (period = 30) => {
    const response = await api.get(`/api/analytics/insights/team?period=${period}`);
    return response.data;
};

export const getWorkloadAnalysis = async (period = 30) => {
    const response = await api.get(`/api/analytics/insights/workload?period=${period}`);
    return response.data;
};

export const getCommunicationPatterns = async (period = 30) => {
    const response = await api.get(`/api/analytics/insights/communication?period=${period}`);
    return response.data;
};

export const getAllInsights = async (period = 30) => {
    const response = await api.get(`/api/analytics?period=${period}`);
    return response.data;
};
