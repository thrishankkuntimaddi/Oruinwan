import React from 'react';
import { Outlet } from 'react-router-dom';
import ManagerSidebar from '../manager/ManagerSidebar';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Sun, Moon, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ManagerLayout = () => {
    const { company, isCompanyOwner, isCompanyAdmin } = useCompany();
    const { user } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();

    const showAdminButton = isCompanyOwner() || isCompanyAdmin();

    const selectedDept = company?.departments?.find(d =>
        d.head?._id === user?._id || d.head === user?._id
    ) || company?.departments?.[0];



    return (
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900 font-sans text-gray-900 dark:text-gray-100 overflow-hidden transition-colors duration-200">
            <ManagerSidebar />

            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Top Context Bar - Sticky */}
                <header className="h-20 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-8 sticky top-0 z-10 transition-colors duration-200">
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">
                                Workspace Manager
                            </span>
                            <h1 className="text-xl font-black text-gray-900 dark:text-white leading-none tracking-tight">
                                {company?.displayName || company?.name || 'My Company'}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Admin Console Button (for dual roles) */}
                        {showAdminButton && (
                            <button
                                onClick={() => navigate('/admin/dashboard')}
                                className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors flex items-center gap-2"
                            >
                                <Shield size={16} />
                                Admin Console
                            </button>
                        )}

                        {/* Date */}
                        <div className="hidden md:flex flex-col items-end mr-4">
                            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
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

                {/* Main Content Area */}
                <main className="flex-1 overflow-hidden bg-gray-50 dark:bg-gray-900 transition-colors duration-200 relative">
                    <Outlet context={{
                        selectedDepartment: selectedDept || { _id: 'dummy', name: 'Loading...' }
                    }} />
                </main>
            </div>
        </div>
    );
};

export default ManagerLayout;
