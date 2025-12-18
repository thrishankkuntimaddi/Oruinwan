import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { Home, MessageSquare, CheckSquare, FileText, Newspaper, Hash } from "lucide-react";

const IconSidebar = ({ onProfileClick }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { workspaceId } = useParams();
    const { user } = useAuth();
    const { workspaces, activeWorkspace, setActiveWorkspace } = useWorkspace();

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

    const isActive = (basePath) => {
        if (!workspaceId) return false;
        const fullPath = `/workspace/${workspaceId}${basePath}`;
        return location.pathname === fullPath || location.pathname.startsWith(fullPath + "/");
    };

    const navItems = [
        { icon: <Home size={20} strokeWidth={2} />, path: "/home", label: "Home" },
        { icon: <Hash size={20} strokeWidth={2} />, path: "/channels", label: "Channels" },
        { icon: <MessageSquare size={20} strokeWidth={2} />, path: "/messages", label: "Messages" },
        { icon: <CheckSquare size={20} strokeWidth={2} />, path: "/tasks", label: "Tasks" },
        { icon: <FileText size={20} strokeWidth={2} />, path: "/notes", label: "Notes" },
        { icon: <Newspaper size={20} strokeWidth={2} />, path: "/updates", label: "Updates" },
    ];

    return (
        <div className="w-[70px] bg-white flex flex-col items-center py-4 border-r border-gray-200 z-20 shadow-sm">
            {/* Top Space */}
            <div className="h-2"></div>

            {/* Workspace Switcher */}
            <div className="relative mb-6" ref={menuRef}>
                <button
                    onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
                    style={{ backgroundColor: activeWorkspace?.color || '#2563eb' }}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xl cursor-pointer hover:opacity-90 transition-opacity shadow-sm relative"
                >
                    {activeWorkspace?.icon || '🚀'}
                    <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 border border-gray-200">
                        <svg className="w-2 h-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                </button>

                {/* Dropdown Menu */}
                {showWorkspaceMenu && (
                    <div className="absolute left-14 top-0 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-[100] overflow-hidden animate-fade-in">
                        <div className="p-3 border-b border-gray-100 bg-gray-50">
                            <button
                                onClick={() => navigate("/workspaces")}
                                className="w-full text-left text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center group"
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
                                    className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                                >
                                    <div
                                        style={{ backgroundColor: ws.color || '#2563eb' }}
                                        className="w-6 h-6 rounded text-white flex items-center justify-center text-xs font-bold"
                                    >
                                        {ws.icon || '🚀'}
                                    </div>
                                    <span className="text-sm text-gray-700 font-medium">{ws.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Nav Icons */}
            <div className="flex-1 flex flex-col space-y-4 w-full items-center">
                {navItems.map((item) => {
                    const targetPath = workspaceId
                        ? `/workspace/${workspaceId}${item.path}`
                        : '/workspaces'; // Fallback to workspace selection if no workspace

                    return (
                        <div key={item.path} className="relative group">
                            <button
                                onClick={() => navigate(targetPath)}
                                className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${isActive(item.path)
                                    ? "bg-blue-50 text-blue-600"
                                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
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
                        className="w-10 h-10 rounded-full bg-cover bg-center border-2 border-gray-100 hover:border-gray-300 transition-all shadow-sm"
                        style={{
                            backgroundImage: `url(${user?.profilePicture || "https://ui-avatars.com/api/?name=" + (user?.username || "User")})`,
                        }}
                    />
                    <div className="absolute w-3 h-3 bg-green-500 rounded-full bottom-0 right-0 border-2 border-white"></div>
                </button>
            </div>
        </div>
    );
};

export default IconSidebar;
