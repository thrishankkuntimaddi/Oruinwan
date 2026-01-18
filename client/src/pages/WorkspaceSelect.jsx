
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Rocket, Briefcase, Zap, Palette, Microscope, Globe,
    Shield, TrendingUp, Lightbulb, Flame, Target, Trophy,
    Plus, LogOut, ArrowRight, User, Users as UsersIcon, CircleHelp, X,
    BookOpen, Command, Bug, Sparkles, Search, MessageCircle
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";
import ProfileQuickSettings from "../components/workspace/ProfileQuickSettings";

const WorkspaceSelect = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    // ⚡ PLATFORM ADMIN REDIRECT - Platform admins should NEVER be here
    React.useEffect(() => {
        if (user?.roles?.includes('chttrix_admin')) {

            navigate('/chttrix-admin', { replace: true });
        }
        // REMOVED: Owner redirect. Owners land on dashboard on login, but can visit here via "Go to App".
    }, [user, navigate]);

    // State
    const [workspaces, setWorkspaces] = useState([]);
    const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true);
    const [loadError, setLoadError] = useState(null);

    // Help State
    const [showHelp, setShowHelp] = useState(false);
    const [activeHelpModal, setActiveHelpModal] = useState(null);

    // Profile Quick Settings State
    const [showProfile, setShowProfile] = useState(false);

    // Create Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createStep, setCreateStep] = useState(1);
    const [, setAddMembersLater] = useState(false);
    const [nameError, setNameError] = useState("");
    const [createData, setCreateData] = useState({
        name: "",
        adminName: "",
        icon: "rocket",
        color: "#4f46e5",
        rules: "",
        invites: ""
    });
    // const [isCopied, setIsCopied] = useState(false); // Unused

    // Load Workspaces
    const loadWorkspaces = React.useCallback(async () => {
        try {
            setIsLoadingWorkspaces(true);
            setLoadError(null);
            const response = await api.get('/api/workspaces/my');

            if (response.data.workspaces && response.data.workspaces.length > 0) {
                setWorkspaces(response.data.workspaces.map(ws => ({
                    id: ws.id,
                    name: ws.name,
                    members: ws.memberCount || 1,
                    icon: ws.icon || "rocket",
                    color: ws.color || "#4f46e5",
                    type: ws.type,
                    role: ws.role,
                    ownerName: ws.ownerName,
                    isOwner: ws.isOwner
                })));
            } else {
                setWorkspaces([]);
            }
            setIsLoadingWorkspaces(false);
        } catch (err) {
            console.error('❌ Error loading workspaces:', err);
            setLoadError('Failed to load workspaces');
            setIsLoadingWorkspaces(false);
        }
    }, []);

    React.useEffect(() => {
        if (user) loadWorkspaces();
    }, [user, loadWorkspaces]);

    const handleLogout = async () => {
        await logout();
        window.location.replace("/");
    };

    const handleWorkspaceClick = (workspaceId) => {
        navigate(`/workspace/${workspaceId}/home`);
    };

    // --- Create Workspace Logic ---
    const resetCreateModal = () => {
        setIsCreateModalOpen(false);
        setCreateStep(1);
        setAddMembersLater(false);
        setCreateData({ name: "", adminName: "", icon: "rocket", color: "#4f46e5", rules: "", invites: "" });
    };

    const handleCreateSubmit = async (e) => {
        e.preventDefault();

        if (!createData.name.trim()) return setNameError("Workspace name is required");

        try {
            // 1. Create Workspace
            const res = await api.post('/api/workspaces', {
                name: createData.name,
                icon: createData.icon,
                color: createData.color,
                rules: createData.rules
            });

            const newWorkspaceId = res.data.workspace.id;

            // 2. Send Invites (if any)
            if (createData.invites && createData.invites.trim()) {
                try {
                    await api.post(`/api/workspaces/${newWorkspaceId}/invite`, {
                        emails: createData.invites,
                        inviteType: 'email'
                    });
                } catch (inviteError) {
                    console.error("Failed to send invites", inviteError);
                }
            }

            await loadWorkspaces(); // Refresh list
            resetCreateModal();
            navigate(`/workspace/${newWorkspaceId}/home`);
        } catch (error) {
            console.error("Failed to create workspace", error);
            if (error.response?.data?.message) {
                setNameError(error.response.data.message);
            }
        }
    };

    // Helper to get Icon component
    const getIconComponent = (iconName) => {
        const icons = {
            rocket: Rocket, briefcase: Briefcase, zap: Zap, palette: Palette,
            microscope: Microscope, globe: Globe, shield: Shield, trendingUp: TrendingUp,
            lightbulb: Lightbulb, flame: Flame, target: Target, trophy: Trophy
        };
        return icons[iconName] || Rocket;
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans selection:bg-indigo-100 dark:selection:bg-indigo-900 selection:text-indigo-700 dark:selection:text-indigo-300">
            {/* Minimal Header */}
            <header className="fixed top-0 w-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 z-50 px-8 h-16 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <img
                        src="/chttrix-logo.jpg"
                        alt="Chttrix"
                        className="w-8 h-8 rounded-lg shadow-sm shadow-indigo-200 object-cover"
                    />
                    <span className="font-extrabold text-slate-800 dark:text-slate-100 tracking-tight text-lg">Chttrix</span>
                </div>

                <div className="flex items-center gap-4 relative">
                    <button
                        onClick={() => setShowHelp(!showHelp)}
                        className={`text-slate-400 hover:text-indigo-600 transition-colors p-2 hover:bg-slate-50 rounded-lg ${showHelp ? "bg-indigo-50 text-indigo-600" : ""}`}
                        title="Help & Resources"
                    >
                        <CircleHelp size={20} />
                    </button>

                    {/* Help Popover (The Super Thing) */}
                    {showHelp && (
                        <>
                            <div className="fixed inset-0 z-[90] cursor-default" onClick={() => setShowHelp(false)}></div>
                            <div className="absolute top-12 right-0 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-[100] overflow-hidden animate-fade-in origin-top-right">
                                {/* Unique Gradient Header */}
                                <div className="p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                                    <h3 className="font-bold text-base">Chttrix Support</h3>
                                    <p className="text-xs text-indigo-100 mt-0.5 opacity-90">We're here to help you collaborate better.</p>
                                </div>

                                {/* Search */}
                                <div className="p-3 border-b border-slate-100 dark:border-slate-700">
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Find answers..."
                                            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                        />
                                    </div>
                                </div>

                                {/* Quick Actions Grid */}
                                <div className="p-2 grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => { setShowHelp(false); setActiveHelpModal("academy"); }}
                                        className="flex flex-col items-center justify-center p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors group"
                                    >
                                        <BookOpen size={20} className="mb-1 group-hover:scale-110 transition-transform text-indigo-600" />
                                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Academy</span>
                                    </button>
                                    <button
                                        onClick={() => { setShowHelp(false); setActiveHelpModal("shortcuts"); }}
                                        className="flex flex-col items-center justify-center p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors group"
                                    >
                                        <Command size={20} className="mb-1 group-hover:scale-110 transition-transform text-slate-700" />
                                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Shortcuts</span>
                                    </button>
                                    <button
                                        onClick={() => { setShowHelp(false); setActiveHelpModal("bug"); }}
                                        className="flex flex-col items-center justify-center p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors group"
                                    >
                                        <Bug size={20} className="mb-1 group-hover:scale-110 transition-transform text-red-600" />
                                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Report Bug</span>
                                    </button>
                                    <button
                                        onClick={() => { setShowHelp(false); setActiveHelpModal("whatsnew"); }}
                                        className="flex flex-col items-center justify-center p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors group"
                                    >
                                        <Sparkles size={20} className="mb-1 group-hover:scale-110 transition-transform text-yellow-500" />
                                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">What's New</span>
                                    </button>
                                </div>

                                {/* System Status Footer */}
                                <div className="border-t border-slate-100 dark:border-slate-700 p-2 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Systems Operational</span>
                                    </div>
                                    <button
                                        onClick={() => { setShowHelp(false); setActiveHelpModal("contact"); }}
                                        className="text-xs text-indigo-600 font-bold hover:underline"
                                    >
                                        Contact Us
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Owner Console Link */}
                    {(user?.companyRole === 'owner') && (
                        <button
                            onClick={() => navigate('/owner/dashboard')}
                            className="hidden md:flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors px-3 py-2 rounded-lg hover:bg-slate-50"
                        >
                            <Shield size={16} />
                            Owner Console
                        </button>
                    )}

                    {/* Admin Console Link - Hide for Owners as they have their own dashboard */}
                    {(user?.companyRole === 'admin') && (
                        <button
                            onClick={() => navigate('/admin/dashboard')}
                            className="hidden md:flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors px-3 py-2 rounded-lg hover:bg-slate-50"
                        >
                            <Shield size={16} />
                            Admin Console
                        </button>
                    )}

                    {/* Manager Console Link - Hide for Owners */}
                    {(user?.companyRole === 'manager' || user?.companyRole === 'admin') && (
                        <button
                            onClick={() => navigate('/manager/dashboard')}
                            className="hidden md:flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors px-3 py-2 rounded-lg hover:bg-slate-50"
                        >
                            <Briefcase size={16} />
                            Manager Console
                        </button>
                    )}
                    <div className="h-6 w-px bg-slate-200 hidden md:block"></div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowProfile(true)}
                            className="text-right hidden sm:block hover:bg-slate-50 px-3 py-2 rounded-lg transition-colors"
                            title="View Profile"
                        >
                            <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{user?.username || 'User'}</div>
                            <div className="text-xs text-slate-500">{user?.email}</div>
                        </button>
                        <button
                            onClick={handleLogout}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="Sign out"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="pt-32 pb-20 px-6 max-w-7xl mx-auto">
                <div className="mb-12 text-center max-w-2xl mx-auto">
                    <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 mb-4 tracking-tight">
                        Welcome back, {user?.username?.split(' ')[0]}
                    </h1>
                    <p className="text-lg text-slate-500 dark:text-slate-400 font-medium">
                        Select a workspace to jump back in, or create a new one to get started.
                    </p>
                </div>

                {isLoadingWorkspaces ? (
                    <div className="flex justify-center py-20">
                        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : loadError ? (
                    <div className="text-center py-20">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 text-red-600 rounded-full mb-4">
                            <Shield size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Something went wrong</h3>
                        <p className="text-slate-500 mb-6">{loadError}</p>
                        <button onClick={loadWorkspaces} className="px-6 py-2 bg-slate-900 text-white rounded-lg font-bold">Try Again</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Existing Workspaces */}
                        {workspaces.map((ws) => {
                            const IconComponent = getIconComponent(ws.icon);
                            return (
                                <button
                                    key={ws.id}
                                    onClick={() => handleWorkspaceClick(ws.id)}
                                    className="group relative flex flex-col h-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 hover:shadow-xl hover:shadow-indigo-100/50 dark:hover:shadow-indigo-900/50 hover:border-indigo-200 dark:hover:border-indigo-700 hover:-translate-y-1 transition-all duration-300 text-left overflow-hidden"
                                >
                                    {/* Decorative gradient blob */}
                                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-full blur-2xl group-hover:from-indigo-100 group-hover:to-purple-100 transition-colors"></div>

                                    <div className="relative z-10 flex-1">
                                        <div
                                            className="w-14 h-14 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 mb-6"
                                            style={{ backgroundColor: ws.color }}
                                        >
                                            <IconComponent size={28} />
                                        </div>

                                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2 truncate pr-4">{ws.name}</h3>

                                        <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 font-medium">
                                            <div className="flex items-center gap-1.5">
                                                <User size={14} className="text-slate-400" />
                                                {ws.role === 'owner' ? 'Owner' : 'Member'}
                                            </div>
                                            <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                                            <div>{ws.members} member{ws.members !== 1 && 's'}</div>
                                        </div>
                                    </div>

                                    <div className="relative z-10 mt-auto flex items-center text-indigo-600 font-bold text-sm opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300">
                                        Launch Workspace <ArrowRight size={16} className="ml-2" />
                                    </div>
                                </button>
                            );
                        })}

                        {/* New Workspace Card */}
                        {(() => {
                            // Check limits: Personal users can only create 3 workspaces
                            const ownedWorkspacesCount = workspaces.filter(ws => ws.isOwner).length;
                            const isLimitReached = user?.userType === 'personal' && ownedWorkspacesCount >= 3;

                            return (
                                <button
                                    onClick={() => {
                                        if (!isLimitReached) setIsCreateModalOpen(true);
                                    }}
                                    disabled={isLimitReached}
                                    className={`group relative flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-2xl transition-all duration-300 ${isLimitReached
                                        ? 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 cursor-not-allowed opacity-70'
                                        : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20'
                                        }`}
                                >
                                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors ${isLimitReached
                                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                        : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600'
                                        }`}>
                                        {isLimitReached ? <Shield size={32} /> : <Plus size={32} />}
                                    </div>
                                    <span className={`font-bold text-lg ${isLimitReached
                                        ? 'text-slate-400 dark:text-slate-500'
                                        : 'text-slate-600 dark:text-slate-300 group-hover:text-indigo-700 dark:group-hover:text-indigo-400'
                                        }`}>
                                        {isLimitReached ? 'Plan Limit Reached' : 'Create New Workspace'}
                                    </span>
                                    <span className={`text-sm mt-1 px-4 text-center ${isLimitReached
                                        ? 'text-slate-400 dark:text-slate-600'
                                        : 'text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400'
                                        }`}>
                                        {isLimitReached
                                            ? 'You have reached the limit of 3 workspaces on the personal plan.'
                                            : 'Start a new project or team'}
                                    </span>
                                </button>
                            );
                        })()}
                    </div>
                )}
            </main>

            {/* Create Modal - Multi-Step Wizard */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-slideUp flex flex-col max-h-[90vh] border dark:border-slate-800">
                        {/* Header with Progress Steps */}
                        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-2xl text-slate-800 dark:text-white">Create Workspace</h3>
                                <button
                                    onClick={resetCreateModal}
                                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Progress Indicators */}
                            <div className="flex items-center justify-between px-2 relative">
                                {/* Connector Line */}
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-slate-200 dark:bg-slate-700 -z-10"></div>
                                <div className={`absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-indigo-500 transition-all duration-300 -z-10`} style={{ width: `${((createStep - 1) / 3) * 100}%` }}></div>

                                {[
                                    { step: 1, label: "Basics" },
                                    { step: 2, label: "Branding" },
                                    { step: 3, label: "Admin" },
                                    { step: 4, label: "Members" }
                                ].map((s) => (
                                    <div key={s.step} className="flex flex-col items-center gap-2 bg-white dark:bg-slate-900 px-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${createStep >= s.step ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                                            {createStep > s.step ? "✓" : s.step}
                                        </div>
                                        <span className={`text-xs font-bold transition-colors ${createStep >= s.step ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>{s.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            <form onSubmit={handleCreateSubmit}>
                                {/* Step 1: Basics */}
                                {createStep === 1 && (
                                    <div className="space-y-6 animate-fadeIn">
                                        <div className="text-center mb-8">
                                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Let's start with the basics</h2>
                                            <p className="text-slate-500 dark:text-slate-400">Give your workspace a name and set the ground rules.</p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Workspace Name</label>
                                            <input
                                                type="text"
                                                autoFocus
                                                placeholder="e.g. Engineering Team, Chttrix HQ"
                                                value={createData.name}
                                                onChange={(e) => {
                                                    setCreateData({ ...createData, name: e.target.value });
                                                    setNameError("");
                                                }}
                                                className={`w-full px-4 py-3 bg-white dark:bg-slate-950 border ${nameError ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-900'} rounded-xl focus:outline-none focus:ring-4 transition-all text-slate-800 dark:text-white font-medium`}
                                            />
                                            {nameError && <p className="mt-2 text-xs font-bold text-red-500 animate-pulse">{nameError}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Rules & Guidelines (Optional)</label>
                                            <div className="relative">
                                                <textarea
                                                    placeholder="Set the tone for your workspace. E.g., 'Be respectful', 'No spam', 'Updates every Friday'..."
                                                    value={createData.rules || ""}
                                                    onChange={(e) => setCreateData({ ...createData, rules: e.target.value })}
                                                    className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-200 dark:focus:ring-indigo-900 focus:border-indigo-500 transition-all text-slate-800 dark:text-white font-medium h-32 resize-none"
                                                ></textarea>
                                                <Shield className="absolute right-4 top-4 text-slate-300" size={18} />
                                            </div>
                                            <p className="text-xs text-slate-400 mt-2 px-1">These will be visible in workspace details.</p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Workspace Icon</label>
                                            <div className="flex flex-wrap gap-3">
                                                {['rocket', 'briefcase', 'zap', 'palette', 'globe', 'trophy', 'target', 'flame'].map((iconName) => {
                                                    const IconCmp = getIconComponent(iconName);
                                                    return (
                                                        <button
                                                            key={iconName}
                                                            type="button"
                                                            onClick={() => setCreateData({ ...createData, icon: iconName })}
                                                            className={`p-3 rounded-xl border-2 transition-all flex items-center justify-center ${createData.icon === iconName
                                                                ? 'border-indigo-500 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 scale-105'
                                                                : 'border-slate-100 dark:border-slate-700 text-slate-400 hover:border-indigo-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                                }`}
                                                        >
                                                            <IconCmp size={24} />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Step 2: Branding */}
                                {createStep === 2 && (
                                    <div className="space-y-8 animate-fadeIn">
                                        <div className="text-center mb-8">
                                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Make it yours</h2>
                                            <p className="text-slate-500 dark:text-slate-400">Choose a theme color that represents your team.</p>
                                        </div>

                                        <div className="grid grid-cols-4 gap-4">
                                            {['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'].map((color) => (
                                                <button
                                                    key={color}
                                                    type="button"
                                                    onClick={() => setCreateData({ ...createData, color })}
                                                    className={`aspect-square rounded-2xl flex items-center justify-center transition-all duration-300 group relative overflow-hidden ${createData.color === color ? 'ring-4 ring-offset-2 ring-indigo-500 scale-95' : 'hover:scale-105'}`}
                                                    style={{ backgroundColor: color }}
                                                >
                                                    {createData.color === color && (
                                                        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm animate-bounce">
                                                            <span className="text-white font-bold">✓</span>
                                                        </div>
                                                    )}
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                                                </button>
                                            ))}
                                        </div>

                                        {/* Preview */}
                                        <div className="mt-8 p-6 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-4 text-center">Preview</label>
                                            <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mx-auto max-w-sm">
                                                <div
                                                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg"
                                                    style={{ backgroundColor: createData.color }}
                                                >
                                                    {React.createElement(getIconComponent(createData.icon), { size: 24 })}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-900 dark:text-white">{createData.name || "Workspace Name"}</div>
                                                    <div className="text-xs text-slate-500">1 member • just now</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Step 3: Admin */}
                                {createStep === 3 && (
                                    <div className="space-y-6 animate-fadeIn">
                                        <div className="text-center mb-8">
                                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Admin Confirmation</h2>
                                            <p className="text-slate-500 dark:text-slate-400">Confirm who will manage this workspace.</p>
                                        </div>

                                        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-2xl p-6 flex flex-col items-center">
                                            <div className="w-20 h-20 rounded-full bg-indigo-100 dark:bg-indigo-800 flex items-center justify-center text-3xl mb-4 border-4 border-white dark:border-slate-800 shadow-xl relative">
                                                {user?.profilePicture ? (
                                                    <img src={user.profilePicture} alt="User" className="w-full h-full rounded-full object-cover" />
                                                ) : (
                                                    <span className="text-indigo-600 dark:text-indigo-400 font-black">
                                                        {user?.username?.charAt(0).toUpperCase()}
                                                    </span>
                                                )}
                                                <div className="absolute -bottom-1 -right-1 bg-yellow-400 p-1.5 rounded-full border-2 border-white dark:border-slate-800">
                                                    <Shield size={14} className="text-yellow-900 fill-current" />
                                                </div>
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{user?.username}</h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{user?.email}</p>

                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-100 dark:bg-indigo-800 rounded-lg">
                                                <Shield size={14} className="text-indigo-600 dark:text-indigo-400" />
                                                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">Workspace Owner</span>
                                            </div>
                                        </div>

                                        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                                            <h4 className="font-bold text-sm text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                                                <CircleHelp size={16} className="text-slate-400" />
                                                Permissions
                                            </h4>
                                            <ul className="text-sm text-slate-500 dark:text-slate-400 space-y-2 pl-6 list-disc">
                                                <li>You will have full control over workspace settings.</li>
                                                <li>You can manage members, roles, and channels.</li>
                                                <li>You can delete the workspace at any time.</li>
                                            </ul>
                                        </div>
                                    </div>
                                )}

                                {/* Step 4: Members */}
                                {createStep === 4 && (
                                    <div className="space-y-6 animate-fadeIn">
                                        <div className="text-center mb-8">
                                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Invite your team</h2>
                                            <p className="text-slate-500 dark:text-slate-400">Collaboration is better together.</p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Email Addresses</label>
                                            <textarea
                                                placeholder="Enter emails separated by commas (e.g., alex@team.com, sarah@design.co)"
                                                value={createData.invites || ""}
                                                onChange={(e) => setCreateData({ ...createData, invites: e.target.value })}
                                                className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-200 dark:focus:ring-indigo-900 focus:border-indigo-500 transition-all text-slate-800 dark:text-white font-medium h-32 resize-none"
                                            ></textarea>
                                            <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                                                <UsersIcon size={12} />
                                                We'll send them an invite link instantly.
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                                            <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-lg text-blue-600 dark:text-blue-300">
                                                <Rocket size={20} />
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="text-sm font-bold text-blue-900 dark:text-blue-300">Skip for now?</h4>
                                                <p className="text-xs text-blue-700 dark:text-blue-400">You can always add members later from workspace settings.</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </form>
                        </div>

                        {/* Footer / Actions */}
                        <div className="px-8 py-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur flex justify-between items-center">
                            {createStep > 1 ? (
                                <button
                                    onClick={() => setCreateStep(s => s - 1)}
                                    className="px-6 py-2.5 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                                >
                                    Back
                                </button>
                            ) : (
                                <button
                                    onClick={resetCreateModal}
                                    className="px-6 py-2.5 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                            )}

                            {createStep < 4 ? (
                                <button
                                    onClick={() => {
                                        if (createStep === 1 && !createData.name.trim()) {
                                            setNameError("Workspace name is required");
                                            return;
                                        }
                                        setCreateStep(s => s + 1);
                                    }}
                                    className="px-8 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transform hover:-translate-y-0.5 flex items-center gap-2"
                                >
                                    Next Step <ArrowRight size={16} />
                                </button>
                            ) : (
                                <button
                                    onClick={handleCreateSubmit}
                                    className="px-8 py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-all shadow-lg shadow-green-200 hover:shadow-green-300 transform hover:-translate-y-0.5 flex items-center gap-2"
                                >
                                    <Rocket size={18} />
                                    Launch Workspace
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Help Modals (Detailed Content) */}
            {activeHelpModal && (
                <div className="fixed inset-0 bg-slate-900/40 z-[120] flex items-center justify-center animate-fade-in backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col relative animate-slideUp">
                        <button
                            onClick={() => setActiveHelpModal(null)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 z-10"
                        >
                            <X size={24} />
                        </button>

                        {activeHelpModal === "academy" && (
                            <>
                                <div className="p-6 bg-indigo-600 text-white">
                                    <h2 className="text-2xl font-bold flex items-center gap-2"><BookOpen size={28} /> Chttrix Academy</h2>
                                    <p className="text-indigo-100 mt-1">Master your workflow with these guides.</p>
                                </div>
                                <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
                                    <a
                                        href="/chttrix-docs"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block p-4 border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg hover:border-indigo-400 dark:hover:border-indigo-500 cursor-pointer transition-all group"
                                    >
                                        <h3 className="font-bold text-indigo-700 dark:text-indigo-300 group-hover:underline flex items-center justify-between">
                                            <span>Full Documentation</span>
                                            <ArrowRight size={16} />
                                        </h3>
                                        <p className="text-sm text-indigo-600/80 dark:text-indigo-300/80 mt-1">Explore all features, settings, and guides in detail.</p>
                                    </a>

                                    {["Getting Started Guide", "Advanced Search Techniques", "Managing Notifications", "Integrations 101"].map((guide, i) => (
                                        <div key={i} className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-indigo-900/10 cursor-pointer transition-all group">
                                            <h3 className="font-bold text-slate-800 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-400">{guide}</h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Learn the basics and become a pro user in no time.</p>
                                        </div>
                                    ))}
                                </div>
                            </>

                        )}

                        {activeHelpModal === "shortcuts" && (
                            <>
                                <div className="p-6 bg-slate-900 text-white">
                                    <h2 className="text-2xl font-bold flex items-center gap-2"><Command size={28} /> Keyboard Shortcuts</h2>
                                    <p className="text-slate-400 mt-1">Speed up your workflow.</p>
                                </div>
                                <div className="p-6 overflow-y-auto max-h-[60vh]">
                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                            <span className="text-slate-600 dark:text-slate-300 font-medium">Quick Search</span>
                                            <kbd className="px-2 py-1 bg-white dark:bg-slate-800 rounded text-xs font-mono text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-600 shadow-sm">Cmd + K</kbd>
                                        </div>
                                        <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                            <span className="text-slate-600 dark:text-slate-300 font-medium">New Message</span>
                                            <kbd className="px-2 py-1 bg-white dark:bg-slate-800 rounded text-xs font-mono text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-600 shadow-sm">Cmd + N</kbd>
                                        </div>
                                        <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                            <span className="text-slate-600 dark:text-slate-300 font-medium">Toggle AI</span>
                                            <kbd className="px-2 py-1 bg-white dark:bg-slate-800 rounded text-xs font-mono text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-600 shadow-sm">Cmd + J</kbd>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {activeHelpModal === "bug" && (
                            <>
                                <div className="p-6 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/30">
                                    <h2 className="text-2xl font-bold text-red-700 dark:text-red-400 flex items-center gap-2"><Bug size={28} /> Report a Bug</h2>
                                    <p className="text-red-600 dark:text-red-300 mt-1">Found something broken? Let us know.</p>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">What happened?</label>
                                        <textarea className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl focus:ring-red-500 focus:border-red-500 h-32 resize-none" placeholder="Describe the issue..."></textarea>
                                    </div>
                                    <button className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200">
                                        Submit Report
                                    </button>
                                </div>
                            </>
                        )}

                        {activeHelpModal === "whatsnew" && (
                            <>
                                <div className="p-6 bg-gradient-to-r from-pink-500 to-orange-500 text-white">
                                    <h2 className="text-2xl font-bold flex items-center gap-2"><Sparkles size={28} /> What's New</h2>
                                    <p className="text-white/90 mt-1">Latest updates and improvements.</p>
                                </div>
                                <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
                                    <div className="relative pl-4 border-l-2 border-slate-200 dark:border-slate-700">
                                        <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-pink-500"></div>
                                        <span className="text-xs font-bold text-pink-500 uppercase">Nov 2025</span>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">Chttrix AI 2.0</h3>
                                        <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Smarter responses, faster generation, and context-aware suggestions.</p>
                                    </div>
                                    <div className="relative pl-4 border-l-2 border-slate-200 dark:border-slate-700">
                                        <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-orange-500"></div>
                                        <span className="text-xs font-bold text-orange-500 uppercase">Oct 2025</span>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">Dark Mode Beta</h3>
                                        <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Easy on the eyes. Try it out in settings.</p>
                                    </div>
                                </div>
                            </>
                        )}
                        {activeHelpModal === "contact" && (
                            <>
                                <div className="p-6 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/30">
                                    <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-300 flex items-center gap-2"><MessageCircle size={28} /> Contact Support</h2>
                                    <p className="text-blue-700 dark:text-blue-400 mt-1">We're here to help with any questions.</p>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Subject</label>
                                        <select className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-white rounded-xl focus:ring-blue-500 focus:border-blue-500 font-medium">
                                            <option>General Inquiry</option>
                                            <option>Billing Issue</option>
                                            <option>Technical Support</option>
                                            <option>Enterprise Sales</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Message</label>
                                        <textarea className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-white rounded-xl focus:ring-blue-500 focus:border-blue-500 h-32 resize-none" placeholder="How can we help you?"></textarea>
                                    </div>
                                    <button className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
                                        Send Message
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Profile Quick Settings Modal */}
            {showProfile && <ProfileQuickSettings onClose={() => setShowProfile(false)} />}
        </div>
    );
};

export default WorkspaceSelect;
