import React, { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const RequireCompanyAdmin = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return <div>Loading...</div>; 
    }

    
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    
    
    const isAuthorized =
        ['owner', 'admin'].includes(user.companyRole) ||
        user.isCoOwner === true;

    if (!isAuthorized) {
        
        return <Navigate to="/workspaces" replace />;
    }

    
    return children ? children : <Outlet />;
};

export default RequireCompanyAdmin;
