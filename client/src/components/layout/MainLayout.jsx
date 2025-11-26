import React, { useState, useRef, useEffect } from "react";
import IconSidebar from "./IconSidebar";
import ProfileMenu from "../SidebarComp/ProfileSidebar";
import ChttrixAIChat from "../chttrixAIComp/ChttrixAIChat";
import { Bot } from "lucide-react";

const MainLayout = ({ children, sidePanel }) => {
    const [showProfile, setShowProfile] = useState(false);
    const [showAI, setShowAI] = useState(false);
    const [aiWidth, setAiWidth] = useState(350);
    const [sidePanelWidth, setSidePanelWidth] = useState(270);

    // Search State
    const [searchQuery, setSearchQuery] = useState("");
    const [showSearchResults, setShowSearchResults] = useState(false);

    // Help State
    const [showHelp, setShowHelp] = useState(false);
    const [activeHelpModal, setActiveHelpModal] = useState(null); // academy, shortcuts, bug, whatsnew

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
        <div className="flex flex-col h-screen w-full overflow-hidden bg-white fixed inset-0">
            {/* ... (Top Bar remains same) ... */}

            {/* Help Modals */}
            {activeHelpModal && (
                <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center animate-fade-in backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-[600px] max-h-[80vh] overflow-hidden flex flex-col relative">
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

            {/* 1. Top Utility Bar (Full Width) */}
            <div className="h-12 flex items-center justify-between px-4 bg-white flex-shrink-0 z-[60] relative shadow-sm">
                {/* Left: Spacer to balance the right side */}
                <div className="w-20"></div>

                {/* Center: Search Bar */}
                <div className="flex-1 max-w-xl mx-auto relative">
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setShowSearchResults(e.target.value.length > 0);
                            }}
                            onFocus={() => {
                                if (searchQuery.length > 0) setShowSearchResults(true);
                            }}
                            onBlur={() => setTimeout(() => setShowSearchResults(false), 200)} // Delay to allow clicking results
                            placeholder="Search Chttrix..."
                            className="w-full pl-8 pr-3 py-1.5 bg-gray-100 rounded text-sm text-gray-700 placeholder-gray-500 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all border border-transparent focus:border-blue-500"
                        />
                    </div>

                    {/* Search Results Dropdown */}
                    {showSearchResults && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50 animate-fade-in">
                            <div className="p-2">
                                <div className="text-xs font-bold text-gray-500 uppercase px-3 py-1">Recent Searches</div>
                                <div className="hover:bg-gray-100 px-3 py-2 rounded cursor-pointer text-sm text-gray-700 flex items-center">
                                    <span className="mr-2">🕒</span> project-alpha
                                </div>
                                <div className="hover:bg-gray-100 px-3 py-2 rounded cursor-pointer text-sm text-gray-700 flex items-center">
                                    <span className="mr-2">🕒</span> marketing-budget.pdf
                                </div>
                            </div>
                            <div className="border-t border-gray-100 p-2">
                                <div className="text-xs font-bold text-gray-500 uppercase px-3 py-1">Channels</div>
                                <div className="hover:bg-gray-100 px-3 py-2 rounded cursor-pointer text-sm text-gray-700 flex items-center">
                                    <span className="mr-2">#</span> engineering
                                </div>
                            </div>
                            <div className="bg-gray-50 px-4 py-2 text-xs text-center text-gray-500 border-t border-gray-100">
                                Press <strong>Enter</strong> to search for "{searchQuery}"
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Utilities */}
                <div className="flex items-center space-x-4 w-20 justify-end relative">
                    <button
                        onClick={() => setShowHelp(!showHelp)}
                        className={`text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors ${showHelp ? "text-blue-600" : ""}`}
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

                    {/* Help Popover */}
                    {showHelp && (
                        <>
                            <div className="fixed inset-0 z-[90]" onClick={() => setShowHelp(false)}></div>
                            <div className="absolute top-10 right-0 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 z-[100] overflow-hidden animate-fade-in origin-top-right">
                                {/* Unique Gradient Header */}
                                <div className="p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                                    <h3 className="font-bold text-base">Chttrix Support</h3>
                                    <p className="text-xs text-indigo-100 mt-0.5 opacity-90">We're here to help you collaborate better.</p>
                                </div>

                                {/* Search */}
                                <div className="p-3 border-b border-gray-100">
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                                        <input
                                            type="text"
                                            placeholder="Find answers..."
                                            className="w-full pl-7 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
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
                                        <span className="text-xs font-medium text-gray-700">Academy</span>
                                    </button>
                                    <button
                                        onClick={() => { setShowHelp(false); setActiveHelpModal("shortcuts"); }}
                                        className="flex flex-col items-center justify-center p-2 hover:bg-indigo-50 rounded-lg transition-colors group"
                                    >
                                        <span className="text-xl mb-1 group-hover:scale-110 transition-transform">⌨️</span>
                                        <span className="text-xs font-medium text-gray-700">Shortcuts</span>
                                    </button>
                                    <button
                                        onClick={() => { setShowHelp(false); setActiveHelpModal("bug"); }}
                                        className="flex flex-col items-center justify-center p-2 hover:bg-indigo-50 rounded-lg transition-colors group"
                                    >
                                        <span className="text-xl mb-1 group-hover:scale-110 transition-transform">🐛</span>
                                        <span className="text-xs font-medium text-gray-700">Report Bug</span>
                                    </button>
                                    <button
                                        onClick={() => { setShowHelp(false); setActiveHelpModal("whatsnew"); }}
                                        className="flex flex-col items-center justify-center p-2 hover:bg-indigo-50 rounded-lg transition-colors group"
                                    >
                                        <span className="text-xl mb-1 group-hover:scale-110 transition-transform">✨</span>
                                        <span className="text-xs font-medium text-gray-700">What's New</span>
                                    </button>
                                </div>

                                {/* System Status Footer */}
                                <div className="border-t border-gray-100 p-2 bg-gray-50 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                        </span>
                                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">All Systems Operational</span>
                                    </div>
                                    <button
                                        onClick={() => { setShowHelp(false); setActiveHelpModal("contact"); }}
                                        className="text-xs text-indigo-600 font-medium hover:underline"
                                    >
                                        Contact Us
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* 2. Main Workspace Area (Below Top Bar) */}
            <div className="flex-1 flex overflow-hidden">
                {/* A. Far Left: Icon Sidebar */}
                <IconSidebar onProfileClick={() => setShowProfile(true)} />

                {/* B. Middle Left: Side Panel (Optional & Resizable) */}
                {sidePanel && (
                    <>
                        <div
                            style={{ width: sidePanelWidth }}
                            className="flex-shrink-0 bg-gray-50 flex flex-col"
                        >
                            {sidePanel}
                        </div>
                        {/* SidePanel Drag Handle */}
                        <div
                            className="w-1 bg-transparent hover:bg-blue-400 cursor-col-resize flex-shrink-0 transition-colors z-40"
                            onMouseDown={startResizingSidePanel}
                        ></div>
                    </>
                )}

                {/* C. Center: Main Content + Right Sidebar */}
                <main className="flex-1 flex min-w-0 bg-white relative">
                    {/* Page Content */}
                    <div className="flex-1 overflow-hidden relative">
                        {children}
                    </div>

                    {/* D. Right Sidebar: Chttrix AI (Resizable) */}
                    {showAI && (
                        <>
                            {/* Drag Handle */}
                            <div
                                className="w-1 bg-transparent hover:bg-blue-400 cursor-col-resize flex-shrink-0 transition-colors z-40"
                                onMouseDown={startResizingAI}
                            ></div>

                            {/* AI Panel */}
                            <div
                                style={{ width: aiWidth }}
                                className="flex-shrink-0 bg-white flex flex-col shadow-xl z-30"
                            >
                                <ChttrixAIChat onClose={() => setShowAI(false)} isSidebar={true} />
                            </div>
                        </>
                    )}
                </main>
            </div>

            {/* Overlays */}
            {showProfile && <ProfileMenu onClose={() => setShowProfile(false)} />}
        </div>
    );
};

export default MainLayout;
