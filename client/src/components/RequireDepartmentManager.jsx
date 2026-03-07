import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const RequireDepartmentManager = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) return (
    <div className="h-screen w-full animate-pulse bg-gray-50 dark:bg-gray-900 flex flex-col gap-4 p-8">
        <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        <div className="flex gap-4 mt-2">
            {[1,2,3].map(i => <div key={i} className="flex-1 h-28 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700" />)}
        </div>
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 mt-2" />
    </div>
);

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
