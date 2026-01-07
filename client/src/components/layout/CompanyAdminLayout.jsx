import React from 'react';
import { Outlet } from 'react-router-dom';
import AdminSidebar from '../admin/AdminSidebar';

const CompanyAdminLayout = () => {
    return (
        <div className="flex h-screen bg-gray-50 font-sans text-slate-900 overflow-hidden">
            <AdminSidebar />

            <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 dark:bg-slate-900/50 relative">
                <Outlet />
            </main>
        </div>
    );
};

export default CompanyAdminLayout;
