
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Rocket, Briefcase, Zap, Palette, Microscope, Globe,
    Shield, TrendingUp, Lightbulb, Flame, Target, Trophy,
    Plus, LogOut, LayoutGrid, ArrowRight, User, CircleHelp, X,
    BookOpen, Command, Bug, Sparkles, Search, MessageCircle
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";

const WorkspaceSelect = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    // State
    const [workspaces, setWorkspaces] = useState([]);
    const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true);
    const [loadError, setLoadError] = useState(null);

    // Help State
    const [showHelp, setShowHelp] = useState(false);
    const [activeHelpModal, setActiveHelpModal] = useState(null);

    // Create Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createStep, setCreateStep] = useState(1);
    const [addMembersLater, setAddMembersLater] = useState(false);
    const [nameError, setNameError] = useState("");
    const [createData, setCreateData] = useState({
        name: "",
        adminName: "",
        icon: "rocket",
        color: "#4f46e5",
        invites: ""
    });
    const [isCopied, setIsCopied] = useState(false);

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
        setCreateData({ name: "", adminName: "", icon: "rocket", color: "#4f46e5", invites: "" });
    };

    const handleCreateSubmit = async (e) => {
        e.preventDefault();

        if (!createData.name.trim()) return setNameError("Workspace name is required");

        try {
            const res = await api.post('/api/workspaces', {
                name: createData.name,
                icon: createData.icon,
                color: createData.color
            });
            await loadWorkspaces(); // Refresh list
            resetCreateModal();
            navigate(`/workspace/${res.data.workspace.id}/home`);
        } catch (error) {
            console.error("Failed to create workspace", error);
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
        <div className="min-h-screen bg-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-700">
            {/* Minimal Header */}
            <header className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-slate-200 z-50 px-8 h-16 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <img
                        src="/chttrix-logo.jpg"
                        alt="Chttrix"
                        className="w-8 h-8 rounded-lg shadow-sm shadow-indigo-200 object-cover"
                    />
                    <span className="font-extrabold text-slate-800 tracking-tight text-lg">Chttrix</span>
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
                            <div className="absolute top-12 right-0 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-[100] overflow-hidden animate-fade-in origin-top-right">
                                {/* Unique Gradient Header */}
                                <div className="p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                                    <h3 className="font-bold text-base">Chttrix Support</h3>
                                    <p className="text-xs text-indigo-100 mt-0.5 opacity-90">We're here to help you collaborate better.</p>
                                </div>

                                {/* Search */}
                                <div className="p-3 border-b border-slate-100">
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Find answers..."
                                            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                        />
                                    </div>
                                </div>

                                {/* Quick Actions Grid */}
                                <div className="p-2 grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => { setShowHelp(false); setActiveHelpModal("academy"); }}
                                        className="flex flex-col items-center justify-center p-2 hover:bg-indigo-50 rounded-lg transition-colors group"
                                    >
                                        <BookOpen size={20} className="mb-1 group-hover:scale-110 transition-transform text-indigo-600" />
                                        <span className="text-xs font-medium text-slate-700">Academy</span>
                                    </button>
                                    <button
                                        onClick={() => { setShowHelp(false); setActiveHelpModal("shortcuts"); }}
                                        className="flex flex-col items-center justify-center p-2 hover:bg-indigo-50 rounded-lg transition-colors group"
                                    >
                                        <Command size={20} className="mb-1 group-hover:scale-110 transition-transform text-slate-700" />
                                        <span className="text-xs font-medium text-slate-700">Shortcuts</span>
                                    </button>
                                    <button
                                        onClick={() => { setShowHelp(false); setActiveHelpModal("bug"); }}
                                        className="flex flex-col items-center justify-center p-2 hover:bg-indigo-50 rounded-lg transition-colors group"
                                    >
                                        <Bug size={20} className="mb-1 group-hover:scale-110 transition-transform text-red-600" />
                                        <span className="text-xs font-medium text-slate-700">Report Bug</span>
                                    </button>
                                    <button
                                        onClick={() => { setShowHelp(false); setActiveHelpModal("whatsnew"); }}
                                        className="flex flex-col items-center justify-center p-2 hover:bg-indigo-50 rounded-lg transition-colors group"
                                    >
                                        <Sparkles size={20} className="mb-1 group-hover:scale-110 transition-transform text-yellow-500" />
                                        <span className="text-xs font-medium text-slate-700">What's New</span>
                                    </button>
                                </div>

                                {/* System Status Footer */}
                                <div className="border-t border-slate-100 p-2 bg-slate-50 flex items-center justify-between">
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

                    {(user?.companyRole === 'admin' || user?.companyRole === 'owner') && (
                        <button
                            onClick={() => navigate('/admin/dashboard')}
                            className="hidden md:flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors px-3 py-2 rounded-lg hover:bg-slate-50"
                        >
                            <Shield size={16} />
                            Admin Console
                        </button>
                    )}

                    {(user?.companyRole === 'manager' || user?.companyRole === 'admin' || user?.companyRole === 'owner') && (
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
                        <div className="text-right hidden sm:block">
                            <div className="text-sm font-bold text-slate-800">{user?.username || 'User'}</div>
                            <div className="text-xs text-slate-500">{user?.email}</div>
                        </div>
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
                    <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">
                        Welcome back, {user?.username?.split(' ')[0]}
                    </h1>
                    <p className="text-lg text-slate-500 font-medium">
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
                                    className="group relative flex flex-col h-64 bg-white border border-slate-200 rounded-2xl p-8 hover:shadow-xl hover:shadow-indigo-100/50 hover:border-indigo-200 hover:-translate-y-1 transition-all duration-300 text-left overflow-hidden"
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

                                        <h3 className="text-xl font-bold text-slate-800 mb-2 truncate pr-4">{ws.name}</h3>

                                        <div className="flex items-center gap-4 text-sm text-slate-500 font-medium">
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
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="group relative flex flex-col items-center justify-center h-64 border-2 border-dashed border-slate-300 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50/50 transition-all duration-300"
                        >
                            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors mb-4">
                                <Plus size={32} />
                            </div>
                            <span className="font-bold text-slate-600 group-hover:text-indigo-700 text-lg">Create New Workspace</span>
                            <span className="text-sm text-slate-400 group-hover:text-indigo-500 mt-1">Start a new project or team</span>
                        </button>
                    </div>
                )}
            </main>

            {/* Create Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-slideUp">
                        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="font-bold text-xl text-slate-800">Create Workspace</h3>
                            <button
                                onClick={resetCreateModal}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <Plus size={24} className="rotate-45" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateSubmit} className="p-8">
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Workspace Name</label>
                                    <input
                                        type="text"
                                        autoFocus
                                        placeholder="e.g. Engineering Team, Project Alpha"
                                        value={createData.name}
                                        onChange={(e) => {
                                            setCreateData({ ...createData, name: e.target.value });
                                            setNameError("");
                                        }}
                                        className={`w-full px-4 py-3 bg-white border ${nameError ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-200'} rounded-xl focus:outline-none focus:ring-4 transition-all text-slate-800 font-medium`}
                                    />
                                    {nameError && <p className="mt-2 text-xs font-bold text-red-500">{nameError}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Theme Color</label>
                                    <div className="flex gap-3">
                                        {['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map((color) => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => setCreateData({ ...createData, color })}
                                                className={`w-8 h-8 rounded-full border-2 transition-all ${createData.color === color ? 'border-slate-800 scale-110' : 'border-transparent hover:scale-105'}`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={resetCreateModal}
                                    className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transform hover:-translate-y-0.5"
                                >
                                    Create Workspace
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Help Modals (Detailed Content) */}
            {activeHelpModal && (
                <div className="fixed inset-0 bg-slate-900/40 z-[120] flex items-center justify-center animate-fade-in backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col relative animate-slideUp">
                        <button
                            onClick={() => setActiveHelpModal(null)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 z-10"
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
                                    {["Getting Started Guide", "Advanced Search Techniques", "Managing Notifications", "Integrations 101"].map((guide, i) => (
                                        <div key={i} className="p-4 border border-slate-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 cursor-pointer transition-all group">
                                            <h3 className="font-bold text-slate-800 group-hover:text-indigo-700">{guide}</h3>
                                            <p className="text-sm text-slate-500 mt-1">Learn the basics and become a pro user in no time.</p>
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
                                        <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                                            <span className="text-slate-600 font-medium">Quick Search</span>
                                            <kbd className="px-2 py-1 bg-white rounded text-xs font-mono text-slate-500 border border-slate-300 shadow-sm">Cmd + K</kbd>
                                        </div>
                                        <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                                            <span className="text-slate-600 font-medium">New Message</span>
                                            <kbd className="px-2 py-1 bg-white rounded text-xs font-mono text-slate-500 border border-slate-300 shadow-sm">Cmd + N</kbd>
                                        </div>
                                        <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                                            <span className="text-slate-600 font-medium">Toggle AI</span>
                                            <kbd className="px-2 py-1 bg-white rounded text-xs font-mono text-slate-500 border border-slate-300 shadow-sm">Cmd + J</kbd>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {activeHelpModal === "bug" && (
                            <>
                                <div className="p-6 bg-red-50 border-b border-red-100">
                                    <h2 className="text-2xl font-bold text-red-700 flex items-center gap-2"><Bug size={28} /> Report a Bug</h2>
                                    <p className="text-red-600 mt-1">Found something broken? Let us know.</p>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">What happened?</label>
                                        <textarea className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-red-500 focus:border-red-500 h-32 resize-none" placeholder="Describe the issue..."></textarea>
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
                                    <div className="relative pl-4 border-l-2 border-slate-200">
                                        <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-pink-500"></div>
                                        <span className="text-xs font-bold text-pink-500 uppercase">Nov 2025</span>
                                        <h3 className="text-lg font-bold text-slate-900 mt-1">Chttrix AI 2.0</h3>
                                        <p className="text-slate-600 text-sm mt-1">Smarter responses, faster generation, and context-aware suggestions.</p>
                                    </div>
                                    <div className="relative pl-4 border-l-2 border-slate-200">
                                        <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-orange-500"></div>
                                        <span className="text-xs font-bold text-orange-500 uppercase">Oct 2025</span>
                                        <h3 className="text-lg font-bold text-slate-900 mt-1">Dark Mode Beta</h3>
                                        <p className="text-slate-600 text-sm mt-1">Easy on the eyes. Try it out in settings.</p>
                                    </div>
                                </div>
                            </>
                        )}
                        {activeHelpModal === "contact" && (
                            <>
                                <div className="p-6 bg-blue-50 border-b border-blue-100">
                                    <h2 className="text-2xl font-bold text-blue-900 flex items-center gap-2"><MessageCircle size={28} /> Contact Support</h2>
                                    <p className="text-blue-700 mt-1">We're here to help with any questions.</p>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Subject</label>
                                        <select className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 font-medium text-slate-700">
                                            <option>General Inquiry</option>
                                            <option>Billing Issue</option>
                                            <option>Technical Support</option>
                                            <option>Enterprise Sales</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Message</label>
                                        <textarea className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 h-32 resize-none" placeholder="How can we help you?"></textarea>
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
        </div>
    );
};

export default WorkspaceSelect;
