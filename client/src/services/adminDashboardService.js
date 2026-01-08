import api from './api';

const API_URL = '/api/admin-dashboard';

export const getUsersAccess = async () => {
    try {
        const response = await api.get(`${API_URL}/users-access`);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getDepartmentsView = async () => {
    try {
        const response = await api.get(`${API_URL}/departments`);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getWorkspacesAccess = async () => {
    try {
        const response = await api.get(`${API_URL}/workspaces-access`);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getAuditSecurity = async () => {
    try {
        const response = await api.get(`${API_URL}/audit-security`);
        return response.data;
    } catch (error) {
        throw error;
    }
};
