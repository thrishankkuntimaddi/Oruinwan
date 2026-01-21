import React, { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom"; // Added useLocation
import IconSidebar from "./IconSidebar";
import ProfileMenu from "../SidebarComp/ProfileSidebar";
import ChttrixAIChat from "../ai/ChttrixAIChat/ChttrixAIChat";
import UniversalSearch from "../common/UniversalSearch";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { useUniversalSearch } from "../../hooks/useUniversalSearch";
import { Bot, BookOpen, Command, Bug, Sparkles, Search, MessageCircle, X, Loader2, Menu } from "lucide-react"; // Added Menu icon

const MainLayout = ({ children, sidePanel }) => {
    const { activeWorkspace } = useWorkspace();
    const [showProfile, setShowProfile] = useState(false);
    const [showAI, setShowAI] = useState(false);
    const [aiWidth, setAiWidth] = useState(350);
    const [sidePanelWidth, setSidePanelWidth] = useState(270);

    // Mobile State
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const location = useLocation();

    // Auto-close mobile menu on route change
    useEffect(() => {
        setMobileMenuOpen(false);
    }, [location.pathname]);

    // Universal Search State
    const [showUniversalSearch, setShowUniversalSearch] = useState(false);
    const { query, setQuery, results, loading, clearSearch } = useUniversalSearch(activeWorkspace?.id);
    const searchInputRef = useRef(null);

    // Keyboard shortcut for search (Cmd+K / Ctrl+K)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setShowUniversalSearch(true);
                searchInputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Help State
    const [showHelp, setShowHelp] = useState(false);
    const [activeHelpModal, setActiveHelpModal] = useState(null); // academy, shortcuts, bug, whatsnew

    // Refs for resizing
    const isResizingAIRef = useRef(false);
    const isResizingSidePanelRef = useRef(false);

    // Resizing Logic
    useEffect(() => {
        const handleMouseMove = (e) => {
            // Handle AI Resizing (Right Side)
            if (isResizingAIRef.current) {
                const newWidth = window.innerWidth - e.clientX;
                // Min: 300px, Max: 600px (Prevent extreme width)
                if (newWidth > 300 && newWidth < 600) {
                    setAiWidth(newWidth);
                }
            }

            // Handle SidePanel Resizing (Left Side)
            if (isResizingSidePanelRef.current) {
                // IconSidebar is 70px wide
                const newWidth = e.clientX - 70;
                // Min: 200px, Max: 400px (Prevent extreme width)
                if (newWidth > 200 && newWidth < 400) {
                    setSidePanelWidth(newWidth);
                }
            }
        };

        const handleMouseUp = () => {
            isResizingAIRef.current = false;
            isResizingSidePanelRef.current = false;
            document.body.style.cursor = "default";
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, []);

    const startResizingAI = (e) => {
        isResizingAIRef.current = true;
        document.body.style.cursor = "col-resize";
        e.preventDefault();
    };

    const startResizingSidePanel = (e) => {
        isResizingSidePanelRef.current = true;
        document.body.style.cursor = "col-resize";
        e.preventDefault();
    };

    return (
        <div className="flex flex-col h-screen w-full overflow-hidden bg-white dark:bg-gray-900 fixed inset-0">
            {/* ... (Top Bar remains same) ... */}

            {/* Help Modals */}
            {activeHelpModal && (
                <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center animate-fade-in backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col relative">
                        <button
                            onClick={() => setActiveHelpModal(null)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"
                        >
                            <X size={24} />
                        </button>

                        {activeHelpModal === "academy" && (
                            <>
                                <div className="p-6 bg-indigo-600 text-white">
                                    <h2 className="text-2xl font-bold flex items-center gap-2"><BookOpen size={28} /> Chttrix Academy</h2>
                                    <p className="text-indigo-100 mt-1">Master your workflow with these guides.</p>
                                </div>
                                <div className="p-6 overflow-y-auto space-y-4">
                                    {["Getting Started Guide", "Advanced Search Techniques", "Managing Notifications", "Integrations 101"].map((guide, i) => (
                                        <div key={i} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer transition-all group">
                                            <h3 className="font-bold text-gray-800 dark:text-gray-100 group-hover:text-indigo-700 dark:group-hover:text-indigo-400">{guide}</h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Learn the basics and become a pro user in no time.</p>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {activeHelpModal === "shortcuts" && (
                            <>
                                <div className="p-6 bg-gray-900 text-white">
                                    <h2 className="text-2xl font-bold flex items-center gap-2"><Command size={28} /> Keyboard Shortcuts</h2>
                                    <p className="text-gray-400 mt-1">Speed up your workflow.</p>
                                </div>
                                <div className="p-6 overflow-y-auto">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                    <h2 className="text-2xl font-bold text-red-700 flex items-center gap-2"><Bug size={28} /> Report a Bug</h2>
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
                                    <h2 className="text-2xl font-bold flex items-center gap-2"><Sparkles size={28} /> What's New</h2>
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
                                    <h2 className="text-2xl font-bold text-blue-900 flex items-center gap-2"><MessageCircle size={28} /> Contact Support</h2>
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

            {/* 1. Top Utility Bar (Full Width) */}
            <div className="h-12 flex items-center justify-between px-2 sm:px-4 bg-white dark:bg-gray-900 flex-shrink-0 z-[60] relative shadow-sm dark:shadow-gray-800">
                {/* Left: Menu Button (Mobile) & Spacer */}
                <div className="w-10 sm:w-20 flex items-center">
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>

                {/* Center: Search Bar */}
                <div className="flex-1 max-w-xl mx-auto relative z-[70]">
                    <div
                        className={`w-full flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded text-sm transition-all border ${showUniversalSearch ? 'border-blue-500 ring-2 ring-blue-100 dark:ring-blue-900/30' : 'border-transparent hover:border-blue-500'}`}
                    >
                        <Search size={14} className="text-gray-400 flex-shrink-0" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value);
                                if (!showUniversalSearch) setShowUniversalSearch(true);
                            }}
                            onFocus={() => setShowUniversalSearch(true)}
                            placeholder="Search..."
                            className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 min-w-0"
                        />
                        {loading && <Loader2 size={14} className="text-blue-500 animate-spin flex-shrink-0" />}
                        {query && !loading && (
                            <button
                                onClick={clearSearch}
                                className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                            >
                                <X size={14} className="text-gray-400" />
                            </button>
                        )}
                        <div className="hidden sm:flex ml-auto items-center gap-1 flex-shrink-0 pointer-events-none">
                            <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-900 rounded text-xs font-mono border border-gray-300 dark:border-gray-600">
                                {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}
                            </kbd>
                            <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-900 rounded text-xs font-mono border border-gray-300 dark:border-gray-600">
                                K
                            </kbd>
                        </div>
                    </div>

                    {/* Universal Search Dropdown */}
                    {showUniversalSearch && activeWorkspace && (
                        <>
                            {/* Backdrop */}
                            <div
                                className="fixed inset-0 z-[80]"
                                onClick={() => setShowUniversalSearch(false)}
                            />
                            <UniversalSearch
                                workspaceId={activeWorkspace.id}
                                onClose={() => setShowUniversalSearch(false)}
                                results={results}
                                loading={loading}
                                query={query}
                            />
                        </>
                    )}
                </div>


                {/* Right: Utilities */}
                <div className="flex items-center space-x-2 sm:space-x-4 w-12 sm:w-20 justify-end relative">
                    <button
                        onClick={() => setShowHelp(!showHelp)}
                        className={`hidden sm:block text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors ${showHelp ? "text-blue-600" : ""}`}
                    >
                        Help
                    </button>

                    <button
                        onClick={() => setShowAI(!showAI)}
                        className={`p-1.5 rounded-md transition-colors ${showAI ? "bg-blue-100 text-blue-600" : "text-gray-500 hover:bg-gray-100"}`}
                        title="Toggle Chttrix AI"
                    >
                        <Bot size={20} strokeWidth={2} />
                    </button>

                    {/* Help Popover - Minimal & Compact */}
                    {showHelp && (
                        <>
                            <div className="fixed inset-0 z-[90]" onClick={() => setShowHelp(false)}></div>
                            <div className="absolute top-12 right-0 w-64 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-xl shadow-2xl border border-gray-200/60 dark:border-gray-700/60 z-[100] overflow-hidden animate-fade-in origin-top-right ring-1 ring-black/5">
                                {/* Minimal Header */}
                                <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700/50 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50">
                                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Support</span>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-green-100/50 dark:bg-green-900/20 rounded-full">
                                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                                            <span className="text-[9px] font-bold text-green-600 dark:text-green-400">Systems Normal</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Search - Ultra Compact */}
                                <div className="p-2">
                                    <div className="relative group">
                                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                        <input
                                            type="text"
                                            placeholder="Search docs..."
                                            className="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                                        />
                                    </div>
                                </div>

                                {/* Quick Actions List - Minimal List Style */}
                                <div className="px-1 pb-1 space-y-0.5">
                                    <button
                                        onClick={() => { setShowHelp(false); setActiveHelpModal("academy"); }}
                                        className="w-full flex items-center gap-3 px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md transition-colors text-left group"
                                    >
                                        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                                            <BookOpen size={14} />
                                        </div>
                                        <span className="text-xs font-medium text-gray-700 dark:text-gray-200">Academy</span>
                                    </button>

                                    <button
                                        onClick={() => { setShowHelp(false); setActiveHelpModal("shortcuts"); }}
                                        className="w-full flex items-center gap-3 px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md transition-colors text-left group"
                                    >
                                        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 group-hover:scale-110 transition-transform">
                                            <Command size={14} />
                                        </div>
                                        <span className="text-xs font-medium text-gray-700 dark:text-gray-200">Shortcuts</span>
                                    </button>

                                    <button
                                        onClick={() => { setShowHelp(false); setActiveHelpModal("whatsnew"); }}
                                        className="w-full flex items-center gap-3 px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md transition-colors text-left group"
                                    >
                                        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                                            <Sparkles size={14} />
                                        </div>
                                        <span className="text-xs font-medium text-gray-700 dark:text-gray-200">What's New</span>
                                    </button>

                                    <button
                                        onClick={() => { setShowHelp(false); setActiveHelpModal("bug"); }}
                                        className="w-full flex items-center gap-3 px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md transition-colors text-left group"
                                    >
                                        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform">
                                            <Bug size={14} />
                                        </div>
                                        <span className="text-xs font-medium text-gray-700 dark:text-gray-200">Report Bug</span>
                                    </button>
                                </div>

                                {/* Footer - Minimal */}
                                <div className="border-t border-gray-100 dark:border-gray-700/50 p-2 bg-gray-50/80 dark:bg-gray-900/80">
                                    <button
                                        onClick={() => { setShowHelp(false); setActiveHelpModal("contact"); }}
                                        className="w-full flex items-center justify-center gap-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-all group"
                                    >
                                        <MessageCircle size={12} className="text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
                                        <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">Contact Support</span>
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* 2. Main Workspace Area (Below Top Bar) */}
            <div className="flex-1 flex overflow-hidden relative">

                {/* Mobile Menu Backdrop */}
                {mobileMenuOpen && (
                    <div
                        className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
                        onClick={() => setMobileMenuOpen(false)}
                    />
                )}

                {/* A. Far Left: Icon Sidebar */}
                <div className={`
                    fixed md:static inset-y-0 left-0 z-50 h-full
                    transform transition-transform duration-300 ease-in-out md:transform-none
                    ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
                    md:flex
                `}>
                    <div className="flex h-full h-full shadow-2xl md:shadow-none">
                        <IconSidebar onProfileClick={() => setShowProfile(true)} />

                        {/* B. Middle Left: Side Panel (Inside drawer on mobile, static on desktop) */}
                        {sidePanel && (
                            <div className="h-full flex">
                                <div
                                    className="flex-shrink-0 bg-white dark:bg-gray-900 h-full border-r border-gray-200 dark:border-gray-800"
                                    style={{ width: `${sidePanelWidth}px` }}
                                >
                                    {React.cloneElement(sidePanel, { title: activeWorkspace?.name || 'Loading...' })}
                                </div>
                                {/* SidePanel Drag Handle (Desktop Only) */}
                                <div
                                    className="hidden md:block w-1 bg-transparent hover:bg-blue-400 cursor-col-resize flex-shrink-0 transition-colors z-40"
                                    onMouseDown={startResizingSidePanel}
                                ></div>
                            </div>
                        )}
                    </div>
                </div>

                {/* C. Center: Main Content + Right Sidebar */}
                <main className="flex-1 flex min-w-0 bg-white dark:bg-gray-900 relative w-full">
                    {/* Page Content */}
                    <div className="flex-1 overflow-hidden relative w-full">
                        {children}
                    </div>

                    {/* D. Right Sidebar: Chttrix AI (Resizable) */}
                    {showAI && (
                        <>
                            {/* Drag Handle (Desktop Only) */}
                            <div
                                className="hidden md:block w-1 bg-transparent hover:bg-blue-400 cursor-col-resize flex-shrink-0 transition-colors z-40"
                                onMouseDown={startResizingAI}
                            ></div>

                            {/* AI Panel */}
                            <div
                                style={{ width: window.innerWidth < 768 ? '100%' : aiWidth }}
                                className={`
                                    fixed md:static inset-y-0 right-0 z-30
                                    bg-white dark:bg-gray-900 flex flex-col shadow-xl md:shadow-none
                                    ${window.innerWidth < 768 ? (showAI ? 'translate-x-0' : 'translate-x-full') : ''}
                                `}
                            >
                                <div className="md:hidden flex items-center justify-between p-2 border-b">
                                    <span className="font-bold pl-2">Chttrix AI</span>
                                    <button onClick={() => setShowAI(false)} className="p-2"><X size={20} /></button>
                                </div>
                                <ChttrixAIChat onClose={() => setShowAI(false)} isSidebar={true} />
                            </div>
                        </>
                    )}
                </main>
            </div>

            {/* Overlays */}
            {showProfile && <ProfileMenu onClose={() => setShowProfile(false)} />}
        </div >
    );
};

export default MainLayout;
