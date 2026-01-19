import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { Home, MessageSquare, CheckSquare, FileText, Newspaper, Hash, Rocket, Briefcase, Zap, Palette, Microscope, Globe, Shield, TrendingUp, Lightbulb, Flame, Target, Trophy, Video } from "lucide-react";

const IconSidebar = ({ onProfileClick }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const { workspaces, activeWorkspace, setActiveWorkspace } = useWorkspace();

    // ✅ CORRECT: Use WorkspaceContext as single source of truth
    // IconSidebar is not always a direct child of route with :workspaceId
    const workspaceId = activeWorkspace?.id;

    const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
    const menuRef = useRef(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowWorkspaceMenu(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const isActive = (itemPath) => {
        if (!workspaceId) return false;

        const path = location.pathname;

        // Home highlighting: active for /home or /home/... (home-nested routes)
        if (itemPath === "/home") {
            return path.includes(`/workspace/${workspaceId}/home`);
        }

        // Channels highlighting: active for /channels or /channel/:id
        if (itemPath === "/channels") {
            return path.includes(`/workspace/${workspaceId}/channels`) ||
                path.includes(`/workspace/${workspaceId}/channel/`);
        }

        // Messages highlighting: active for /messages or /dm/:id
        // Note: we exclude /home/dm paths because they belong to the Home icon
        if (itemPath === "/messages") {
            return (path.includes(`/workspace/${workspaceId}/messages`) ||
                path.includes(`/workspace/${workspaceId}/dm/`)) &&
                !path.includes("/home/");
        }

        // Default prefix matching for other items
        const fullPath = `/workspace/${workspaceId}${itemPath}`;
        return path === fullPath || path.startsWith(fullPath + "/");
    };

    const navItems = [
        { icon: <Home size={20} strokeWidth={2} />, path: "/home", label: "Home" },
        { icon: <Hash size={20} strokeWidth={2} />, path: "/channels", label: "Channels" },
        { icon: <MessageSquare size={20} strokeWidth={2} />, path: "/messages", label: "Messages" },
        { icon: <CheckSquare size={20} strokeWidth={2} />, path: "/tasks", label: "Tasks" },
        { icon: <FileText size={20} strokeWidth={2} />, path: "/notes", label: "Notes" },
        { icon: <Video size={20} strokeWidth={2} />, path: "/huddles", label: "Huddles" },
        // Only show Updates for company users
        ...(user?.userType === "company" ? [
            { icon: <Newspaper size={20} strokeWidth={2} />, path: "/updates", label: "Updates" }
        ] : []),

        // Admin Dashboard Link
        ...((['owner', 'admin'].includes(user?.companyRole) || user?.isCoOwner) ? [
            { icon: <Shield size={20} strokeWidth={2} />, path: "/admin/analytics", label: "Admin", absolute: true }
        ] : []),

        // Manager Dashboard Link
        ...((user?.companyRole === 'manager' || (user?.managedDepartments && user.managedDepartments.length > 0)) ? [
            { icon: <Briefcase size={20} strokeWidth={2} />, path: "/manager/dashboard/overview", label: "Manager", absolute: true }
        ] : []),
    ];

    return (
        <div className="w-[70px] bg-white dark:bg-gray-900 flex flex-col items-center py-4 border-r border-gray-200 dark:border-gray-800 z-20 shadow-sm">
            {/* Top Space */}
            <div className="h-2"></div>

            {/* Workspace Switcher */}
            <div className="relative mb-6" ref={menuRef}>
                <button
                    onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
                    style={{ backgroundColor: activeWorkspace?.color || '#2563eb' }}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xl cursor-pointer hover:opacity-90 transition-opacity shadow-sm relative"
                >
                    {(() => {
                        // Icon mapping for Lucide components
                        const iconMap = {
                            'rocket': <Rocket size={20} />,
                            'briefcase': <Briefcase size={20} />,
                            'zap': <Zap size={20} />,
                            'palette': <Palette size={20} />,
                            'microscope': <Microscope size={20} />,
                            'globe': <Globe size={20} />,
                            'shield': <Shield size={20} />,
                            'trend': <TrendingUp size={20} />,
                            'bulb': <Lightbulb size={20} />,
                            'flame': <Flame size={20} />,
                            'target': <Target size={20} />,
                            'trophy': <Trophy size={20} />
                        };
                        const icon = activeWorkspace?.icon || 'rocket';
                        return iconMap[icon] || iconMap['rocket'];
                    })()}
                    <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 border border-gray-200">
                        <svg className="w-2 h-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                </button>

                {/* Dropdown Menu */}
                {showWorkspaceMenu && (
                    <div className="absolute left-14 top-0 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-[100] overflow-hidden animate-fade-in">
                        <div className="p-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                            <button
                                onClick={() => navigate("/workspaces")}
                                className="w-full text-left text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center group"
                            >
                                <span>Manage Workspaces</span>
                                <span className="ml-auto group-hover:translate-x-1 transition-transform">→</span>
                            </button>
                        </div>
                        <div className="py-2">
                            <div className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Switch to</div>
                            {workspaces.map(ws => (
                                <button
                                    key={ws.id}
                                    onClick={() => {
                                        setActiveWorkspace(ws);
                                        setShowWorkspaceMenu(false);
                                        navigate(`/workspace/${ws.id}/home`);
                                    }}
                                    className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-3 transition-colors"
                                >
                                    <div
                                        style={{ backgroundColor: ws.color || '#2563eb' }}
                                        className="w-6 h-6 rounded text-white flex items-center justify-center text-xs font-bold"
                                    >
                                        {(() => {
                                            const iconMap = {
                                                'rocket': <Rocket size={14} />,
                                                'briefcase': <Briefcase size={14} />,
                                                'zap': <Zap size={14} />,
                                                'palette': <Palette size={14} />,
                                                'microscope': <Microscope size={14} />,
                                                'globe': <Globe size={14} />,
                                                'shield': <Shield size={14} />,
                                                'trend': <TrendingUp size={14} />,
                                                'bulb': <Lightbulb size={14} />,
                                                'flame': <Flame size={14} />,
                                                'target': <Target size={14} />,
                                                'trophy': <Trophy size={14} />
                                            };
                                            return iconMap[ws.icon] || iconMap['rocket'];
                                        })()}
                                    </div>
                                    <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{ws.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Nav Icons */}
            <div className="flex-1 flex flex-col space-y-4 w-full items-center">
                {navItems.map((item) => {
                    const targetPath = item.absolute
                        ? item.path
                        : (workspaceId
                            ? `/workspace/${workspaceId}${item.path}`
                            : '/workspaces');

                    return (
                        <div key={item.path} className="relative group">
                            <button
                                onClick={() => navigate(targetPath)}
                                className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${isActive(item.path)
                                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200"
                                    }`}
                            >
                                {item.icon}
                            </button>
                            {/* Tooltip */}
                            <div className="absolute left-14 top-1/2 -translate-y-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-lg">
                                {item.label}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Profile Icon */}
            <div className="mt-auto">
                <button onClick={onProfileClick} className="relative group">
                    <div
                        className="w-10 h-10 rounded-full bg-cover bg-center border-2 border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500 transition-all shadow-sm"
                        style={{
                            backgroundImage: `url(${user?.profilePicture || "https://ui-avatars.com/api/?name=" + (user?.username || "User")})`,
                        }}
                    />
                    <div className={`absolute w-3 h-3 rounded-full bottom-0 right-0 border-2 border-white dark:border-gray-900 ${user?.userStatus === "away" ? "bg-yellow-500" :
                        user?.userStatus === "dnd" ? "bg-red-500" :
                            "bg-green-500"
                        }`}></div>
                </button>
            </div>
        </div>
    );
};

export default IconSidebar;
