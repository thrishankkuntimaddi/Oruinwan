// client/src/services/analyticsService.js

import axios from 'axios';

const API_BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const getAuthHeader = () => ({
    headers: {
        Authorization: `Bearer ${localStorage.getItem('accessToken')}`
    }
});

/**
 * Get analytics summary
 * @param {number} period - Number of days (7, 30, 90, 365)
 * @returns {Promise} Analytics summary data
 */
export const getAnalyticsSummary = async (period = 30) => {
    const response = await axios.get(
        `${API_BASE}/api/dashboard/analytics/summary?period=${period}`,
        getAuthHeader()
    );
    return response.data;
};

/**
 * Get user activity analytics
 * @param {number} period - Number of days
 * @returns {Promise} User activity data
 */
export const getUserActivityAnalytics = async (period = 30) => {
    const response = await axios.get(
        `${API_BASE}/api/dashboard/analytics/users?period=${period}`,
        getAuthHeader()
    );
    return response.data;
};

/**
 * Get workspace analytics
 * @returns {Promise} Workspace analytics data
 */
export const getWorkspaceAnalytics = async () => {
    const response = await axios.get(
        `${API_BASE}/api/dashboard/analytics/workspaces`,
        getAuthHeader()
    );
    return response.data;
};

/**
 * Get channel engagement analytics
 * @returns {Promise} Channel engagement data
 */
export const getChannelEngagementAnalytics = async () => {
    const response = await axios.get(
        `${API_BASE}/api/dashboard/analytics/channels`,
        getAuthHeader()
    );
    return response.data;
};

/**
 * Get task analytics
 * @param {number} period - Number of days
 * @returns {Promise} Task analytics data
 */
export const getTaskAnalytics = async (period = 30) => {
    const response = await axios.get(
        `${API_BASE}/api/dashboard/analytics/tasks?period=${period}`,
        getAuthHeader()
    );
    return response.data;
};

/**
 * Get message volume analytics
 * @param {number} period - Number of days
 * @returns {Promise} Message volume data
 */
export const getMessageVolumeAnalytics = async (period = 30) => {
    const response = await axios.get(
        `${API_BASE}/api/dashboard/analytics/messages?period=${period}`,
        getAuthHeader()
    );
    return response.data;
};

/**
 * Get engagement trends
 * @param {number} period - Number of days
 * @returns {Promise} Engagement trends data
 */
export const getEngagementTrends = async (period = 30) => {
    const response = await axios.get(
        `${API_BASE}/api/dashboard/analytics/engagement?period=${period}`,
        getAuthHeader()
    );
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
