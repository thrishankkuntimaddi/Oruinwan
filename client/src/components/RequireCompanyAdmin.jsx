import React, { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const RequireCompanyAdmin = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return <div>Loading...</div>; // Or a proper spinner
    }

    // Check if user is authenticated
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // Check if role is 'owner' or 'admin' 
    // OR if they have the bespoke isCoOwner flag
    const isAuthorized =
        ['owner', 'admin'].includes(user.companyRole) ||
        user.isCoOwner === true;

    if (!isAuthorized) {
        // Redirect standard members to their workspace
        return <Navigate to="/workspaces" replace />;
    }

    // If wrapping a component, return it, otherwise render child routes
    return children ? children : <Outlet />;
};

export default RequireCompanyAdmin;
