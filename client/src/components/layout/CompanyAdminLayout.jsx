
import React from 'react';
import { Outlet } from 'react-router-dom';
import AdminSidebar from '../admin/AdminSidebar';
import { useCompany } from '../../contexts/CompanyContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';

const CompanyAdminLayout = () => {
    const { company } = useCompany();
    const { theme, toggleTheme } = useTheme();

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900 font-sans text-gray-900 dark:text-gray-100 overflow-hidden transition-colors duration-200">
            <AdminSidebar />

            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Top Context Bar - Sticky */}
                <header className="h-20 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-8 sticky top-0 z-10 transition-colors duration-200">
                    <div className="flex items-center gap-4">
                        {/* Company Name Context */}
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">
                                Company Workspace
                            </span>
                            <h1 className="text-xl font-black text-gray-900 dark:text-white leading-none tracking-tight">
                                {company?.name || 'My Company'}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Quick Actions / Date (Optional) */}
                        <div className="hidden md:flex flex-col items-end mr-4">
                            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                            </span>
                            <span className="text-xs text-green-500 font-bold flex items-center gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                System Online
                            </span>
                        </div>

                        {/* Theme Toggle */}
                        <button
                            onClick={toggleTheme}
                            className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900"
                            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                        >
                            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                        </button>
                    </div>
                </header>

                {/* Main Scrollable Content */}
                <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 transition-colors duration-200 relative">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default CompanyAdminLayout;
