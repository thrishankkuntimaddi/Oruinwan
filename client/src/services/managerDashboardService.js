import api from './api';

const API_URL = '/api/manager-dashboard';

export const getMyWorkspaces = async () => {
    try {
        const response = await api.get(`${API_URL}/my-workspaces`);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getTeamLoad = async () => {
    try {
        const response = await api.get(`${API_URL}/team-load`);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getUnassignedEmployees = async () => {
    try {
        const response = await api.get(`${API_URL}/unassigned-employees`);
        return response.data;
    } catch (error) {
        throw error;
    }
};
