// client/src/services/departmentService.js

import api from './api';

// Get all departments for a company
export const getDepartments = async (companyId) => {
    // Phase 2: company is inferred from middleware (req.companyId)
    // companyId param kept for backward-compat call sites but NOT sent in URL
    const response = await api.get('/api/departments');
    return response.data;
};

// Create a new department
export const createDepartment = async (companyId, name, description = '') => {
    const response = await api.post('/api/departments', { companyId, name, description });
    return response.data;
};

// Update department
export const updateDepartment = async (departmentId, data) => {
    const response = await api.patch(`/api/departments/${departmentId}`, data);
    return response.data;
};

// Delete department
export const deleteDepartment = async (departmentId) => {
    const response = await api.delete(`/api/departments/${departmentId}`);
    return response.data;
};

// Get department members
export const getDepartmentMembers = async (departmentId) => {
    const response = await api.get(`/api/departments/${departmentId}/members`);
    return response.data;
};

// Assign user to department (Phase 2: PATCH with action:'add')
export const assignUserToDepartment = async (userId, departmentId) => {
    const response = await api.patch(`/api/departments/${departmentId}/members`, {
        userIds: [userId],
        action: 'add',
    });
    return response.data;
};

// Remove user from department (Phase 2: PATCH with action:'remove')
export const removeUserFromDepartment = async (userId, departmentId) => {
    const response = await api.patch(`/api/departments/${departmentId}/members`, {
        userIds: [userId],
        action: 'remove',
    });
    return response.data;
};

// Add workspace to department
export const addWorkspaceToDepartment = async (departmentId, workspaceId) => {
    const response = await api.post(`/api/departments/${departmentId}/workspaces`, { workspaceId });
    return response.data;
};

// Remove workspace from department
export const removeWorkspaceFromDepartment = async (departmentId, workspaceId) => {
    const response = await api.delete(`/api/departments/${departmentId}/workspaces/${workspaceId}`);
    return response.data;
};

const departmentService = {
    getDepartments,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    getDepartmentMembers,
    assignUserToDepartment,
    removeUserFromDepartment,
    addWorkspaceToDepartment,
    removeWorkspaceFromDepartment
};

export default departmentService;
