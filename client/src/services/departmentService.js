// client/src/services/departmentService.js

import axios from 'axios';

const API_BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('accessToken')}`
});

// Get all departments for a company
export const getDepartments = async (companyId) => {
    const response = await axios.get(
        `${API_BASE}/api/departments/${companyId}`,
        { headers: getAuthHeaders() }
    );
    return response.data;
};

// Create a new department
export const createDepartment = async (companyId, name, description = '') => {
    const response = await axios.post(
        `${API_BASE}/api/departments`,
        { companyId, name, description },
        { headers: getAuthHeaders() }
    );
    return response.data;
};

// Update department
export const updateDepartment = async (departmentId, data) => {
    const response = await axios.put(
        `${API_BASE}/api/departments/${departmentId}`,
        data,
        { headers: getAuthHeaders() }
    );
    return response.data;
};

// Delete department
export const deleteDepartment = async (departmentId) => {
    const response = await axios.delete(
        `${API_BASE}/api/departments/${departmentId}`,
        { headers: getAuthHeaders() }
    );
    return response.data;
};

// Get department members
export const getDepartmentMembers = async (departmentId) => {
    const response = await axios.get(
        `${API_BASE}/api/departments/${departmentId}/members`,
        { headers: getAuthHeaders() }
    );
    return response.data;
};

// Assign user to department
export const assignUserToDepartment = async (userId, departmentId) => {
    const response = await axios.post(
        `${API_BASE}/api/departments/${departmentId}/members`,
        { userId },
        { headers: getAuthHeaders() }
    );
    return response.data;
};

// Remove user from department
export const removeUserFromDepartment = async (userId, departmentId) => {
    const response = await axios.delete(
        `${API_BASE}/api/departments/${departmentId}/members/${userId}`,
        { headers: getAuthHeaders() }
    );
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
