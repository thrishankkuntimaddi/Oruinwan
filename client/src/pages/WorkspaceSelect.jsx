import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const WorkspaceSelect = () => {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const [showHelp, setShowHelp] = useState(false);
    const [activeHelpModal, setActiveHelpModal] = useState(null);

    const handleLogout = async () => {
        await logout();
        window.location.replace("/login");
    };

    // Mock data for workspaces
    const [workspaces, setWorkspaces] = useState([
        { id: 1, name: "Acme Corp", members: 12, icon: "A", color: "#2563eb" }, // blue-600
        { id: 2, name: "Project Beta", members: 5, icon: "P", color: "#9333ea" }, // purple-600
        { id: 3, name: "Design Team", members: 8, icon: "D", color: "#db2777" }, // pink-600
    ]);

    // Create Workspace Wizard State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createStep, setCreateStep] = useState(1);
    const [addMembersLater, setAddMembersLater] = useState(false);
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
        setCreateData({
            name: "",
            adminName: "",
            icon: "🚀",
            color: "#2563eb",
            invites: ""
        });
    };

    const handleCreateOpen = () => {
        setIsCreateModalOpen(true);
        setCreateStep(1);
        setIsCopied(false);
    };

    const handleNextStep = () => {
        if (createStep === 2) {
            if (!createData.name.trim() || !createData.adminName.trim()) return;
        }
        setCreateStep(prev => prev + 1);
    };

    const handlePrevStep = () => {
        setCreateStep(prev => prev - 1);
    };

    const handleFinalCreate = () => {
        const newWs = {
            id: workspaces.length + 1,
            name: createData.name,
            members: 1, // Just the admin initially
            icon: createData.icon,
            color: createData.color
        };
        setWorkspaces([...workspaces, newWs]);
        localStorage.setItem("currentWorkspace", newWs.name);

        // Simulate API call and redirect
        setTimeout(() => {
            resetCreateModal();
            navigate("/app");
        }, 500);
    };



    const copyInviteLink = () => {
        // Mock copy
        navigator.clipboard.writeText(`https://chttrix.com/join/${createData.name.toLowerCase().replace(/\s+/g, '-')}`);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 3000);
    };

    const handleLaunch = (ws) => {
        localStorage.setItem("currentWorkspace", ws.name);
        navigate("/app");
    };

    const icons = ["🚀", "💼", "⚡", "🎨", "🔬", "🌐", "🛡️", "📈", "💡", "🔥", "🎯", "🏆"];
    const presetColors = ["#2563eb", "#9333ea", "#db2777", "#16a34a", "#ea580c", "#4f46e5", "#0891b2", "#be123c"];

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 relative">
            {/* Logo */}
            <div
                onClick={() => navigate("/features")}
                className="absolute top-6 left-6 flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-opacity"
            >
                <img src="/assets/ChttrixLogo.svg" alt="Chttrix Logo" className="w-8 h-8 rounded-lg object-cover contrast-125 saturate-110 shadow-sm" />
                <span className="text-xl font-bold text-gray-900 tracking-tight">Chttrix</span>
            </div>

            {/* Top Right Actions */}
            <div className="absolute top-6 right-6 flex items-center space-x-6 z-50">
                <div className="relative">
                    <button
                        onClick={() => setShowHelp(!showHelp)}
                        className={`text-gray-500 hover:text-blue-600 font-medium text-sm transition-colors flex items-center ${showHelp ? "text-blue-600" : ""}`}
                    >
                        Help
                    </button>
                    {/* Help Popover */}
                    {showHelp && (
                        <>
                            <div className="fixed inset-0 z-[90]" onClick={() => setShowHelp(false)}></div>
                            <div className="absolute top-10 right-0 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 z-[100] overflow-hidden animate-fade-in origin-top-right text-left">
                                {/* Unique Gradient Header */}
                                <div className="p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                                    <h3 className="font-bold text-base">Chttrix Support</h3>
                                    <p className="text-[10px] text-indigo-100 mt-0.5 opacity-90">We're here to help you collaborate better.</p>
                                </div>

                                {/* Search */}
                                <div className="p-3 border-b border-gray-100">
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">🔍</span>
                                        <input
                                            type="text"
                                            placeholder="Find answers..."
                                            className="w-full pl-7 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                        />
                                    </div>
                                </div>

                                {/* Quick Actions Grid */}
                                <div className="p-2 grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => { setShowHelp(false); setActiveHelpModal("academy"); }}
                                        className="flex flex-col items-center justify-center p-2 hover:bg-indigo-50 rounded-lg transition-colors group"
                                    >
                                        <span className="text-xl mb-1 group-hover:scale-110 transition-transform">🎓</span>
                                        <span className="text-[10px] font-medium text-gray-700">Academy</span>
                                    </button>
                                    <button
                                        onClick={() => { setShowHelp(false); setActiveHelpModal("shortcuts"); }}
                                        className="flex flex-col items-center justify-center p-2 hover:bg-indigo-50 rounded-lg transition-colors group"
                                    >
                                        <span className="text-xl mb-1 group-hover:scale-110 transition-transform">⌨️</span>
                                        <span className="text-[10px] font-medium text-gray-700">Shortcuts</span>
                                    </button>
                                    <button
                                        onClick={() => { setShowHelp(false); setActiveHelpModal("bug"); }}
                                        className="flex flex-col items-center justify-center p-2 hover:bg-indigo-50 rounded-lg transition-colors group"
                                    >
                                        <span className="text-xl mb-1 group-hover:scale-110 transition-transform">🐛</span>
                                        <span className="text-[10px] font-medium text-gray-700">Report Bug</span>
                                    </button>
                                    <button
                                        onClick={() => { setShowHelp(false); setActiveHelpModal("whatsnew"); }}
                                        className="flex flex-col items-center justify-center p-2 hover:bg-indigo-50 rounded-lg transition-colors group"
                                    >
                                        <span className="text-xl mb-1 group-hover:scale-110 transition-transform">✨</span>
                                        <span className="text-[10px] font-medium text-gray-700">What's New</span>
                                    </button>
                                </div>

                                {/* System Status Footer */}
                                <div className="border-t border-gray-100 p-2 bg-gray-50 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                        </span>
                                        <span className="text-[9px] font-medium text-gray-500 uppercase tracking-wide">All Systems Operational</span>
                                    </div>
                                    <button
                                        onClick={() => { setShowHelp(false); setActiveHelpModal("contact"); }}
                                        className="text-[10px] text-indigo-600 font-medium hover:underline"
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
                    className="text-gray-500 hover:text-red-600 font-medium text-sm transition-colors flex items-center"
                >
                    Sign Out <span className="ml-2">→</span>
                </button>
            </div>

            {/* Help Modals */}
            {activeHelpModal && (
                <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center animate-fade-in backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-[600px] max-h-[80vh] overflow-hidden flex flex-col relative text-left">
                        <button
                            onClick={() => setActiveHelpModal(null)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>

                        {activeHelpModal === "academy" && (
                            <>
                                <div className="p-6 bg-indigo-600 text-white">
                                    <h2 className="text-2xl font-bold flex items-center gap-2">🎓 Chttrix Academy</h2>
                                    <p className="text-indigo-100 mt-1">Master your workflow with these guides.</p>
                                </div>
                                <div className="p-6 overflow-y-auto space-y-4">
                                    {["Getting Started Guide", "Advanced Search Techniques", "Managing Notifications", "Integrations 101"].map((guide, i) => (
                                        <div key={i} className="p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 cursor-pointer transition-all group">
                                            <h3 className="font-bold text-gray-800 group-hover:text-indigo-700">{guide}</h3>
                                            <p className="text-sm text-gray-500 mt-1">Learn the basics and become a pro user in no time.</p>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {activeHelpModal === "shortcuts" && (
                            <>
                                <div className="p-6 bg-gray-900 text-white">
                                    <h2 className="text-2xl font-bold flex items-center gap-2">⌨️ Keyboard Shortcuts</h2>
                                    <p className="text-gray-400 mt-1">Speed up your workflow.</p>
                                </div>
                                <div className="p-6 overflow-y-auto">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex justify-between items-center p-2 border-b border-gray-100">
                                            <span className="text-gray-600">Quick Search</span>
                                            <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono text-gray-500 border border-gray-300">Cmd + K</kbd>
                                        </div>
                                        <div className="flex justify-between items-center p-2 border-b border-gray-100">
                                            <span className="text-gray-600">New Message</span>
                                            <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono text-gray-500 border border-gray-300">Cmd + N</kbd>
                                        </div>
                                        <div className="flex justify-between items-center p-2 border-b border-gray-100">
                                            <span className="text-gray-600">Toggle AI</span>
                                            <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono text-gray-500 border border-gray-300">Cmd + J</kbd>
                                        </div>
                                        <div className="flex justify-between items-center p-2 border-b border-gray-100">
                                            <span className="text-gray-600">Close Window</span>
                                            <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono text-gray-500 border border-gray-300">Esc</kbd>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {activeHelpModal === "bug" && (
                            <>
                                <div className="p-6 bg-red-50 border-b border-red-100">
                                    <h2 className="text-2xl font-bold text-red-700 flex items-center gap-2">🐛 Report a Bug</h2>
                                    <p className="text-red-600 mt-1">Found something broken? Let us know.</p>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">What happened?</label>
                                        <textarea className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500 h-32" placeholder="Describe the issue..."></textarea>
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
                                        <h3 className="text-lg font-bold text-gray-900 mt-1">Chttrix AI 2.0</h3>
                                        <p className="text-gray-600 text-sm mt-1">Smarter responses, faster generation, and context-aware suggestions.</p>
                                    </div>
                                    <div className="relative pl-4 border-l-2 border-gray-200">
                                        <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-orange-500"></div>
                                        <span className="text-xs font-bold text-orange-500 uppercase">Oct 2025</span>
                                        <h3 className="text-lg font-bold text-gray-900 mt-1">Dark Mode Beta</h3>
                                        <p className="text-gray-600 text-sm mt-1">Easy on the eyes. Try it out in settings.</p>
                                    </div>
                                </div>
                            </>
                        )}
                        {activeHelpModal === "contact" && (
                            <>
                                <div className="p-6 bg-blue-50 border-b border-blue-100">
                                    <h2 className="text-2xl font-bold text-blue-900 flex items-center gap-2">📞 Contact Support</h2>
                                    <p className="text-blue-700 mt-1">We're here to help with any questions.</p>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                                        <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                                            <option>General Inquiry</option>
                                            <option>Billing Issue</option>
                                            <option>Technical Support</option>
                                            <option>Enterprise Sales</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                                        <textarea className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 h-32" placeholder="How can we help you?"></textarea>
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
                    <div className="bg-white rounded-2xl shadow-2xl w-[550px] overflow-hidden flex flex-col relative transition-all">

                        {/* Progress Bar */}
                        <div className="h-1.5 bg-gray-100 w-full">
                            <div
                                className="h-full bg-blue-600 transition-all duration-500 ease-out"
                                style={{ width: `${(createStep / 3) * 100}%` }}
                            ></div>
                        </div>

                        {/* Close Button */}
                        <button
                            onClick={resetCreateModal}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10 p-1 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>

                        {/* Step 1: Intro / Confirmation */}
                        {createStep === 1 && (
                            <div className="p-10 text-center flex flex-col items-center animate-fade-in">
                                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-6">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-3">Create a New Workspace</h2>
                                <p className="text-gray-600 mb-8 leading-relaxed max-w-sm">
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
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Workspace Details</h2>
                                <p className="text-sm text-gray-500 mb-8">Customize your workspace identity.</p>

                                <div className="space-y-5">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Workspace Name</label>
                                        <input
                                            type="text"
                                            value={createData.name}
                                            onChange={(e) => setCreateData({ ...createData, name: e.target.value })}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                            placeholder="e.g. Acme Corp"
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Admin Name</label>
                                        <input
                                            type="text"
                                            value={createData.adminName}
                                            onChange={(e) => setCreateData({ ...createData, adminName: e.target.value })}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                            placeholder="Your Name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Choose Icon & Color</label>
                                        <div className="flex gap-4 items-center">
                                            <div
                                                className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl text-white shadow-md transition-all"
                                                style={{ backgroundColor: createData.color }}
                                            >
                                                {createData.icon}
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <div className="flex gap-2 flex-wrap max-w-[300px]">
                                                    {icons.map(icon => (
                                                        <button
                                                            key={icon}
                                                            onClick={() => setCreateData({ ...createData, icon })}
                                                            className={`w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 border transition-all ${createData.icon === icon ? "border-blue-500 bg-blue-50" : "border-transparent"}`}
                                                        >
                                                            {icon}
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className="flex gap-2 items-center">
                                                    {presetColors.map(color => (
                                                        <button
                                                            key={color}
                                                            onClick={() => setCreateData({ ...createData, color })}
                                                            className={`w-6 h-6 rounded-full ring-2 ring-offset-1 transition-all ${createData.color === color ? "ring-gray-400 scale-110" : "ring-transparent hover:scale-110"}`}
                                                            style={{ backgroundColor: color }}
                                                        />
                                                    ))}
                                                    {/* Custom Color Input - Compact */}
                                                    <div className="relative group w-6 h-6">
                                                        <input
                                                            type="color"
                                                            value={createData.color}
                                                            onChange={(e) => setCreateData({ ...createData, color: e.target.value })}
                                                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                                                        />
                                                        <div className={`w-full h-full rounded-full border border-dashed border-gray-400 flex items-center justify-center text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-colors ${!presetColors.includes(createData.color) ? "bg-white ring-2 ring-offset-1 ring-blue-500 border-transparent" : "bg-transparent"}`}>
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
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
                                        className="text-gray-500 hover:text-gray-700 font-medium text-sm px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                                    >
                                        Back
                                    </button>
                                    <button
                                        onClick={handleNextStep}
                                        disabled={!createData.name.trim() || !createData.adminName.trim()}
                                        className={`px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-md transition-all ${(!createData.name.trim() || !createData.adminName.trim()) ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-700 hover:shadow-lg"}`}
                                    >
                                        Next Step
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Invites */}
                        {createStep === 3 && (
                            <div className="p-8 animate-fade-in">
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Invite Team Members</h2>
                                <p className="text-sm text-gray-500 mb-6">Collaboration is better together.</p>

                                <div className="mb-6">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Email Addresses</label>
                                    <textarea
                                        value={createData.invites}
                                        onChange={(e) => setCreateData({ ...createData, invites: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all h-32 resize-none"
                                        placeholder="colleague@example.com, partner@example.com..."
                                        disabled={addMembersLater}
                                    />
                                    <p className="text-xs text-gray-400 mt-2 text-right">Separate emails with commas</p>
                                </div>

                                <div className="flex items-center justify-between mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-blue-600 shadow-sm">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-900">Invite Link</p>
                                            <p className="text-xs text-gray-500">Share this link with anyone</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={copyInviteLink}
                                        className={`px-3 py-1.5 border text-xs font-bold rounded-lg transition-colors ${isCopied
                                            ? "bg-green-50 border-green-200 text-green-600"
                                            : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
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
                                    <label htmlFor="addLater" className="ml-2 text-sm text-gray-600 cursor-pointer select-none">
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
            )}

            <div className="w-full max-w-4xl">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-gray-900 mb-3">Welcome to Chttrix</h1>
                    <p className="text-lg text-gray-600">Choose a workspace to launch.</p>
                </div>

                {/* Workspace Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {workspaces.map((ws) => (
                        <div
                            key={ws.id}
                            className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-all group"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div
                                    className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl text-white shadow-sm"
                                    style={{ backgroundColor: ws.color }}
                                >
                                    {ws.icon}
                                </div>
                                <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-1 rounded-full">
                                    {ws.members} members
                                </span>
                            </div>

                            <h3 className="text-xl font-bold text-gray-900 mb-1">{ws.name}</h3>
                            <p className="text-sm text-gray-500 mb-6">Last active just now</p>

                            <button
                                onClick={() => handleLaunch(ws)}
                                className="w-full py-2.5 rounded-lg bg-gray-50 text-gray-900 font-medium border border-gray-200 group-hover:bg-blue-600 group-hover:text-white group-hover:border-transparent transition-all"
                            >
                                Launch Workspace
                            </button>
                        </div>
                    ))}

                    {/* Create New Workspace Card */}
                    <div
                        onClick={handleCreateOpen}
                        className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer group"
                    >
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-3 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
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
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                            Create Workspace
                        </h3>
                        <p className="text-sm text-gray-500">Start a new team</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WorkspaceSelect;
