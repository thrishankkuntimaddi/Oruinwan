import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import api, { API_BASE } from '@services/api';

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

    
    const fetchCompanyDetails = useCallback(async () => {
        if (!user?.companyId) {
            setCompany(null);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);

            

            const companyId = typeof user.companyId === 'object' && user.companyId !== null
                ? (user.companyId._id || user.companyId.id || user.companyId)
                : user.companyId;

            const response = await api.get(`${API_BASE}/api/companies/${companyId}`);
            setCompany(response.data.company);
            setError(null);
        } catch (err) {
            console.error('Error fetching company:', err);
            setError(err.response?.data?.message || 'Failed to load company');
            setCompany(null);
        } finally {
            setLoading(false);
        }
    }, [user?.companyId]);

    
    useEffect(() => {
        fetchCompanyDetails();
    }, [fetchCompanyDetails]);

    
    const updateCompanySettings = async (settings) => {
        if (!user?.companyId) {
            throw new Error('No company ID');
        }

        try {

            

            const companyId = typeof user.companyId === 'object' && user.companyId !== null
                ? (user.companyId._id || user.companyId.id || user.companyId)
                : user.companyId;

            const response = await api.put(
                `${API_BASE}/api/companies/${companyId}`,
                settings
            );
            setCompany(response.data.company);
            return response.data.company;
        } catch (err) {
            console.error('Error updating company:', err);
            throw err;
        }
    };

    
    const refreshCompanyData = () => {
        return fetchCompanyDetails();
    };

    
    const userCompanyRole = user?.companyRole || 'member';

    
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
