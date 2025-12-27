import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Rocket, Briefcase, Zap, Palette, Microscope, Globe,
    Shield, TrendingUp, Lightbulb, Flame, Target, Trophy
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";

const WorkspaceSelect = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [showHelp, setShowHelp] = useState(false);
    const [activeHelpModal, setActiveHelpModal] = useState(null);

    const handleLogout = async () => {
        await logout();
        window.location.replace("/login");
    };

    const [workspaces, setWorkspaces] = useState([]);
    const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true);
    const [loadError, setLoadError] = useState(null);

    const loadWorkspaces = React.useCallback(async () => {
        try {
            setIsLoadingWorkspaces(true);
            setLoadError(null);

            console.log('🔍 Loading workspaces with automatic token refresh...');

            // ✅ Use shared API service - token refresh is handled automatically!
            const response = await api.get('/api/workspaces/my');

            console.log('📋 Workspaces loaded:', response.data);

            if (response.data.workspaces && response.data.workspaces.length > 0) {
                console.log('🎨 DEBUG - First workspace color:', response.data.workspaces[0]?.color);
                console.log('🎨 DEBUG - First workspace full data:', response.data.workspaces[0]);
                console.log('👤 DEBUG - Owner name:', response.data.workspaces[0]?.ownerName);
                console.log('✅ DEBUG - Is owner:', response.data.workspaces[0]?.isOwner);

                setWorkspaces(response.data.workspaces.map(ws => {
                    console.log(`📊 Workspace "${ws.name}": ownerName=${ws.ownerName}, isOwner=${ws.isOwner}`);
                    return {
                        id: ws.id,
                        name: ws.name,
                        members: ws.memberCount || 1,
                        icon: ws.icon || "rocket",
                        color: ws.color || "#4f46e5",
                        type: ws.type,
                        role: ws.role,
                        ownerName: ws.ownerName,  // ✅ Add owner name
                        isOwner: ws.isOwner  // ✅ Add owner flag
                    };
                }));
            } else {
                setWorkspaces([]);
            }

            setIsLoadingWorkspaces(false);
        } catch (err) {
            console.error('❌ Error loading workspaces:', err);
            setLoadError(err.response?.data?.message || err.message || 'Failed to load workspaces');
            setIsLoadingWorkspaces(false);
        }
    }, []);

    // Load workspaces once when component mounts or when user/token changes
    React.useEffect(() => {
        if (user) {
            loadWorkspaces();
        }
    }, [user, loadWorkspaces]);

    // Create Workspace Wizard State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createStep, setCreateStep] = useState(1);
    const [addMembersLater, setAddMembersLater] = useState(false);
    const [nameError, setNameError] = useState("");  // ✅ Add name validation error
    const [createData, setCreateData] = useState({
        name: "",
        adminName: "",
        icon: "🚀",
        color: "#2563eb",
        invites: ""
    });

    const [isCopied, setIsCopied] = useState(false);

    const resetCreateModal = () => {
        setIsCreateModalOpen(false);
        setCreateStep(1);
        setAddMembersLater(false);
        setIsCopied(false);
        setNameError("");  // ✅ Reset name error
        setCreateData({
            name: "",
            adminName: "",
            icon: "rocket",
            color: "#2563eb",
            invites: ""
        });
    };

    const handleCreateOpen = () => {
        setIsCreateModalOpen(true);
        setCreateStep(1);
        setIsCopied(false);
        // Pre-fill admin name with logged-in username
        setCreateData({
            name: "",
            adminName: user?.username || "",
            icon: "rocket",
            color: "#2563eb",
            invites: ""
        });
    };

    const handleNextStep = () => {
        if (createStep === 2) {
            if (!createData.name.trim() || !createData.adminName.trim() || nameError) return;
        }
        setCreateStep(prev => prev + 1);
    };

    const handlePrevStep = () => {
        setCreateStep(prev => prev - 1);
    };

    const handleFinalCreate = async () => {
        try {
            console.log('🚀 Creating workspace with data:', {
                name: createData.name,
                icon: createData.icon,
                color: createData.color
            });

            // ✅ Create workspace via API service - token refresh is automatic!
            const response = await api.post('/api/workspaces', {
                name: createData.name,
                icon: createData.icon,
                color: createData.color,
                companyId: null // Personal workspace
            });

            console.log('✅ Workspace created:', response.data);

            // Store current workspace
            localStorage.setItem("currentWorkspace", response.data.workspace.id);

            // If user wants to send invites
            if (createData.invites.trim() && !addMembersLater) {
                try {
                    console.log('📧 Sending invites to:', createData.invites);
                    await api.post(`/api/workspaces/${response.data.workspace.id}/invite`, {
                        emails: createData.invites,
                        inviteType: 'email',
                        role: 'member'
                    });
                    console.log('✅ Invites sent');
                } catch (inviteErr) {
                    console.error('⚠️ Failed to send invites:', inviteErr);
                    // Don't block workspace creation if invites fail
                }
            }

            // Redirect to workspace home
            console.log('✅ Redirecting to workspace home:', response.data.workspace.id);
            resetCreateModal();
            navigate(`/workspace/${response.data.workspace.id}/home`);
        } catch (err) {
            console.error('❌ Create workspace error:', err);
            console.error('📋 Full error object:', err.response);
            console.error('💬 Error message:', err.response?.data?.message);

            const errorMessage = err.response?.data?.message || err.message || 'Failed to create workspace';
            console.log('🔍 Extracted error message:', errorMessage);

            // ✅ If it's a duplicate name error, show it inline (no alert popup)
            if (errorMessage.toLowerCase().includes('already exists') ||
                errorMessage.toLowerCase().includes('workspace name')) {
                console.log('✅ Showing inline error for duplicate name');
                setNameError(errorMessage);
                setCreateStep(2); // Go back to step 2 where the name field is
            } else {
                console.log('⚠️ Other error type:', errorMessage);
                // For other errors, you might want to show a toast notification
                // For now, we'll set it as a name error too
                setNameError(errorMessage);
                setCreateStep(2);
            }
        }
    };



    const copyInviteLink = () => {
        navigator.clipboard.writeText(`https://chttrix.com/join/${createData.name.toLowerCase().replace(/\s+/g, '-')}`);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 3000);
    };

    const handleLaunch = (ws) => {
        console.log('🚀 Launching workspace:', ws);
        localStorage.setItem("currentWorkspace", ws.id);
        navigate(`/workspace/${ws.id}/home`);
    };

    // Note: Delete workspace functionality moved to workspace settings

    // Lucide Icons Import
    // Note: In a real project you'd import these at the top. 
    // For this tool execution, I will assume they are available if I was importing them at file level. 
    // However, since I am editing the function body here, I cannot add top-level imports easily without replacing the whole file header.
    // I will use another tool call to add imports.

    // Professional Lucide Icons
    const icons = [
        { id: 'rocket', component: <Rocket />, label: 'Rocket' },
        { id: 'briefcase', component: <Briefcase />, label: 'Briefcase' },
        { id: 'zap', component: <Zap />, label: 'Zap' },
        { id: 'palette', component: <Palette />, label: 'Palette' },
        { id: 'microscope', component: <Microscope />, label: 'Microscope' },
        { id: 'globe', component: <Globe />, label: 'Globe' },
        { id: 'shield', component: <Shield />, label: 'Shield' },
        { id: 'trend', component: <TrendingUp />, label: 'Trending' },
        { id: 'bulb', component: <Lightbulb />, label: 'Bulb' },
        { id: 'flame', component: <Flame />, label: 'Flame' },
        { id: 'target', component: <Target />, label: 'Target' },
        { id: 'trophy', component: <Trophy />, label: 'Trophy' }
    ];
    const presetColors = ["#2563eb", "#9333ea", "#db2777", "#16a34a", "#ea580c", "#4f46e5", "#0891b2", "#be123c"];

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-6 relative">
            {/* Logo */}
            <div
                onClick={() => navigate("/features")}
                className="absolute top-6 left-6 flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-opacity"
            >
                <img src="/assets/ChttrixLogo.svg" alt="Chttrix Logo" className="w-8 h-8 rounded-lg object-cover contrast-125 saturate-110 shadow-sm" />
                <span className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Chttrix</span>
            </div>

            {/* Top Right Actions */}
            <div className="absolute top-6 right-6 flex items-center space-x-6 z-50">
                <div className="relative">
                    <button
                        onClick={() => setShowHelp(!showHelp)}
                        className={`text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium text-sm transition-colors flex items-center ${showHelp ? "text-blue-600 dark:text-blue-400" : ""}`}
                    >
                        Help
                    </button>
                    {/* Help Popover */}
                    {showHelp && (
                        <>
                            <div className="fixed inset-0 z-[90]" onClick={() => setShowHelp(false)}></div>
                            <div className="absolute top-10 right-0 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-[100] overflow-hidden animate-fade-in origin-top-right text-left">
                                {/* Unique Gradient Header */}
                                <div className="p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                                    <h3 className="font-bold text-base">Chttrix Support</h3>
                                    <p className="text-[10px] text-indigo-100 mt-0.5 opacity-90">We're here to help you collaborate better.</p>
                                </div>

                                {/* Search */}
                                <div className="p-3 border-b border-gray-100 dark:border-gray-700">
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">🔍</span>
                                        <input
                                            type="text"
                                            placeholder="Find answers..."
                                            className="w-full pl-7 pr-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all dark:placeholder-gray-400"
                                        />
                                    </div>
                                </div>

                                {/* Quick Actions Grid */}
                                <div className="p-2 grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => { setShowHelp(false); setActiveHelpModal("academy"); }}
                                        className="flex flex-col items-center justify-center p-2 hover:bg-indigo-50 dark:hover:bg-gray-700 rounded-lg transition-colors group"
                                    >
                                        <span className="text-xl mb-1 group-hover:scale-110 transition-transform">🎓</span>
                                        <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300">Academy</span>
                                    </button>
                                    <button
                                        onClick={() => { setShowHelp(false); setActiveHelpModal("shortcuts"); }}
                                        className="flex flex-col items-center justify-center p-2 hover:bg-indigo-50 dark:hover:bg-gray-700 rounded-lg transition-colors group"
                                    >
                                        <span className="text-xl mb-1 group-hover:scale-110 transition-transform">⌨️</span>
                                        <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300">Shortcuts</span>
                                    </button>
                                    <button
                                        onClick={() => { setShowHelp(false); setActiveHelpModal("bug"); }}
                                        className="flex flex-col items-center justify-center p-2 hover:bg-indigo-50 dark:hover:bg-gray-700 rounded-lg transition-colors group"
                                    >
                                        <span className="text-xl mb-1 group-hover:scale-110 transition-transform">🐛</span>
                                        <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300">Report Bug</span>
                                    </button>
                                    <button
                                        onClick={() => { setShowHelp(false); setActiveHelpModal("whatsnew"); }}
                                        className="flex flex-col items-center justify-center p-2 hover:bg-indigo-50 dark:hover:bg-gray-700 rounded-lg transition-colors group"
                                    >
                                        <span className="text-xl mb-1 group-hover:scale-110 transition-transform">✨</span>
                                        <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300">What's New</span>
                                    </button>
                                </div>

                                {/* System Status Footer */}
                                <div className="border-t border-gray-100 dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                        </span>
                                        <span className="text-[9px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">All Systems Operational</span>
                                    </div>
                                    <button
                                        onClick={() => { setShowHelp(false); setActiveHelpModal("contact"); }}
                                        className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
                                    >
                                        Contact Us
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <button
                    onClick={handleLogout}
                    className="text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-500 font-medium text-sm transition-colors flex items-center"
                >
                    Sign Out <span className="ml-2">→</span>
                </button>
            </div>

            {/* Help Modals */}
            {activeHelpModal && (
                <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center animate-fade-in backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-[600px] max-h-[80vh] overflow-hidden flex flex-col relative text-left border border-gray-200 dark:border-gray-800">
                        <button
                            onClick={() => setActiveHelpModal(null)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>

                        {activeHelpModal === "academy" && (
                            <>
                                <div className="p-6 bg-indigo-600 dark:bg-indigo-700 text-white">
                                    <h2 className="text-2xl font-bold flex items-center gap-2">🎓 Chttrix Academy</h2>
                                    <p className="text-indigo-100 mt-1">Master your workflow with these guides.</p>
                                </div>
                                <div className="p-6 overflow-y-auto space-y-4">
                                    {["Getting Started Guide", "Advanced Search Techniques", "Managing Notifications", "Integrations 101"].map((guide, i) => (
                                        <div key={i} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer transition-all group">
                                            <h3 className="font-bold text-gray-800 dark:text-gray-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-400">{guide}</h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Learn the basics and become a pro user in no time.</p>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {activeHelpModal === "shortcuts" && (
                            <>
                                <div className="p-6 bg-gray-900 dark:bg-black text-white">
                                    <h2 className="text-2xl font-bold flex items-center gap-2">⌨️ Keyboard Shortcuts</h2>
                                    <p className="text-gray-400 mt-1">Speed up your workflow.</p>
                                </div>
                                <div className="p-6 overflow-y-auto">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex justify-between items-center p-2 border-b border-gray-100 dark:border-gray-700">
                                            <span className="text-gray-600 dark:text-gray-300">Quick Search</span>
                                            <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600">Cmd + K</kbd>
                                        </div>
                                        <div className="flex justify-between items-center p-2 border-b border-gray-100 dark:border-gray-700">
                                            <span className="text-gray-600 dark:text-gray-300">New Message</span>
                                            <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600">Cmd + N</kbd>
                                        </div>
                                        <div className="flex justify-between items-center p-2 border-b border-gray-100 dark:border-gray-700">
                                            <span className="text-gray-600 dark:text-gray-300">Toggle AI</span>
                                            <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600">Cmd + J</kbd>
                                        </div>
                                        <div className="flex justify-between items-center p-2 border-b border-gray-100 dark:border-gray-700">
                                            <span className="text-gray-600 dark:text-gray-300">Close Window</span>
                                            <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600">Esc</kbd>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {activeHelpModal === "bug" && (
                            <>
                                <div className="p-6 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-800">
                                    <h2 className="text-2xl font-bold text-red-700 dark:text-red-400 flex items-center gap-2">🐛 Report a Bug</h2>
                                    <p className="text-red-600 dark:text-red-300 mt-1">Found something broken? Let us know.</p>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">What happened?</label>
                                        <textarea className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-red-500 focus:border-red-500 h-32 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" placeholder="Describe the issue..."></textarea>
                                    </div>
                                    <button className="w-full py-2 bg-red-600 text-white rounded-md font-bold hover:bg-red-700 transition-colors">
                                        Submit Report
                                    </button>
                                </div>
                            </>
                        )}

                        {activeHelpModal === "whatsnew" && (
                            <>
                                <div className="p-6 bg-gradient-to-r from-pink-500 to-orange-500 text-white">
                                    <h2 className="text-2xl font-bold flex items-center gap-2">✨ What's New</h2>
                                    <p className="text-white/90 mt-1">Latest updates and improvements.</p>
                                </div>
                                <div className="p-6 overflow-y-auto space-y-6">
                                    <div className="relative pl-4 border-l-2 border-gray-200">
                                        <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-pink-500"></div>
                                        <span className="text-xs font-bold text-pink-500 uppercase">Nov 2025</span>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-1">Chttrix AI 2.0</h3>
                                        <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">Smarter responses, faster generation, and context-aware suggestions.</p>
                                    </div>
                                    <div className="relative pl-4 border-l-2 border-gray-200">
                                        <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-orange-500"></div>
                                        <span className="text-xs font-bold text-orange-500 uppercase">Oct 2025</span>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-1">Dark Mode Beta</h3>
                                        <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">Easy on the eyes. Try it out in settings.</p>
                                    </div>
                                </div>
                            </>
                        )}
                        {activeHelpModal === "contact" && (
                            <>
                                <div className="p-6 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800">
                                    <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-300 flex items-center gap-2">📞 Contact Support</h2>
                                    <p className="text-blue-700 dark:text-blue-400 mt-1">We're here to help with any questions.</p>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject</label>
                                        <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                                            <option>General Inquiry</option>
                                            <option>Billing Issue</option>
                                            <option>Technical Support</option>
                                            <option>Enterprise Sales</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message</label>
                                        <textarea className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 h-32 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" placeholder="How can we help you?"></textarea>
                                    </div>
                                    <button className="w-full py-2 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700 transition-colors">
                                        Send Message
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Create Workspace Wizard Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center animate-fade-in backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-[550px] overflow-hidden flex flex-col relative transition-all border border-gray-200 dark:border-gray-700">

                        {/* Progress Bar */}
                        <div className="h-1.5 bg-gray-100 dark:bg-gray-700 w-full">
                            <div
                                className="h-full bg-blue-600 transition-all duration-500 ease-out"
                                style={{ width: `${(createStep / 3) * 100}%` }}
                            ></div>
                        </div>

                        {/* Close Button */}
                        <button
                            onClick={resetCreateModal}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 z-10 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>

                        {/* Step 1: Intro / Confirmation */}
                        {createStep === 1 && (
                            <div className="p-10 text-center flex flex-col items-center animate-fade-in">
                                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 mb-6">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Create a New Workspace</h2>
                                <p className="text-gray-600 dark:text-gray-300 mb-8 leading-relaxed max-w-sm">
                                    Build a home for your team. A dedicated place to share ideas, discuss projects, and get work done together.
                                    <br /><br />
                                    <span className="text-sm font-medium text-blue-600">Professional • Secure • Organized</span>
                                </p>
                                <button
                                    onClick={handleNextStep}
                                    className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm transition-all w-full max-w-xs"
                                >
                                    Start Setup
                                </button>
                            </div>
                        )}

                        {/* Step 2: Details */}
                        {createStep === 2 && (
                            <div className="p-8 animate-fade-in">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Workspace Details</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Customize your workspace identity.</p>

                                <div className="space-y-5">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Workspace Name</label>
                                        <input
                                            type="text"
                                            value={createData.name}
                                            onChange={(e) => {
                                                const newName = e.target.value;
                                                setCreateData({ ...createData, name: newName });

                                                // ✅ Check for duplicate name in user's owned workspaces
                                                if (newName.trim()) {
                                                    const duplicate = workspaces.find(ws =>
                                                        ws.name.toLowerCase() === newName.trim().toLowerCase() &&
                                                        ws.isOwner
                                                    );
                                                    if (duplicate) {
                                                        setNameError("Workspace name already exists in your account");
                                                    } else {
                                                        setNameError("");
                                                    }
                                                } else {
                                                    setNameError("");
                                                }
                                            }}
                                            className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border ${nameError ? 'border-red-300' : 'border-gray-200 dark:border-gray-600'} rounded-xl text-gray-900 dark:text-white focus:outline-none focus:bg-white dark:focus:bg-gray-800 focus:ring-2 ${nameError ? 'focus:ring-red-500/20 focus:border-red-500' : 'focus:ring-blue-500/20 focus:border-blue-500'} transition-all`}
                                            placeholder="e.g. Chttrix Corp"
                                            autoFocus
                                        />
                                        {nameError && (
                                            <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                {nameError}
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Admin Name</label>
                                        <input
                                            type="text"
                                            value={createData.adminName}
                                            onChange={(e) => setCreateData({ ...createData, adminName: e.target.value })}
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                            placeholder={user?.username || "Your Name"}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Choose Icon & Color</label>
                                        <div className="flex gap-6 items-start">
                                            {/* Left: Preview */}
                                            <div className="shrink-0">
                                                <div
                                                    className="w-24 h-24 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl transition-all duration-300"
                                                    style={{ backgroundColor: createData.color }}
                                                >
                                                    {icons.find(i => i.id === createData.icon)?.component &&
                                                        React.cloneElement(icons.find(i => i.id === createData.icon).component, { size: 40, strokeWidth: 1.5 })
                                                    }
                                                </div>
                                            </div>

                                            {/* Right: Options */}
                                            <div className="flex flex-col gap-4">
                                                {/* Icon Grid */}
                                                <div className="flex gap-2 flex-wrap">
                                                    {icons.map(item => (
                                                        <button
                                                            key={item.id}
                                                            onClick={() => setCreateData({ ...createData, icon: item.id })}
                                                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${createData.icon === item.id
                                                                ? "bg-white dark:bg-gray-700 border-2 border-blue-500 text-blue-600 dark:text-blue-400 shadow-sm"
                                                                : "bg-transparent border border-gray-200 dark:border-gray-600 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-200"
                                                                }`}
                                                            title={item.label}
                                                        >
                                                            {React.cloneElement(item.component, { size: 20 })}
                                                        </button>
                                                    ))}
                                                </div>

                                                {/* Divider */}
                                                <div className="h-px w-full bg-gray-100"></div>

                                                {/* Color Picker */}
                                                <div className="flex gap-3 items-center">
                                                    {presetColors.map(color => (
                                                        <button
                                                            key={color}
                                                            onClick={() => setCreateData({ ...createData, color })}
                                                            className={`w-8 h-8 rounded-full transition-all duration-200 relative ${createData.color === color ? "scale-110" : "hover:scale-110"
                                                                }`}
                                                            style={{ backgroundColor: color }}
                                                        >
                                                            {createData.color === color && (
                                                                <div className="absolute inset-0 rounded-full ring-2 ring-offset-2 ring-gray-300"></div>
                                                            )}
                                                        </button>
                                                    ))}

                                                    {/* Custom Color */}
                                                    <div className="relative w-8 h-8 group">
                                                        <input
                                                            type="color"
                                                            value={createData.color}
                                                            onChange={(e) => setCreateData({ ...createData, color: e.target.value })}
                                                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                                                        />
                                                        <div className={`w-full h-full rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-colors ${!presetColors.includes(createData.color) ? "bg-white ring-2 ring-offset-2 ring-blue-500 border-solid border-transparent" : ""}`}>
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-between mt-8">
                                    <button
                                        onClick={handlePrevStep}
                                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 font-medium text-sm px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        Back
                                    </button>
                                    <button
                                        onClick={handleNextStep}
                                        disabled={!createData.name.trim() || !createData.adminName.trim() || nameError}
                                        className={`px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-md transition-all ${(!createData.name.trim() || !createData.adminName.trim() || nameError) ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-700 hover:shadow-lg"}`}
                                    >
                                        Next Step
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Invites */}
                        {createStep === 3 && (
                            <div className="p-8 animate-fade-in">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Invite Team Members</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Collaboration is better together.</p>

                                <div className="mb-6">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Email Addresses</label>
                                    <textarea
                                        value={createData.invites}
                                        onChange={(e) => setCreateData({ ...createData, invites: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all h-32 resize-none text-gray-900 dark:text-white"
                                        placeholder="colleague@example.com, partner@example.com..."
                                        disabled={addMembersLater}
                                    />
                                    <p className="text-xs text-gray-400 mt-2 text-right">Separate emails with commas</p>
                                </div>

                                <div className="flex items-center justify-between mb-6 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl border border-blue-100 dark:border-blue-800">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-900 dark:text-white">Invite Link</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Share this link with anyone</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={copyInviteLink}
                                        className={`px-3 py-1.5 border text-xs font-bold rounded-lg transition-colors ${isCopied
                                            ? "bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400"
                                            : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                            }`}
                                    >
                                        {isCopied ? "Copied!" : "Copy Link"}
                                    </button>
                                </div>

                                <div className="flex items-center mb-6">
                                    <input
                                        type="checkbox"
                                        id="addLater"
                                        checked={addMembersLater}
                                        onChange={(e) => setAddMembersLater(e.target.checked)}
                                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                                    />
                                    <label htmlFor="addLater" className="ml-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer select-none">
                                        I'll add team members later
                                    </label>
                                </div>

                                <div className="flex justify-between items-center">
                                    <button
                                        onClick={handlePrevStep}
                                        className="text-gray-500 hover:text-gray-700 font-medium text-sm px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                                    >
                                        Back
                                    </button>
                                    <button
                                        onClick={handleFinalCreate}
                                        disabled={!createData.invites.trim() && !addMembersLater}
                                        className={`px-8 py-2.5 text-white font-bold rounded-xl shadow-sm transition-all ${(!createData.invites.trim() && !addMembersLater)
                                            ? "bg-gray-300 cursor-not-allowed"
                                            : "bg-blue-600 hover:bg-blue-700"
                                            }`}
                                    >
                                        Finish & Launch
                                    </button>
                                </div>
                            </div>
                        )}



                    </div>
                </div>
            )
            }

            <div className="w-full max-w-4xl">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
                        Welcome{user?.username ? `, ${user.username}` : ''}!
                    </h1>
                    <p className="text-lg text-gray-600 dark:text-gray-400">Choose a workspace to launch.</p>
                </div>


                {/* Workspace Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {isLoadingWorkspaces ? (
                        // Loading State
                        <div className="col-span-full flex flex-col items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                            <p className="text-gray-600 dark:text-gray-400 font-medium">Loading your workspaces...</p>
                        </div>
                    ) : loadError ? (
                        // Error State with Retry
                        <div className="col-span-full flex flex-col items-center justify-center py-20">
                            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
                                <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <p className="text-gray-700 dark:text-gray-300 font-medium mb-2">Failed to load workspaces</p>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">{loadError}</p>
                            <button
                                onClick={loadWorkspaces}
                                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                            >
                                Try Again
                            </button>
                        </div>
                    ) : (
                        <>
                            {workspaces.map((ws) => (
                                <div
                                    key={ws.id}
                                    className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all group"
                                >

                                    <div className="flex items-start justify-between mb-4">
                                        <div
                                            className="w-12 h-12 rounded-lg flex items-center justify-center text-white shadow-sm"
                                            style={{ backgroundColor: ws.color }}
                                        >
                                            {icons.find(i => i.id === ws.icon)?.component &&
                                                React.cloneElement(icons.find(i => i.id === ws.icon).component, { size: 24 })
                                            }
                                        </div>
                                        <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium px-2.5 py-1 rounded-full">
                                            {ws.members} members
                                        </span>
                                    </div>

                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{ws.name}</h3>

                                    {/* Admin Name Badge - Always show */}
                                    <div className="flex items-center gap-1.5 mb-3">
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800 rounded-lg">
                                            <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                            <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                                                {ws.isOwner ? 'You' : ws.ownerName || 'Unknown'}
                                            </span>
                                        </div>
                                    </div>

                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Last active just now</p>

                                    <button
                                        onClick={() => handleLaunch(ws)}
                                        className="w-full py-2.5 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium border border-gray-200 dark:border-gray-600 group-hover:bg-blue-600 group-hover:text-white group-hover:border-transparent transition-all"
                                    >
                                        Launch Workspace
                                    </button>
                                </div>
                            ))}

                            {/* Create New Workspace Card */}
                            <div
                                onClick={handleCreateOpen}
                                className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all cursor-pointer group"
                            >
                                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-500 mb-3 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    <svg
                                        className="w-6 h-6"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="M12 4v16m8-8H4"
                                        />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                                    Create Workspace
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Start a new team</p>
                            </div>
                        </>
                    )}
                </div>
            </div >
        </div >
    );
};

export default WorkspaceSelect;
