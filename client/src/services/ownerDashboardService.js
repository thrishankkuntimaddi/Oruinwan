import api from './api';

const API_URL = '/api/owner-dashboard';

export const getOwnerOverview = async () => {
    const response = await api.get(`${API_URL}/overview`);
    return response.data;
};

export const getActivityHealth = async () => {
    const response = await api.get(`${API_URL}/activity-health`);
    return response.data;
};

export const getBillingSummary = async () => {
    const response = await api.get(`${API_URL}/billing-summary`);
    return response.data;
};

export const getSecurityRisk = async () => {
    const response = await api.get(`${API_URL}/security-risk`);
    return response.data;
};

export const getOwnerAnalytics = async (timeRange = '30d') => {
    const response = await api.get(`${API_URL}/analytics?timeRange=${timeRange}`);
    return response.data;
};
