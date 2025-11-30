import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const SidePanel = ({ title = "Workspace", children }) => {
    return (
        <div className="w-64 bg-gray-50 flex flex-col text-gray-700">
            {/* Header */}
            <div className="h-12 flex items-center justify-between px-4 font-semibold text-gray-900 hover:bg-gray-100 cursor-pointer transition-colors group">
                <div className="flex items-center">
                    {title} <span className="ml-2 text-xs text-gray-500">▼</span>
                </div>
                <button
                    className="p-1.5 rounded-md hover:bg-gray-200 text-gray-500 hover:text-gray-900 opacity-0 group-hover:opacity-100 transition-all"
                    title="New Message"
                    onClick={(e) => { e.stopPropagation(); /* Handle new message */ }}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </button>
            </div>

            {/* Content Area (Scrollable) */}
            <div className="flex-1 overflow-y-auto py-4 custom-scrollbar">
                {children}
            </div>
        </div>
    );
};

export const ChannelList = () => {
    const [expanded, setExpanded] = useState({
        favorites: true,
        channels: true,
        dms: true,
    });

    const toggle = (section) => {
        setExpanded((prev) => ({ ...prev, [section]: !prev[section] }));
    };

    const SectionHeader = ({ label, isOpen, onClick, onAdd }) => (
        <div className="flex items-center justify-between px-4 py-1 group cursor-pointer hover:text-gray-900 text-gray-500">
            <div className="flex items-center" onClick={onClick}>
                <span className={`mr-2 text-[10px] transition-transform ${isOpen ? "rotate-90" : ""}`}>▶</span>
                <span className="uppercase text-xs font-bold tracking-wide">{label}</span>
            </div>
            {onAdd && (
                <button className="opacity-0 group-hover:opacity-100 hover:bg-gray-200 rounded p-0.5 text-gray-600" onClick={onAdd}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                </button>
            )}
        </div>
    );

    const navigate = useNavigate();

    const Item = ({ icon, label, path, active, hasUnread }) => (
        <div
            onClick={() => navigate(path)}
            className={`px-4 py-1 mx-2 rounded cursor-pointer flex items-center justify-between group ${active
                ? "bg-blue-100 text-blue-700 font-medium"
                : "hover:bg-gray-200 text-gray-600 hover:text-gray-900"
                }`}
        >
            <div className="flex items-center truncate">
                <span className="mr-2 opacity-70 text-lg">{icon}</span>
                <span className="truncate">{label}</span>
            </div>
            {hasUnread && <div className="w-2 h-2 bg-blue-600 rounded-full"></div>}
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Favorites */}
            <div>
                <SectionHeader label="Favorites" isOpen={expanded.favorites} onClick={() => toggle("favorites")} />
                {expanded.favorites && (
                    <div className="mt-1 space-y-0.5">
                        <Item icon="#" label="general" path="/messages/channel/general" />
                        <Item icon="#" label="announcements" path="/messages/channel/announcements" hasUnread />
                    </div>
                )}
            </div>

            {/* Channels */}
            <div>
                <SectionHeader
                    label="Channels"
                    isOpen={expanded.channels}
                    onClick={() => toggle("channels")}
                    onAdd={(e) => { e.stopPropagation(); alert("Create Channel"); }}
                />
                {expanded.channels && (
                    <div className="mt-1 space-y-0.5">
                        <Item icon="#" label="engineering" path="/messages/channel/engineering" />
                        <Item icon="#" label="design" path="/messages/channel/design" />
                        <Item icon="#" label="marketing" path="/messages/channel/marketing" />
                        <Item icon="#" label="leadership" path="/messages/channel/leadership" />
                    </div>
                )}
            </div>

            {/* Direct Messages */}
            <div>
                <SectionHeader
                    label="Direct Messages"
                    isOpen={expanded.dms}
                    onClick={() => toggle("dms")}
                    onAdd={(e) => { e.stopPropagation(); alert("New DM"); }}
                />
                {expanded.dms && (
                    <div className="mt-1 space-y-0.5">
                        <Item icon="👤" label="Sarah Connor" path="/messages/dm/sarah" active />
                        <Item icon="👤" label="John Doe" path="/messages/dm/john" />
                        <Item icon="👤" label="Alice Smith" path="/messages/dm/alice" hasUnread />
                    </div>
                )}
            </div>
        </div>
    );
};

export default SidePanel;
