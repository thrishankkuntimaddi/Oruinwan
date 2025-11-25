import React, { useState, useRef, useEffect } from "react";
import IconSidebar from "./IconSidebar";
import ProfileMenu from "../SidebarComp/ProfileSidebar";
import ChttrixAIChat from "../chttrixAIComp/ChttrixAIChat";

const MainLayout = ({ children, sidePanel }) => {
    const [showProfile, setShowProfile] = useState(false);
    const [showAI, setShowAI] = useState(false);
    const [aiWidth, setAiWidth] = useState(400); // Default width for AI
    const [sidePanelWidth, setSidePanelWidth] = useState(256); // Default width for SidePanel (w-64)

    const isResizingAIRef = useRef(false);
    const isResizingSidePanelRef = useRef(false);

    // Resizing Logic
    useEffect(() => {
        const handleMouseMove = (e) => {
            // Handle AI Resizing (Right Side)
            if (isResizingAIRef.current) {
                const newWidth = window.innerWidth - e.clientX;
                if (newWidth > 300 && newWidth < 800) {
                    setAiWidth(newWidth);
                }
            }

            // Handle SidePanel Resizing (Left Side)
            if (isResizingSidePanelRef.current) {
                // IconSidebar is 70px wide
                const newWidth = e.clientX - 70;
                if (newWidth > 200 && newWidth < 600) {
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
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-white">
            {/* 1. Top Utility Bar (Full Width) */}
            <div className="h-12 flex items-center justify-between px-4 bg-white flex-shrink-0 z-20 relative shadow-sm">
                {/* Left: Spacer to balance the right side */}
                <div className="w-20"></div>

                {/* Center: Search Bar */}
                <div className="flex-1 max-w-xl mx-auto">
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                        <button className="w-full text-left pl-8 pr-3 py-1.5 bg-gray-100 rounded text-sm text-gray-500 hover:bg-gray-200 transition-colors">
                            Search Chttrix...
                        </button>
                    </div>
                </div>

                {/* Right: Utilities */}
                <div className="flex items-center space-x-4 w-20 justify-end">
                    <button className="text-gray-500 hover:text-gray-700 text-sm font-medium">
                        Help
                    </button>
                    <button
                        onClick={() => setShowAI(!showAI)}
                        className={`p-1.5 rounded-md transition-colors ${showAI ? "bg-blue-100 text-blue-600" : "text-gray-500 hover:bg-gray-100"}`}
                        title="Toggle Chttrix AI"
                    >
                        🤖
                    </button>
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
