
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, Users, Settings,
    Globe, LogOut, Building, BarChart3, ChevronUp, User
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';

const AdminSidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();
    const { company } = useCompany();
    const [showUserMenu, setShowUserMenu] = useState(false);

    const menuItems = [
        { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
        { path: '/admin/departments', label: 'Departments', icon: Building },
        { path: '/admin/users', label: 'People', icon: Users },
        { path: '/admin/settings', label: 'Settings', icon: Settings },
    ];

    const isActive = (path) => location.pathname === path;

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

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

            {/* User Profile Section with Dropdown */}
            <div className="p-4 border-t border-slate-100 relative">
                {/* Dropdown Menu */}
                {showUserMenu && (
                    <div className="absolute bottom-full left-4 right-4 mb-2 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                        <div className="p-3 bg-slate-50 border-b border-slate-100">
                            <p className="text-xs font-bold text-slate-500">Account</p>
                        </div>
                        <button
                            onClick={() => {
                                setShowUserMenu(false);
                                navigate('/admin/profile');
                            }}
                            className="w-full px-4 py-3 text-left text-sm hover:bg-slate-50 transition-colors flex items-center gap-3"
                        >
                            <User size={16} className="text-slate-400" />
                            <div>
                                <div className="font-medium text-slate-900">My Profile</div>
                                <div className="text-xs text-slate-500">{user?.email}</div>
                            </div>
                        </button>
                        <div className="border-t border-slate-100"></div>
                        <button
                            onClick={() => {
                                setShowUserMenu(false);
                                handleLogout();
                            }}
                            className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-3"
                        >
                            <LogOut size={16} />
                            <span className="font-medium">Logout</span>
                        </button>
                    </div>
                )}

                {/* User Info Button */}
                <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="w-full flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors"
                >
                    <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-600 text-sm">
                        {user?.username?.charAt(0)?.toUpperCase() || 'K'}
                    </div>
                    <div className="flex-1 overflow-hidden text-left">
                        <p className="text-sm font-bold truncate text-slate-800">{user?.username || 'KT'}</p>
                        <p className="text-xs text-slate-400 truncate">Admin Console</p>
                    </div>
                    <ChevronUp size={16} className={`text-slate-400 transition-transform ${showUserMenu ? '' : 'rotate-180'}`} />
                </button>
            </div>
        </aside>
    );
};

export default AdminSidebar;
