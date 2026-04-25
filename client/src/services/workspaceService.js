import api from './api';

export const workspaceService = {
    
    getWorkspaces: (companyId) => api.get(`/api/workspaces/${companyId}`),

    
    createWorkspace: (data) => api.post('/api/workspaces', data),

    
    updateWorkspace: (id, data) => api.put(`/api/workspaces/${id}`, data),

    
    deleteWorkspace: (id) => api.delete(`/api/workspaces/${id}`),

    
    getMembers: (id) => api.get(`/api/workspaces/${id}/members`),

    
    inviteMember: (id, email) => api.post(`/api/workspaces/${id}/invite`, { email })
};
