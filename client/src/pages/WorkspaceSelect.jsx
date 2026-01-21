
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Rocket, Briefcase, Zap, Palette, Microscope, Globe,
    Shield, TrendingUp, Lightbulb, Flame, Target, Trophy,
    Plus, LogOut, ArrowRight, User, CircleHelp, X,
    BookOpen, Command, Bug, Sparkles, Search, MessageCircle, Settings,
    CheckCircle2, AlertCircle, Check
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
    const [termsAccepted, setTermsAccepted] = useState(false);
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
        setTermsAccepted(false);
        setAddMembersLater(false);
        setCreateData({ name: "", adminName: "", icon: "rocket", color: "#4f46e5", rules: "", invites: "" });
    };

    const handleCreateSubmit = async (e) => {
        e.preventDefault();

        if (!createData.name.trim()) return setNameError("Workspace name is required");

        try {
            // ============ E2EE: INITIALIZE WORKSPACE KEYS (PASSWORD-FREE) ============
            console.log('🔐 [CreateWorkspace] Initializing E2EE workspace keys (no password needed)...');

            let workspaceKeyData = null;

            try {
                // Dynamically import the workspace key initialization service
                const { initializeWorkspaceKeys } =
                    await import('../services/workspaceKeyInit');

                // Generate workspace keys automatically (NO PASSWORD NEEDED!)
                workspaceKeyData = await initializeWorkspaceKeys();

                console.log('✅ [CreateWorkspace] Workspace keys initialized automatically');
            } catch (keyInitError) {
                console.error('❌ [CreateWorkspace] Failed to initialize workspace keys:', keyInitError);
                alert(`Failed to initialize workspace encryption: ${keyInitError.message}\n\nWorkspace creation canceled.`);
                return;
            }
            // =========================================================

            // 1. Create Workspace (with E2EE keys)
            const res = await api.post('/api/workspaces', {
                name: createData.name,
                icon: createData.icon,
                color: createData.color,
                rules: createData.rules,
                // E2EE: Include encrypted workspace key
                e2eeEnabled: true,
                encryptedWorkspaceKey: workspaceKeyData.encryptedKey,
                workspaceKeyIv: workspaceKeyData.keyIv,
                workspaceKeySalt: workspaceKeyData.pbkdf2Salt
            });

            const newWorkspaceId = res.data.workspace.id;
            const defaultChannels = res.data.workspace.defaultChannels; // [generalId, announcementsId]
            console.log('✅ [CreateWorkspace] Workspace created:', newWorkspaceId);
            console.log('🔐 [CreateWorkspace] Default channels:', defaultChannels);

            // ============ E2EE: GENERATE CONVERSATION KEYS FOR DEFAULT CHANNELS ============
            // CRITICAL: Without this, users can't send messages in #general or #announcements
            try {
                const conversationKeyService = (await import('../services/conversationKeyService')).default;

                if (defaultChannels && defaultChannels.length >= 2) {
                    // Generate key for #general
                    console.log('🔐 [CreateWorkspace] Generating conversation key for #general...');
                    const generalKeyData = await conversationKeyService.createAndDistributeConversationKey([user.id]);
                    await conversationKeyService.storeConversationKeysOnServer(
                        defaultChannels[0], // generalChannelId
                        'channel',
                        newWorkspaceId,
                        generalKeyData.encryptedKeys
                    );
                    console.log('✅ [CreateWorkspace] Generated conversation key for #general');

                    // Generate key for #announcements
                    console.log('🔐 [CreateWorkspace] Generating conversation key for #announcements...');
                    const announcementsKeyData = await conversationKeyService.createAndDistributeConversationKey([user.id]);
                    await conversationKeyService.storeConversationKeysOnServer(
                        defaultChannels[1], // announcementsChannelId
                        'channel',
                        newWorkspaceId,
                        announcementsKeyData.encryptedKeys
                    );
                    console.log('✅ [CreateWorkspace] Generated conversation key for #announcements');
                } else {
                    console.warn('⚠️ [CreateWorkspace] Default channels not found in response!');
                }
            } catch (e2eeChannelsError) {
                console.error('❌ [CreateWorkspace] Failed to generate conversation keys for default channels:', e2eeChannelsError);
                alert(`Warning: Failed to initialize encryption for default channels.\n\nYou may not be able to send messages until you create a new channel.`);
            }
            // ===============================================================================

            // ============ E2EE: AUTO-ENROLL CREATOR (PASSWORD-FREE) ============
            try {
                const { enrollCreatorInWorkspace } = await import('../services/workspaceKeyInit');
                await enrollCreatorInWorkspace(newWorkspaceId, workspaceKeyData);
                console.log('✅ [CreateWorkspace] Creator auto-enrolled in workspace (no password needed)');
            } catch (enrollError) {
                console.error('❌ [CreateWorkspace] Failed to auto-enroll creator:', enrollError);
                // Non-blocking: Creator can still use the workspace
            }
            // ===================================================

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
            } else {
                setNameError('Failed to create workspace. Please try again.');
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
                            onClick={() => navigate('/settings', { state: { from: '/workspaces' } })}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="Settings"
                        >
                            <Settings size={18} />
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

            {/* Create Modal - Multi-Step Wizard (Redesigned) */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadeIn">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[80vh] min-h-[600px] rounded-3xl shadow-2xl overflow-hidden animate-scaleIn flex flex-col md:flex-row border border-slate-200 dark:border-slate-800">

                        {/* Sidebar Steps (Left) */}
                        <div className="w-full md:w-64 bg-slate-50/80 dark:bg-slate-950/50 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between backdrop-blur-sm">
                            <div>
                                <h3 className="font-bold text-xl text-slate-800 dark:text-white mb-8 px-2 flex items-center gap-2">
                                    <Rocket className="text-indigo-600" />
                                    <span>New Workspace</span>
                                </h3>

                                <div className="space-y-2">
                                    {[
                                        { step: 1, label: "Basics", desc: "Name & Icon" },
                                        { step: 2, label: "Branding", desc: "Colors & Theme" },
                                        { step: 3, label: "Admin", desc: "Review Owner" },
                                        { step: 4, label: "Members", desc: "Invite Team" }
                                    ].map((s) => (
                                        <button
                                            key={s.step}
                                            onClick={() => createStep > s.step && setCreateStep(s.step)}
                                            disabled={createStep < s.step}
                                            className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${createStep === s.step
                                                ? 'bg-white dark:bg-slate-800 shadow-lg shadow-indigo-500/5 border border-indigo-100 dark:border-indigo-900'
                                                : createStep > s.step
                                                    ? 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                                    : 'opacity-50 cursor-not-allowed text-slate-400'
                                                }`}
                                        >
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all ${createStep === s.step
                                                ? 'bg-indigo-600 text-white'
                                                : createStep > s.step
                                                    ? 'bg-green-500 text-white'
                                                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                                                }`}>
                                                {createStep > s.step ? <CheckCircle2 size={16} /> : s.step}
                                            </div>
                                            <div>
                                                <div className={`text-sm font-bold ${createStep === s.step ? 'text-indigo-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                                                    {s.label}
                                                </div>
                                                <div className="text-xs text-slate-500 dark:text-slate-500">
                                                    {s.desc}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-200 dark:border-slate-800 hidden md:block">
                                <button
                                    onClick={resetCreateModal}
                                    className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors px-2"
                                >
                                    <X size={16} /> Cancel Creation
                                </button>
                            </div>
                        </div>

                        {/* Content Area (Right) */}
                        <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 relative">
                            {/* Close button for mobile */}
                            <button
                                onClick={resetCreateModal}
                                className="absolute top-4 right-4 md:hidden p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500"
                            >
                                <X size={20} />
                            </button>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-10">
                                <form id="create-workspace-form" onSubmit={handleCreateSubmit} className="max-w-3xl mx-auto h-full flex flex-col justify-center">

                                    {/* Step 1: Basics */}
                                    {createStep === 1 && (
                                        <div className="space-y-8 animate-fadeIn">
                                            <div className="mb-6">
                                                <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Let's build your HQ</h2>
                                                <p className="text-slate-500 dark:text-slate-400 text-lg">Give your workspace a distinct identity.</p>
                                            </div>

                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                                <div className="space-y-6">
                                                    <div>
                                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Workspace Name</label>
                                                        <input
                                                            type="text"
                                                            autoFocus
                                                            placeholder="e.g. Acme Corp, Engineering Team"
                                                            value={createData.name}
                                                            onChange={(e) => {
                                                                setCreateData({ ...createData, name: e.target.value });
                                                                setNameError("");
                                                            }}
                                                            className={`w-full px-5 py-4 bg-slate-50 dark:bg-slate-950/50 border ${nameError ? 'border-red-300 focus:border-red-500 ring-4 ring-red-500/10' : 'border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'} rounded-2xl focus:outline-none transition-all text-lg font-medium text-slate-900 dark:text-white`}
                                                        />
                                                        {nameError && <p className="mt-2 text-xs font-bold text-red-500 animate-pulse flex items-center gap-1"><AlertCircle size={12} /> {nameError}</p>}
                                                    </div>

                                                    <div>
                                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Description (Optional)</label>
                                                        <textarea
                                                            placeholder="What's this workspace for? Share your mission or guidelines."
                                                            value={createData.rules || ""}
                                                            onChange={(e) => setCreateData({ ...createData, rules: e.target.value })}
                                                            className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium h-32 resize-none text-slate-700 dark:text-slate-200"
                                                        ></textarea>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Choose an Icon</label>
                                                    <div className="grid grid-cols-4 gap-3">
                                                        {['rocket', 'briefcase', 'zap', 'palette', 'globe', 'trophy', 'target', 'flame', 'microscope', 'shield', 'lightbulb', 'sparkles'].map((iconName) => {
                                                            const IconCmp = getIconComponent(iconName);
                                                            return (
                                                                <button
                                                                    key={iconName}
                                                                    type="button"
                                                                    onClick={() => setCreateData({ ...createData, icon: iconName })}
                                                                    className={`aspect-square rounded-2xl border-2 transition-all flex items-center justify-center ${createData.icon === iconName
                                                                        ? 'border-indigo-600 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 shadow-md ring-4 ring-indigo-500/10'
                                                                        : 'border-slate-100 dark:border-slate-800 text-slate-400 hover:border-indigo-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                                        }`}
                                                                >
                                                                    <IconCmp size={24} />
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Step 2: Branding */}
                                    {createStep === 2 && (
                                        <div className="space-y-8 animate-fadeIn">
                                            <div className="mb-6">
                                                <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Brand your Space</h2>
                                                <p className="text-slate-500 dark:text-slate-400 text-lg">Pick a color that matches your team's vibe.</p>
                                            </div>

                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
                                                <div className="space-y-6">
                                                    <div>
                                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Preset Colors</label>
                                                        <div className="grid grid-cols-5 gap-3">
                                                            {['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#f43f5e'].map((color) => (
                                                                <button
                                                                    key={color}
                                                                    type="button"
                                                                    onClick={() => setCreateData({ ...createData, color })}
                                                                    className={`aspect-square rounded-xl flex items-center justify-center transition-all duration-300 group relative overflow-hidden ${createData.color === color ? 'ring-4 ring-offset-2 ring-indigo-500 scale-95 shadow-md' : 'hover:scale-110'}`}
                                                                    style={{ backgroundColor: color }}
                                                                >
                                                                    {createData.color === color && <Check className="text-white drop-shadow-md" size={16} strokeWidth={4} />}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Custom Color</label>
                                                        <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
                                                            <div className="relative w-12 h-12 rounded-full overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700">
                                                                <input
                                                                    type="color"
                                                                    value={createData.color}
                                                                    onChange={(e) => setCreateData({ ...createData, color: e.target.value })}
                                                                    className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 m-0 cursor-pointer"
                                                                />
                                                            </div>
                                                            <div className="flex-1">
                                                                <div className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">Pick a custom hex</div>
                                                                <input
                                                                    type="text"
                                                                    value={createData.color}
                                                                    onChange={(e) => setCreateData({ ...createData, color: e.target.value })}
                                                                    placeholder="#000000"
                                                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-600 dark:text-slate-300 uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="bg-slate-100 dark:bg-slate-950/50 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center">
                                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Live Preview</span>

                                                    {/* Workspace Card Preview */}
                                                    <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xl border border-slate-100 dark:border-slate-800 transform transition-all duration-500 hover:scale-105">
                                                        <div
                                                            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg mb-4 mx-auto transition-colors duration-300"
                                                            style={{ backgroundColor: createData.color }}
                                                        >
                                                            {React.createElement(getIconComponent(createData.icon), { size: 32 })}
                                                        </div>
                                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">{createData.name || "Workspace Name"}</h3>
                                                        <p className="text-sm text-slate-500 mb-4">Your awesome new workspace</p>
                                                        <div className="flex items-center justify-center gap-2">
                                                            <div className="flex -space-x-2">
                                                                {[1, 2, 3].map(i => (
                                                                    <div key={i} className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 dark:bg-slate-800"></div>
                                                                ))}
                                                            </div>
                                                            <span className="text-xs font-bold text-slate-400">+5 members</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Step 3: Admin */}
                                    {createStep === 3 && (
                                        <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
                                            <div className="mb-6 text-center">
                                                <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">You're in charge</h2>
                                                <p className="text-slate-500 dark:text-slate-400 text-lg">Confirming you as the Workspace Owner.</p>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                                                {/* Left Column: Profile Card */}
                                                <div className="relative group h-full">
                                                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-3xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
                                                    <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl h-full flex flex-col justify-center items-center text-center">
                                                        <div className="w-24 h-24 rounded-full mx-auto mb-4 p-1 bg-gradient-to-br from-indigo-500 to-purple-600">
                                                            <div className="w-full h-full rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                                                                {user?.profilePicture ? (
                                                                    <img src={user.profilePicture} alt="User" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <span className="text-3xl font-black text-slate-700 dark:text-slate-300">
                                                                        {user?.username?.charAt(0).toUpperCase()}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{user?.username}</h3>
                                                        <p className="text-slate-500 dark:text-slate-400 mb-6">{user?.email}</p>

                                                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full font-bold text-sm border border-indigo-100 dark:border-indigo-800">
                                                            <Shield size={16} /> Workspace Owner
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right Column: Superpowers & Terms */}
                                                <div className="flex flex-col gap-6 h-full">
                                                    <div className="p-6 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-200 dark:border-slate-800 text-left flex-1">
                                                        <h4 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                                            <Zap size={18} className="text-amber-500" /> Owner Superpowers
                                                        </h4>
                                                        <div className="grid grid-cols-1 gap-3 mb-6">
                                                            {['Manage Billings & Plans', 'Delete or Archive Workspace', 'Invite/Remove Team Members', 'Configure Integrations & API'].map((p, i) => (
                                                                <div key={i} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                                                    <CheckCircle2 size={14} className="text-green-500 shrink-0" /> {p}
                                                                </div>
                                                            ))}
                                                        </div>

                                                        <div className="pt-6 border-t border-slate-200 dark:border-slate-800 mt-auto">
                                                            <label className="flex items-start gap-3 cursor-pointer group">
                                                                <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-all shrink-0 ${termsAccepted
                                                                    ? 'bg-indigo-600 border-indigo-600 text-white'
                                                                    : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 group-hover:border-indigo-400'
                                                                    }`}>
                                                                    {termsAccepted && <Check size={14} strokeWidth={3} />}
                                                                </div>
                                                                <input
                                                                    type="checkbox"
                                                                    className="hidden"
                                                                    checked={termsAccepted}
                                                                    onChange={(e) => setTermsAccepted(e.target.checked)}
                                                                />
                                                                <div className="text-sm">
                                                                    <span className="font-bold text-slate-700 dark:text-slate-300">I accept the responsibilities of a Workspace Owner.</span>
                                                                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 leading-relaxed">
                                                                        By continuing, you acknowledge that you are the primary administrator for this workspace.
                                                                    </p>
                                                                </div>
                                                            </label>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Step 4: Members */}
                                    {createStep === 4 && (
                                        <div className="space-y-8 animate-fadeIn">
                                            <div className="mb-6">
                                                <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Gather your team</h2>
                                                <p className="text-slate-500 dark:text-slate-400 text-lg">Work is better together. Invite them now.</p>
                                            </div>

                                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                                {/* Left Column: Email Input */}
                                                <div className="lg:col-span-2 flex flex-col h-full">
                                                    <div className="flex-1 flex flex-col h-full">
                                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Email Addresses</label>
                                                        <textarea
                                                            placeholder="sarah@example.com, alex@design.co..."
                                                            value={createData.invites || ""}
                                                            onChange={(e) => setCreateData({ ...createData, invites: e.target.value })}
                                                            className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium flex-1 resize-none text-slate-700 dark:text-slate-200 font-mono text-sm min-h-[220px]"
                                                        ></textarea>
                                                        <p className="text-xs text-slate-400 mt-2">Separate multiple emails with commas.</p>
                                                    </div>
                                                </div>

                                                {/* Right Column: Skip Card */}
                                                <div className="h-full">
                                                    <div className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-900/30 h-full flex flex-col justify-center">
                                                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4">
                                                            <Rocket size={24} />
                                                        </div>
                                                        <h4 className="font-bold text-blue-900 dark:text-blue-200 mb-2">Skip for now?</h4>
                                                        <p className="text-sm text-blue-700 dark:text-blue-300/80 mb-6">You can always invite members later from workspace settings.</p>
                                                        <button
                                                            type="button"
                                                            onClick={handleCreateSubmit}
                                                            className="w-full py-3 bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-bold rounded-xl shadow-sm border border-blue-100 dark:border-blue-900/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors mt-auto"
                                                        >
                                                            Skip & Launch
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                </form>
                            </div>

                            {/* Footer Actions */}
                            <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex justify-between items-center shrink-0">
                                {createStep > 1 ? (
                                    <button
                                        onClick={() => setCreateStep(s => s - 1)}
                                        className="px-6 py-3 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                                    >
                                        Back
                                    </button>
                                ) : (
                                    <div className="w-20"></div> // Spacer
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
                                        disabled={createStep === 3 && !termsAccepted}
                                        className={`px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2 ${createStep === 3 && !termsAccepted
                                            ? 'opacity-50 cursor-not-allowed bg-slate-400 shadow-none'
                                            : 'hover:bg-indigo-700 hover:shadow-indigo-500/30 hover:-translate-y-0.5'
                                            }`}
                                    >
                                        Next Step <ArrowRight size={18} />
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleCreateSubmit}
                                        className="px-10 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-green-500/30 hover:-translate-y-0.5 transition-all flex items-center gap-2"
                                    >
                                        <Rocket size={18} /> Launch Workspace
                                    </button>
                                )}
                            </div>
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
