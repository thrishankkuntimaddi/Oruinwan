import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const RequireDepartmentManager = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) return <div>Loading...</div>;

    if (!user) return <Navigate to="/login" replace />;

    // Owners and Admins also have access to manager features
    const isSuperUser = ['owner', 'admin'].includes(user.companyRole) || user.isCoOwner;
    const isManager = user.companyRole === 'manager';

    if (!isSuperUser && !isManager) {
        return <Navigate to="/workspaces" replace />;
    }

    return children ? children : <Outlet />;
};

export default RequireDepartmentManager;
