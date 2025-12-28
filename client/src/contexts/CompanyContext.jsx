// client/src/contexts/CompanyContext.jsx

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import axios from 'axios';

const CompanyContext = createContext();

export const useCompany = () => {
    const context = useContext(CompanyContext);
    if (!context) {
        throw new Error('useCompany must be used within a CompanyProvider');
    }
    return context;
};

export const CompanyProvider = ({ children }) => {
    const { user } = useAuth();
    const [company, setCompany] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const API_BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

    // Fetch company details
    const fetchCompanyDetails = useCallback(async () => {
        if (!user?.companyId) {
            setCompany(null);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const token = localStorage.getItem('accessToken');
            const response = await axios.get(
                `${API_BASE}/api/companies/${user.companyId}`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            setCompany(response.data.company);
            setError(null);
        } catch (err) {
            console.error('Error fetching company:', err);
            setError(err.response?.data?.message || 'Failed to load company');
            setCompany(null);
        } finally {
            setLoading(false);
        }
    }, [user?.companyId, API_BASE]);

    // Fetch company on mount or when user changes
    useEffect(() => {
        fetchCompanyDetails();
    }, [fetchCompanyDetails]);

    // Update company settings
    const updateCompanySettings = async (settings) => {
        if (!user?.companyId) {
            throw new Error('No company ID');
        }

        try {
            const token = localStorage.getItem('accessToken');
            const response = await axios.put(
                `${API_BASE}/api/companies/${user.companyId}`,
                settings,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            setCompany(response.data.company);
            return response.data.company;
        } catch (err) {
            console.error('Error updating company:', err);
            throw err;
        }
    };

    // Refresh company data
    const refreshCompanyData = () => {
        return fetchCompanyDetails();
    };

    // Get user's company role from user object
    const userCompanyRole = user?.companyRole || 'member';

    // Permission checks
    const isCompanyAdmin = () => {
        return userCompanyRole === 'owner' || userCompanyRole === 'admin';
    };

    const isCompanyOwner = () => {
        return userCompanyRole === 'owner';
    };

    const canManageUsers = () => {
        return isCompanyAdmin();
    };

    const canManageDepartments = () => {
        return isCompanyAdmin();
    };

    const canViewAuditLogs = () => {
        return isCompanyAdmin();
    };

    const value = {
        company,
        loading,
        error,
        userCompanyRole,
        updateCompanySettings,
        refreshCompanyData,
        // Permission helpers
        isCompanyAdmin,
        isCompanyOwner,
        canManageUsers,
        canManageDepartments,
        canViewAuditLogs
    };

    return (
        <CompanyContext.Provider value={value}>
            {children}
        </CompanyContext.Provider>
    );
};

export default CompanyContext;
