import api from './api';

export const getDepartments = async (companyId) => {
    
    
    const response = await api.get('/api/departments');
    return response.data;
};

export const createDepartment = async (companyId, name, description = '') => {
    const response = await api.post('/api/departments', { companyId, name, description });
    return response.data;
};

export const updateDepartment = async (departmentId, data) => {
    const response = await api.patch(`/api/departments/${departmentId}`, data);
    return response.data;
};

export const deleteDepartment = async (departmentId) => {
    const response = await api.delete(`/api/departments/${departmentId}`);
    return response.data;
};

export const getDepartmentMembers = async (departmentId) => {
    const response = await api.get(`/api/departments/${departmentId}/members`);
    return response.data;
};

export const assignUserToDepartment = async (userId, departmentId) => {
    const response = await api.patch(`/api/departments/${departmentId}/members`, {
        userIds: [userId],
        action: 'add',
    });
    return response.data;
};

export const removeUserFromDepartment = async (userId, departmentId) => {
    const response = await api.patch(`/api/departments/${departmentId}/members`, {
        userIds: [userId],
        action: 'remove',
    });
    return response.data;
};

export const addWorkspaceToDepartment = async (departmentId, workspaceId) => {
    const response = await api.post(`/api/departments/${departmentId}/workspaces`, { workspaceId });
    return response.data;
};

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
