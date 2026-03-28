// client/src/services/analyticsService.js
// refactor(consistency): replace raw axios with canonical api.js client
// All auth token injection and 401 handling are now managed by api.js interceptors.

import api, { API_BASE } from './api';

/**
 * Get analytics summary
 * @param {number} period - Number of days (7, 30, 90, 365)
 * @returns {Promise} Analytics summary data
 */
export const getAnalyticsSummary = async (period = 30) => {
    const response = await api.get(`/api/dashboard/analytics/summary?period=${period}`);
    return response.data;
};

/**
 * Get user activity analytics
 * @param {number} period - Number of days
 * @returns {Promise} User activity data
 */
export const getUserActivityAnalytics = async (period = 30) => {
    const response = await api.get(`/api/dashboard/analytics/users?period=${period}`);
    return response.data;
};

/**
 * Get workspace analytics
 * @returns {Promise} Workspace analytics data
 */
export const getWorkspaceAnalytics = async () => {
    const response = await api.get('/api/dashboard/analytics/workspaces');
    return response.data;
};

/**
 * Get channel engagement analytics
 * @returns {Promise} Channel engagement data
 */
export const getChannelEngagementAnalytics = async () => {
    const response = await api.get('/api/dashboard/analytics/channels');
    return response.data;
};

/**
 * Get task analytics
 * @param {number} period - Number of days
 * @returns {Promise} Task analytics data
 */
export const getTaskAnalytics = async (period = 30) => {
    const response = await api.get(`/api/dashboard/analytics/tasks?period=${period}`);
    return response.data;
};

/**
 * Get message volume analytics
 * @param {number} period - Number of days
 * @returns {Promise} Message volume data
 */
export const getMessageVolumeAnalytics = async (period = 30) => {
    const response = await api.get(`/api/dashboard/analytics/messages?period=${period}`);
    return response.data;
};

/**
 * Get engagement trends
 * @param {number} period - Number of days
 * @returns {Promise} Engagement trends data
 */
export const getEngagementTrends = async (period = 30) => {
    const response = await api.get(`/api/dashboard/analytics/engagement?period=${period}`);
    return response.data;
};

/**
 * Export analytics data
 * @param {string} format - 'csv' or 'json'
 * @param {number} period - Number of days
 * @returns {Promise} Export data
 */
export const exportAnalytics = async (format = 'csv', period = 30) => {
    // This will be implemented to download analytics data
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

    // Convert to CSV format
    return convertToCSV(data);
};

/**
 * Helper function to convert data to CSV
 * @param {object} data - Analytics data
 * @returns {string} CSV string
 */
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

/**
 * Get comprehensive analytics for company
 * @param {string} companyId
 * @param {string} timeRange - '7d', '30d', or '90d'
 * @returns {Promise}
 */
export const getCompanyAnalytics = async (companyId, timeRange = '30d') => {
    const response = await api.get(`/api/analytics/company/${companyId}?timeRange=${timeRange}`);
    return response.data;
};

// ─── NEW PRODUCTIVITY INSIGHTS ENDPOINTS ────────────────────────────────────

/**
 * Get team activity analytics (messages + tasks per user)
 */
export const getTeamActivity = async (period = 30) => {
    const response = await api.get(`/api/analytics/insights/team?period=${period}`);
    return response.data;
};

/**
 * Get workload analysis (overloaded/idle/balanced users)
 */
export const getWorkloadAnalysis = async (period = 30) => {
    const response = await api.get(`/api/analytics/insights/workload?period=${period}`);
    return response.data;
};

/**
 * Get communication patterns (hourly distribution, top channels)
 */
export const getCommunicationPatterns = async (period = 30) => {
    const response = await api.get(`/api/analytics/insights/communication?period=${period}`);
    return response.data;
};

/**
 * Get all insights in one call (/api/analytics with no type param)
 */
export const getAllInsights = async (period = 30) => {
    const response = await api.get(`/api/analytics?period=${period}`);
    return response.data;
};
