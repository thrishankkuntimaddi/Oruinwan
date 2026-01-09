import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Route wrapper that blocks pending company users from accessing protected routes
 * Redirects them to /pending-verification if their company is not yet verified
 */
const VerifiedOnlyRoute = ({ children }) => {
    const { user, loading } = useAuth();

    // Show loading state while checking auth
    if (loading) {
        return <div className="h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
        </div>;
    }

    // Not logged in - redirect to login
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // Check if user has a company with pending verification
    const companyStatus = user?.company?.verificationStatus || user?.companyStatus;



    // Block pending users
    if (companyStatus === 'pending' || user?.accountStatus === 'pending_company') {

        return <Navigate to="/pending-verification" replace />;
    }

    // User is verified or has no company (personal user) or is chttrix admin - allow access
    return children;
};

export default VerifiedOnlyRoute;
