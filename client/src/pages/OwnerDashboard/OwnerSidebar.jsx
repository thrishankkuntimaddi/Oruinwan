import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, Users, Settings,
    Globe, LogOut, Building, Shield, Activity, CreditCard,
    UserPlus, HelpCircle, Briefcase, GitBranch, LayoutTemplate, Lock, UsersRound,
    BarChart2, ClipboardList, ShieldCheck
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';


const OwnerSidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();
    // const { company } = useCompany(); // Unused
    const [showUserMenu, setShowUserMenu] = useState(false);

    // Check if user has any workspaces to show "Go to App"
    const hasWorkspaces = user?.workspaces?.length > 0;

    const navGroups = [
        {
            group: 'OVERVIEW',
            items: [
                { path: '/owner/dashboard', label: 'Dashboard', icon: LayoutDashboard },
                { path: '/owner/analytics', label: 'Activity Health', icon: Activity },
                { path: '/owner/billing', label: 'Billing & Plan', icon: CreditCard },
                { path: '/owner/security', label: 'Security & Risk', icon: Shield },
            ]
        },
        {
            group: 'ORGANIZATION',
            items: [
                { path: '/owner/admins', label: 'Admin', icon: Shield },
                { path: '/owner/workspaces', label: 'Workspaces', icon: Briefcase },
                { path: '/owner/departments', label: 'Departments', icon: Building },
                { path: '/owner/users', label: 'People', icon: Users },
                { path: '/owner/onboard', label: 'Onboard', icon: UserPlus },
            ]
        },
        {
            group: 'COLLABORATION',
            items: [
                { path: '/owner/teams', label: 'Teams', icon: UsersRound },
                { path: '/owner/org-chart', label: 'Org Chart', icon: GitBranch },
                { path: '/owner/employees', label: 'Employees', icon: Users },
                { path: '/owner/workspace-templates', label: 'WS Templates', icon: LayoutTemplate },
                { path: '/owner/workspace-permissions', label: 'WS Permissions', icon: Lock },
            ]
        },
        {
            group: 'GOVERNANCE',
            items: [
                { path: '/owner/permission-matrix', label: 'Permission Matrix', icon: Shield },
                { path: '/owner/audit-logs', label: 'Audit Logs', icon: ClipboardList },
                { path: '/owner/compliance-logs', label: 'Compliance Logs', icon: ShieldCheck },
            ]
        },
        {
            group: 'SYSTEM',
            items: [
                { path: '/owner/settings', label: 'Settings', icon: Settings },
                { path: '/contact-admin', label: 'Contact Admin', icon: HelpCircle },
                // Conditional Go to App
                ...(hasWorkspaces ? [{ path: '/workspaces', label: 'Go to App', icon: Globe }] : [])
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
            {/* Header */}
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
                        Owner Console
                    </span>
                </div>
            </div>

            {/* Navigation */}
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

            {/* Footer / Profile */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 relative bg-white dark:bg-gray-800">
                <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                >
                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-400 text-sm shadow-sm border-2 border-white dark:border-gray-600">
                        {user?.username?.charAt(0)?.toUpperCase() || 'O'}
                    </div>
                    <div className="flex-1 overflow-hidden text-left">
                        <p className="text-sm font-bold truncate text-gray-900 dark:text-white">{user?.username}</p>
                        <p className="text-xs text-indigo-500 font-bold truncate">Workspace Owner</p>
                    </div>
                    {showUserMenu && (
                        <div className="absolute bottom-full left-4 right-4 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden z-50">
                            <button
                                onClick={handleLogout}
                                className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors flex items-center gap-3"
                            >
                                <LogOut size={16} />
                                <span className="font-medium">Logout</span>
                            </button>
                        </div>
                    )}
                </button>
            </div>
        </aside>
    );
};

export default OwnerSidebar;
