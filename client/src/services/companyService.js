// client/src/services/companyService.js

import axios from 'axios';

const API_BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('accessToken')}`
});

// Get company details
export const getCompanyDetails = async (companyId) => {
    const response = await axios.get(
        `${API_BASE}/api/companies/${companyId}`,
        { headers: getAuthHeaders() }
    );
    return response.data;
};

// Update company settings
export const updateCompanySettings = async (companyId, settings) => {
    const response = await axios.put(
        `${API_BASE}/api/companies/${companyId}`,
        settings,
        { headers: getAuthHeaders() }
    );
    return response.data;
};

// Get company metrics (for admin dashboard)
export const getCompanyMetrics = async (companyId) => {
    const response = await axios.get(
        `${API_BASE}/api/companies/${companyId}/metrics`,
        { headers: getAuthHeaders() }
    );
    return response.data;
};

// Get company members
export const getCompanyMembers = async (companyId) => {
    const response = await axios.get(
        `${API_BASE}/api/companies/${companyId}/members`,
        { headers: getAuthHeaders() }
    );
    return response.data;
};

// Update member role
export const updateMemberRole = async (companyId, userId, role) => {
    const response = await axios.put(
        `${API_BASE}/api/companies/${companyId}/members/${userId}/role`,
        { role },
        { headers: getAuthHeaders() }
    );
    return response.data;
};

// Remove member
export const removeMember = async (companyId, userId) => {
    const response = await axios.delete(
        `${API_BASE}/api/companies/${companyId}/members/${userId}`,
        { headers: getAuthHeaders() }
    );
    return response.data;
};

// Invite member
export const inviteMember = async (companyId, inviteData) => {
    const response = await axios.post(
        `${API_BASE}/api/companies/${companyId}/invite`,
        inviteData,
        { headers: getAuthHeaders() }
    );
    return response.data;
};

const companyService = {
    getCompanyDetails,
    updateCompanySettings,
    getCompanyMetrics,
    getCompanyMembers,
    updateMemberRole,
    removeMember,
    inviteMember
};

export default companyService;
