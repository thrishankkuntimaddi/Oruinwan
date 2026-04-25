import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const VerifiedOnlyRoute = ({ children }) => {
    const { user, loading } = useAuth();

    
    if (loading) {
        return <div className="h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
        </div>;
    }

    
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    
    const companyStatus = user?.company?.verificationStatus || user?.companyStatus;

    
    if (companyStatus === 'pending' || user?.accountStatus === 'pending_company') {

        return <Navigate to="/pending-verification" replace />;
    }

    
    return children;
};

export default VerifiedOnlyRoute;
