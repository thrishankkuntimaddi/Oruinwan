// client/src/services/departmentService.js

import api from './api';

// Get all departments for a company
export const getDepartments = async (companyId) => {
    const response = await api.get(`/api/departments/${companyId}`);
    return response.data;
};

// Create a new department
export const createDepartment = async (companyId, name, description = '') => {
    const response = await api.post('/api/departments', { companyId, name, description });
    return response.data;
};

// Update department
export const updateDepartment = async (departmentId, data) => {
    const response = await api.put(`/api/departments/${departmentId}`, data);
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

// Assign user to department
export const assignUserToDepartment = async (userId, departmentId) => {
    const response = await api.post(`/api/departments/${departmentId}/members`, { userId });
    return response.data;
};

// Remove user from department
export const removeUserFromDepartment = async (userId, departmentId) => {
    const response = await api.delete(`/api/departments/${departmentId}/members/${userId}`);
    return response.data;
};

const departmentService = {
    getDepartments,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    getDepartmentMembers,
    assignUserToDepartment,
    removeUserFromDepartment
};

export default departmentService;
