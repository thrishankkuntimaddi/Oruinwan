// client/src/services/dashboardService.js

import axios from 'axios';

const API_BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('accessToken')}`
});

// Get admin dashboard metrics
export const getAdminMetrics = async (companyId) => {
    const response = await axios.get(
        `${API_BASE}/api/dashboard/admin/${companyId}`,
        { headers: getAuthHeaders() }
    );
    return response.data;
};

// Get manager team data
export const getManagerTeamData = async (managerId) => {
    const response = await axios.get(
        `${API_BASE}/api/dashboard/manager/${managerId}`,
        { headers: getAuthHeaders() }
    );
    return response.data;
};

// Get employee personal data
export const getEmployeePersonalData = async (userId) => {
    const response = await axios.get(
        `${API_BASE}/api/dashboard/employee/${userId}`,
        { headers: getAuthHeaders() }
    );
    return response.data;
};

const dashboardService = {
    getAdminMetrics,
    getManagerTeamData,
    getEmployeePersonalData
};

export default dashboardService;
