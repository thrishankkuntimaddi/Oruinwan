
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, Users, Settings,
    Globe, LogOut, Building, BarChart3
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';

const AdminSidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout } = useAuth();
    const { company } = useCompany();

    const menuItems = [
        { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
        { path: '/admin/departments', label: 'Departments', icon: Building },
        { path: '/admin/users', label: 'People', icon: Users },
        { path: '/admin/settings', label: 'Settings', icon: Settings },
    ];

    const isActive = (path) => location.pathname === path;

    return (
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col z-20 shadow-lg shadow-indigo-100/20 h-screen sticky top-0">
            <div className="h-20 flex items-center px-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <img
                        src="/chttrix-logo.jpg"
                        alt="Chttrix Logo"
                        className="w-10 h-10 rounded-xl shadow-md object-cover"
                    />
                    <div className="flex flex-col justify-center">
                        <span className="font-black text-2xl leading-none text-slate-800 tracking-tighter">
                            Chttrix
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] leading-tight mt-1 ml-0.5">
                            Company Admin
                        </span>
                    </div>
                </div>
            </div>

            <div className="p-4 flex-1">
                <div className="space-y-1">
                    {menuItems.map(item => (
                        <button
                            key={item.path}
                            onClick={() => navigate(item.path)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${isActive(item.path)
                                    ? 'bg-indigo-50 text-indigo-600 shadow-sm translate-x-1'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                        >
                            <item.icon size={20} className={isActive(item.path) ? 'stroke-2' : 'stroke-1.5'} />
                            {item.label}
                        </button>
                    ))}
                </div>

                <div className="mt-8 pt-8 border-t border-slate-100">
                    <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Workspace</p>
                    <button
                        onClick={() => navigate('/workspaces')}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    >
                        <Globe size={18} /> Go to App
                    </button>
                </div>
            </div>

            <div className="p-4 border-t border-slate-100">
                <div className="flex items-center gap-3 px-4 py-2">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500 text-xs">
                        {company?.name?.charAt(0) || 'C'}
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-bold truncate text-slate-800">{company?.name || 'Company'}</p>
                        <p className="text-xs text-slate-400 truncate">Admin Console</p>
                    </div>
                    <button onClick={logout} className="text-slate-400 hover:text-red-500 transition-colors">
                        <LogOut size={16} />
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default AdminSidebar;
