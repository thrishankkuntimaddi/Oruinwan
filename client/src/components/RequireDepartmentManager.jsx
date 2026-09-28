import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingScreen from '../shared/components/ui/LoadingScreen';
import { isAdminUser, isManagerUser } from './company-dash/dashNav';

/** Manager console gate: managers, plus owners/admins/co-owners (cross-department view). */
const RequireDepartmentManager = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) return <LoadingScreen />;
    if (!user) return <Navigate to="/login" replace />;
    if (!isAdminUser(user) && !isManagerUser(user)) return <Navigate to="/workspaces" replace />;

    return children ? children : <Outlet />;
};

export default RequireDepartmentManager;
