import React from 'react';
import {
    LayoutDashboard, Users, CheckSquare,
    FileText, Globe, LogOut
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { useNavigate, useLocation } from 'react-router-dom';

const ManagerSidebar = () => {
    const navigate = useNavigate();
    const { logout, user } = useAuth();
    const { company } = useCompany();
    const location = useLocation();

    // Check if path is active (ends with the id or is the exact path)
    const isActive = (path) => {
        if (path === 'overview' && location.pathname === '/manager/dashboard') return true;
        return location.pathname.includes(path);
    };

    const menuItems = [
        { id: 'overview', path: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'allocation', path: 'allocation', label: 'Team Allocation', icon: Users },
        { id: 'tasks', path: 'tasks', label: 'Task Master', icon: CheckSquare },
        { id: 'reports', path: 'reports', label: 'Reports', icon: FileText },
        { id: 'settings', path: 'settings', label: 'Settings', icon: Users },
    ];

    return (
        <aside className="w-64 bg-white dark:bg-gray-800 border-r border-slate-200 dark:border-gray-700 flex flex-col z-20 shadow-lg shadow-indigo-100/20 dark:shadow-none h-screen sticky top-0 transition-colors duration-200">
            <div className="h-20 flex items-center px-6 border-b border-slate-100 dark:border-gray-700 bg-white dark:bg-gray-800">
                <div className="flex items-center gap-3">
                    <img
                        src="/chttrix-logo.jpg"
                        alt="Chttrix Logo"
                        className="w-10 h-10 rounded-xl shadow-md object-cover"
                    />
                    <div className="flex flex-col justify-center">
                        <span className="font-black text-2xl leading-none text-slate-800 dark:text-white tracking-tighter">
                            Chttrix
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-[0.2em] leading-tight mt-1 ml-0.5">
                            Manager
                        </span>
                    </div>
                </div>
            </div>

            <div className="p-4 flex-1 overflow-y-auto bg-white dark:bg-gray-800">
                <div className="space-y-1">
                    {menuItems.map(item => {
                        const active = isActive(item.path);
                        return (
                            <button
                                key={item.id}
                                onClick={() => navigate(item.path === 'overview' ? '/manager/dashboard/overview' : `/manager/dashboard/${item.path}`)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${active
                                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 shadow-sm translate-x-1'
                                    : 'text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700/50 hover:text-slate-900 dark:hover:text-gray-200'
                                    }`}
                            >
                                <item.icon size={20} className={active ? 'stroke-2' : 'stroke-1.5'} />
                                {item.label}
                            </button>
                        );
                    })}
                </div>

                <div className="mt-8 pt-8 border-t border-slate-100 dark:border-gray-700">
                    <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Workspace</p>
                    <button
                        onClick={() => navigate('/workspaces')}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    >
                        <Globe size={18} /> Go to App
                    </button>
                </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-gray-700">
                <div className="flex items-center gap-3 px-4 py-2">
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-gray-700 flex items-center justify-center font-bold text-slate-500 dark:text-gray-400 text-xs">
                        {user?.username?.charAt(0) || 'M'}
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-bold truncate text-slate-800 dark:text-white">{user?.username || 'Manager'}</p>
                        <p className="text-xs text-slate-400 dark:text-gray-500 truncate">Manager Console</p>
                    </div>
                    <button onClick={logout} className="text-slate-400 dark:text-gray-500 hover:text-red-500 transition-colors">
                        <LogOut size={16} />
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default ManagerSidebar;
