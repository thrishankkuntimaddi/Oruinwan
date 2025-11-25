import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const HomePanel = () => {
    const navigate = useNavigate();
    const [expanded, setExpanded] = useState({
        favorites: true,
        channels: true,
        dms: true,
    });

    const toggle = (section) => {
        setExpanded((prev) => ({ ...prev, [section]: !prev[section] }));
    };

    const SectionHeader = ({ label, isOpen, onClick, onAdd }) => (
        <div className="flex items-center justify-between px-4 py-2 group cursor-pointer hover:text-gray-900 text-gray-500 mt-2">
            <div className="flex items-center" onClick={onClick}>
                <span className={`mr-2 text-[10px] transition-transform ${isOpen ? "rotate-90" : ""}`}>▶</span>
                <span className="uppercase text-xs font-bold tracking-wide">{label}</span>
            </div>
            {onAdd && (
                <button
                    className="opacity-0 group-hover:opacity-100 hover:bg-gray-200 rounded p-1 text-gray-600 transition-opacity"
                    onClick={(e) => { e.stopPropagation(); onAdd(); }}
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                </button>
            )}
        </div>
    );

    const location = useLocation();
    const currentPath = location.pathname;

    const Item = ({ icon, label, path, hasUnread }) => {
        const isActive = currentPath === path;
        return (
            <div
                onClick={() => navigate(path)}
                className={`px-4 py-1.5 mx-2 rounded-md cursor-pointer flex items-center justify-between group transition-colors ${isActive
                    ? "bg-blue-100 text-blue-700 font-medium"
                    : "hover:bg-gray-200 text-gray-600 hover:text-gray-900"
                    }`}
            >
                <div className="flex items-center truncate">
                    <span className="mr-2 opacity-70 text-lg">{icon}</span>
                    <span className="truncate text-sm">{label}</span>
                </div>
                {hasUnread && <div className="w-2 h-2 bg-blue-600 rounded-full"></div>}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* Workspace Header with New Message Button */}
            <div className="h-12 border-b border-gray-200 flex items-center justify-between px-4 hover:bg-gray-100 transition-colors group">
                <div className="flex items-center font-bold text-gray-900 cursor-pointer">
                    Chttrix HQ <span className="ml-2 text-xs text-gray-500">▼</span>
                </div>
                <button
                    className="text-gray-500 hover:bg-gray-200 p-1 rounded"
                    onClick={(e) => { e.stopPropagation(); alert("New Message"); }}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200 mx-4 mt-2 mb-2"></div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pb-4">

                {/* Favorites */}
                <SectionHeader label="Favorites" isOpen={expanded.favorites} onClick={() => toggle("favorites")} />
                {expanded.favorites && (
                    <div className="space-y-0.5">
                        <Item icon="⭐" label="general" path="/channel/general" />
                        <Item icon="⭐" label="announcements" path="/channel/announcements" />
                    </div>
                )}

                {/* Channels */}
                <SectionHeader
                    label="Channels"
                    isOpen={expanded.channels}
                    onClick={() => toggle("channels")}
                    onAdd={() => alert("Create Channel Modal")}
                />
                {expanded.channels && (
                    <div className="space-y-0.5">
                        <Item icon="#" label="engineering" path="/channel/engineering" />
                        <Item icon="#" label="design" path="/channel/design" />
                        <Item icon="#" label="marketing" path="/channel/marketing" />
                        <Item icon="🔒" label="leadership" path="/channel/leadership" />
                    </div>
                )}

                {/* Direct Messages */}
                <SectionHeader
                    label="Direct Messages"
                    isOpen={expanded.dms}
                    onClick={() => toggle("dms")}
                    onAdd={() => alert("New DM Modal")}
                />
                {expanded.dms && (
                    <div className="space-y-0.5">
                        <Item icon="👤" label="Sarah Connor" path="/dm/sarah" />
                        <Item icon="👤" label="John Doe" path="/dm/john" />
                        <Item icon="👤" label="Alice Smith" path="/dm/alice" />
                    </div>
                )}
            </div>
        </div>
    );
};

export default HomePanel;
