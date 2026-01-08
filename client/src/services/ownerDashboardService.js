import api from './api';

const API_URL = '/api/owner-dashboard';

export const getOwnerOverview = async () => {
    try {
        const response = await api.get(`${API_URL}/overview`);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getActivityHealth = async () => {
    try {
        const response = await api.get(`${API_URL}/activity-health`);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getBillingSummary = async () => {
    try {
        const response = await api.get(`${API_URL}/billing-summary`);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getSecurityRisk = async () => {
    try {
        const response = await api.get(`${API_URL}/security-risk`);
        return response.data;
    } catch (error) {
        throw error;
    }
};
