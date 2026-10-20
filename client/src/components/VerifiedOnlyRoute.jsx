import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState } from './ui/page';

const VerifiedOnlyRoute = ({ children }) => {
    const { user, loading } = useAuth();

    
    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg-base)' }} aria-busy="true">
                <LoadingState label="Checking your account…" />
            </div>
        );
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
