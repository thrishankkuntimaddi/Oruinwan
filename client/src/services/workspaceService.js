// client/src/services/workspaceService.js
import api from './api';

export const workspaceService = {
    // Get all workspaces for a company
    getWorkspaces: (companyId) => api.get(`/api/workspaces/${companyId}`),

    // Create new workspace
    createWorkspace: (data) => api.post('/api/workspaces', data),

    // Update workspace
    updateWorkspace: (id, data) => api.put(`/api/workspaces/${id}`, data),

    // Delete workspace
    deleteWorkspace: (id) => api.delete(`/api/workspaces/${id}`),

    // Get workspace members
    getMembers: (id) => api.get(`/api/workspaces/${id}/members`),

    // Invite member to workspace
    inviteMember: (id, email) => api.post(`/api/workspaces/${id}/invite`, { email })
};
