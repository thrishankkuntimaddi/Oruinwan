// client/src/contexts/DepartmentContext.jsx

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import api, { API_BASE } from '../services/api';

const DepartmentContext = createContext();

export const useDepartment = () => {
    const context = useContext(DepartmentContext);
    if (!context) {
        throw new Error('useDepartment must be used within a DepartmentProvider');
    }
    return context;
};

export const DepartmentProvider = ({ children }) => {
    const { user } = useAuth();
    const [departments, setDepartments] = useState([]);
    const [userDepartment, setUserDepartment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch all departments for the company
    const fetchDepartments = useCallback(async () => {
        if (!user?.companyId) {
            setDepartments([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);

            // Extract ID - handle both object and string formats

            const companyId = typeof user.companyId === 'object' && user.companyId !== null
                ? (user.companyId._id || user.companyId.id || user.companyId)
                : user.companyId;


            const response = await api.get(`${API_BASE}/api/departments/${companyId}`);
            setDepartments(response.data.departments || []);

            // Set user's department if they have one
            if (user.departmentId) {
                const userDept = response.data.departments?.find(d => d._id === user.departmentId);
                setUserDepartment(userDept || null);
            }

            setError(null);
        } catch (err) {
            console.error('Error fetching departments:', err);
            setError(err.response?.data?.message || 'Failed to load departments');
            setDepartments([]);
        } finally {
            setLoading(false);
        }
    }, [user?.companyId, user?.departmentId]);

    // Fetch on mount or when user changes
    useEffect(() => {
        fetchDepartments();
    }, [fetchDepartments]);

    // Create new department
    const createDepartment = async (name, description = '') => {
        if (!user?.companyId) {
            throw new Error('No company ID');
        }

        try {

            // Extract ID - handle both object and string formats

            const companyId = typeof user.companyId === 'object' && user.companyId !== null
                ? (user.companyId._id || user.companyId.id || user.companyId)
                : user.companyId;


            const response = await api.post(
                `${API_BASE}/api/departments`,
                { companyId, name, description }
            );

            // Add new department to state
            setDepartments(prev => [...prev, response.data.department]);
            return response.data.department;
        } catch (err) {
            console.error('Error creating department:', err);
            throw err;
        }
    };

    // Update department
    const updateDepartment = async (departmentId, data) => {
        try {
            const response = await api.put(
                `${API_BASE}/api/departments/${departmentId}`,
                data
            );

            // Update in state
            setDepartments(prev =>
                prev.map(dept =>
                    dept._id === departmentId ? response.data.department : dept
                )
            );
            return response.data.department;
        } catch (err) {
            console.error('Error updating department:', err);
            throw err;
        }
    };

    // Delete department
    const deleteDepartment = async (departmentId) => {
        try {
            await api.delete(`${API_BASE}/api/departments/${departmentId}`);

            // Remove from state
            setDepartments(prev => prev.filter(dept => dept._id !== departmentId));
        } catch (err) {
            console.error('Error deleting department:', err);
            throw err;
        }
    };

    // Get department members
    const getDepartmentMembers = async (departmentId) => {
        try {
            const response = await api.get(`${API_BASE}/api/departments/${departmentId}/members`);
            return response.data.members || [];
        } catch (err) {
            console.error('Error fetching department members:', err);
            throw err;
        }
    };

    // Assign user to department
    const assignUserToDepartment = async (userId, departmentId) => {
        try {
            await api.post(
                `${API_BASE}/api/departments/${departmentId}/members`,
                { userId }
            );

            // Refresh departments to get updated member counts
            await fetchDepartments();
        } catch (err) {
            console.error('Error assigning user to department:', err);
            throw err;
        }
    };

    // Remove user from department
    const removeUserFromDepartment = async (userId, departmentId) => {
        try {
            await api.delete(`${API_BASE}/api/departments/${departmentId}/members/${userId}`);

            // Refresh departments
            await fetchDepartments();
        } catch (err) {
            console.error('Error removing user from department:', err);
            throw err;
        }
    };

    // Refresh department data
    const refreshDepartments = () => {
        return fetchDepartments();
    };

    const value = {
        departments,
        userDepartment,
        loading,
        error,
        createDepartment,
        updateDepartment,
        deleteDepartment,
        getDepartmentMembers,
        assignUserToDepartment,
        removeUserFromDepartment,
        refreshDepartments
    };

    return (
        <DepartmentContext.Provider value={value}>
            {children}
        </DepartmentContext.Provider>
    );
};

export default DepartmentContext;
