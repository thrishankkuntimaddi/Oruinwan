import api from './api';

export const getCompanyDetails = async (companyId) => {
    const response = await api.get(`/api/companies/${companyId}`);
    return response.data;
};

export const updateCompanySettings = async (companyId, settings) => {
    const response = await api.put(`/api/companies/${companyId}`, settings);
    return response.data;
};

export const getCompanyMetrics = async (companyId) => {
    const response = await api.get(`/api/companies/${companyId}/metrics`);
    return response.data;
};

export const getCompanyMembers = async (companyId) => {
    const response = await api.get(`/api/companies/${companyId}/members`);
    return response.data;
};

export const updateMemberRole = async (companyId, userId, role) => {
    const response = await api.put(`/api/companies/${companyId}/members/${userId}/role`, { role });
    return response.data;
};

export const removeMember = async (companyId, userId) => {
    const response = await api.delete(`/api/companies/${companyId}/members/${userId}`);
    return response.data;
};

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
