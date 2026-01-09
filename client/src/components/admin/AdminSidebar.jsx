
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Globe, LogOut, Building, BarChart3, ChevronUp, User, HelpCircle, UserPlus, Shield, LayoutDashboard, Users, Settings
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const AdminSidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();
    // const { company } = useCompany(); // Not strictly needed here if we move company name to top bar, but good for context if needed later.
    const [showUserMenu, setShowUserMenu] = useState(false);

    // const isOwner = user?.companyRole === 'owner'; // REMOVED: Owner has their own sidebar now

    const navGroups = [
        {
            group: 'OVERVIEW',
            items: [
                { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
                { path: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
            ]
        },
        {
            group: 'ORGANIZATION',
            items: [
                { path: '/admin/departments', label: 'Departments', icon: Building },
                { path: '/admin/workspaces', label: 'Workspaces', icon: Globe },
                { path: '/admin/users', label: 'People', icon: Users },
                { path: '/admin/onboard', label: 'Onboard', icon: UserPlus },
            ]
        },
        {
            group: 'SYSTEM',
            items: [
                { path: '/admin/security', label: 'Audit & Security', icon: Shield },
                { path: '/admin/settings', label: 'Settings', icon: Settings },
                { path: '/manager/dashboard/overview', label: 'Cross Visibility', icon: LayoutDashboard }, // Link to manager console
                { path: '/contact-admin', label: 'Contact Admin', icon: HelpCircle },
                { path: '/workspaces', label: 'Go to App', icon: Globe },
            ]
        }
    ];

    const isActive = (path) => location.pathname === path;

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col z-20 shadow-lg shadow-indigo-100/20 dark:shadow-none h-screen sticky top-0 transition-colors duration-200">
            {/* Header - Simplified */}
            <div className="h-20 flex items-center gap-3 px-6 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
                <img
                    src="/chttrix-logo.jpg"
                    alt="Chttrix Logo"
                    className="w-10 h-10 rounded-xl shadow-md object-cover flex-shrink-0"
                />
                <div className="flex flex-col justify-center min-w-0">
                    <span className="font-black text-xl leading-none text-slate-800 dark:text-white tracking-tighter">
                        Chttrix
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest leading-tight mt-1">
                        Company Admin
                    </span>
                </div>
            </div>

            {/* Grouped Navigation */}
            <nav className="flex-1 overflow-y-auto px-4 py-6 scrollbar-hide">
                <div className="space-y-8">
                    {navGroups.map((group) => (
                        <div key={group.group}>
                            <h3 className="px-4 text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                                {group.group}
                            </h3>
                            <div className="space-y-1">
                                {group.items.map((item) => {
                                    const active = isActive(item.path);
                                    return (
                                        <button
                                            key={item.path}
                                            onClick={() => navigate(item.path)}
                                            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-all duration-200 ${active
                                                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold shadow-sm translate-x-1'
                                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200 font-medium'
                                                }`}
                                        >
                                            <item.icon size={18} className={active ? 'stroke-2' : 'stroke-[1.5]'} />
                                            <span className="text-sm">{item.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </nav>

            {/* User Profile Section with Dropdown */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 relative bg-white dark:bg-gray-800">
                {/* Dropdown Menu */}
                {showUserMenu && (
                    <div className="absolute bottom-full left-4 right-4 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                            <p className="text-xs font-bold text-gray-500 dark:text-gray-400">Account</p>
                        </div>
                        <button
                            onClick={() => {
                                setShowUserMenu(false);
                                navigate('/admin/profile');
                            }}
                            className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
                        >
                            <User size={16} className="text-gray-400" />
                            <span className="font-medium">My Profile</span>
                        </button>
                        <div className="border-t border-gray-100 dark:border-gray-700"></div>
                        <button
                            onClick={() => {
                                setShowUserMenu(false);
                                handleLogout();
                            }}
                            className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors flex items-center gap-3"
                        >
                            <LogOut size={16} />
                            <span className="font-medium">Logout</span>
                        </button>
                    </div>
                )}

                {/* User Info Button */}
                <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all ${showUserMenu ? 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-700' : ''}`}
                >
                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-400 text-sm shadow-sm border-2 border-white dark:border-gray-600">
                        {user?.username?.charAt(0)?.toUpperCase() || 'A'}
                    </div>
                    <div className="flex-1 overflow-hidden text-left">
                        <p className="text-sm font-bold truncate text-gray-900 dark:text-white">{user?.username}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate capitalize">Admin Console</p>
                    </div>
                    <ChevronUp size={16} className={`text-gray-400 transition-transform duration-200 ${showUserMenu ? '' : 'rotate-180'}`} />
                </button>
            </div>
        </aside>
    );
};

export default AdminSidebar;
