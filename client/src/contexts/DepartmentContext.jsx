// client/src/contexts/DepartmentContext.jsx

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import axios from 'axios';

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

    const API_BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

    // Fetch all departments for the company
    const fetchDepartments = useCallback(async () => {
        if (!user?.companyId) {
            setDepartments([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const token = localStorage.getItem('accessToken');

            // Extract ID - handle both object and string formats
            console.log('[DEBUG] user.companyId:', user.companyId);
            const companyId = typeof user.companyId === 'object' && user.companyId !== null
                ? (user.companyId._id || user.companyId.id || user.companyId)
                : user.companyId;
            console.log('[DEBUG] Extracted companyId:', companyId);

            const response = await axios.get(
                `${API_BASE}/api/departments/${companyId}`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
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
    }, [user?.companyId, user?.departmentId, API_BASE]);

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
            const token = localStorage.getItem('accessToken');

            // Extract ID - handle both object and string formats
            console.log('[DEBUG] user.companyId:', user.companyId);
            const companyId = typeof user.companyId === 'object' && user.companyId !== null
                ? (user.companyId._id || user.companyId.id || user.companyId)
                : user.companyId;
            console.log('[DEBUG] Extracted companyId:', companyId);

            const response = await axios.post(
                `${API_BASE}/api/departments`,
                { companyId, name, description },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
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
            const token = localStorage.getItem('accessToken');
            const response = await axios.put(
                `${API_BASE}/api/departments/${departmentId}`,
                data,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
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
            const token = localStorage.getItem('accessToken');
            await axios.delete(
                `${API_BASE}/api/departments/${departmentId}`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

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
            const token = localStorage.getItem('accessToken');
            const response = await axios.get(
                `${API_BASE}/api/departments/${departmentId}/members`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            return response.data.members || [];
        } catch (err) {
            console.error('Error fetching department members:', err);
            throw err;
        }
    };

    // Assign user to department
    const assignUserToDepartment = async (userId, departmentId) => {
        try {
            const token = localStorage.getItem('accessToken');
            await axios.post(
                `${API_BASE}/api/departments/${departmentId}/members`,
                { userId },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
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
            const token = localStorage.getItem('accessToken');
            await axios.delete(
                `${API_BASE}/api/departments/${departmentId}/members/${userId}`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

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
