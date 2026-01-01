// client/src/services/companyService.js

import api from './api';

// Get company details
export const getCompanyDetails = async (companyId) => {
    const response = await api.get(`/api/companies/${companyId}`);
    return response.data;
};

// Update company settings
export const updateCompanySettings = async (companyId, settings) => {
    const response = await api.put(`/api/companies/${companyId}`, settings);
    return response.data;
};

// Get company metrics (for admin dashboard)
export const getCompanyMetrics = async (companyId) => {
    const response = await api.get(`/api/companies/${companyId}/metrics`);
    return response.data;
};

// Get company members
export const getCompanyMembers = async (companyId) => {
    const response = await api.get(`/api/companies/${companyId}/members`);
    return response.data;
};

// Update member role
export const updateMemberRole = async (companyId, userId, role) => {
    const response = await api.put(`/api/companies/${companyId}/members/${userId}/role`, { role });
    return response.data;
};

// Remove member
export const removeMember = async (companyId, userId) => {
    const response = await api.delete(`/api/companies/${companyId}/members/${userId}`);
    return response.data;
};

// Invite member
export const inviteMember = async (companyId, inviteData) => {
    const response = await api.post(`/api/companies/${companyId}/invite`, inviteData);
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
