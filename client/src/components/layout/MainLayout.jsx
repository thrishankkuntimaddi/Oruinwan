import React, { useState, useRef, useEffect } from "react";
import IconSidebar from "./IconSidebar";
import ProfileMenu from "../SidebarComp/ProfileSidebar";
import ChttrixAIChat from "../chttrixAIComp/ChttrixAIChat";

const MainLayout = ({ children, sidePanel }) => {
    const [showProfile, setShowProfile] = useState(false);
    const [showAI, setShowAI] = useState(false);
    const [aiWidth, setAiWidth] = useState(400); // Default width
    const isResizingRef = useRef(false);

    // Resizing Logic
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizingRef.current) return;
            const newWidth = window.innerWidth - e.clientX;
            if (newWidth > 300 && newWidth < 800) {
                setAiWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            isResizingRef.current = false;
            document.body.style.cursor = "default";
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, []);

    const startResizing = (e) => {
        isResizingRef.current = true;
        document.body.style.cursor = "col-resize";
        e.preventDefault();
    };

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-white">
            {/* 1. Far Left: Icon Sidebar */}
            <IconSidebar onProfileClick={() => setShowProfile(true)} />

            {/* 2. Middle Left: Side Panel (Optional) */}
            {sidePanel && (
                <div className="flex-shrink-0 w-64 border-r border-gray-200">
                    {sidePanel}
                </div>
            )}

            {/* 3. Center: Main Content */}
            <main className="flex-1 flex flex-col min-w-0 bg-white relative">
                {/* Top Utility Bar */}
                <div className="h-12 border-b border-gray-200 flex items-center justify-between px-4 bg-white flex-shrink-0">
                    {/* Search Bar */}
                    <div className="flex-1 max-w-xl">
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                            <button className="w-full text-left pl-8 pr-3 py-1.5 bg-gray-100 rounded text-sm text-gray-500 hover:bg-gray-200 transition-colors">
                                Search Chttrix...
                            </button>
                        </div>
                    </div>

                    {/* Right Utilities */}
                    <div className="flex items-center space-x-4 ml-4">
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

                {/* Page Content */}
                <div className="flex-1 overflow-hidden relative flex">
                    <div className="flex-1 overflow-hidden relative">
                        {children}
                    </div>

                    {/* 4. Right Sidebar: Chttrix AI (Resizable) */}
                    {showAI && (
                        <>
                            {/* Drag Handle */}
                            <div
                                className="w-1 bg-gray-200 hover:bg-blue-400 cursor-col-resize flex-shrink-0 transition-colors z-40"
                                onMouseDown={startResizing}
                            ></div>

                            {/* AI Panel */}
                            <div
                                style={{ width: aiWidth }}
                                className="flex-shrink-0 bg-white border-l border-gray-200 flex flex-col shadow-xl z-30"
                            >
                                <ChttrixAIChat onClose={() => setShowAI(false)} isSidebar={true} />
                            </div>
                        </>
                    )}
                </div>
            </main>

            {/* Overlays */}
            {showProfile && <ProfileMenu onClose={() => setShowProfile(false)} />}
        </div>
    );
};

export default MainLayout;
