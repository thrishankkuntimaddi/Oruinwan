import React, { useState } from "react";
import { Video, Calendar, Clock, Users, MoreHorizontal, ChevronRight, Hash } from "lucide-react";
import { useToast } from "../../../contexts/ToastContext";
import ActiveMeetingOverlay from "./ActiveMeetingOverlay";

const MeetingsPanel = () => {
    const { showToast } = useToast();
    const [expanded, setExpanded] = useState({
        meetings: true,
        history: true
    });
    const [showMeetingOverlay, setShowMeetingOverlay] = useState(false);

    const toggle = (section) => {
        setExpanded(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const [activeTab, setActiveTab] = useState("upcoming"); // 'upcoming' or 'history'

    // Inspired by HomePanel's SectionHeader
    const SectionHeader = ({ label, isOpen, onClick, count }) => (
        <div
            onClick={onClick}
            className="flex items-center justify-between px-4 py-2 group cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mt-2 select-none"
        >
            <div className="flex items-center gap-2">
                <span className={`text-gray-400 transform transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}>
                    <ChevronRight size={12} />
                </span>
                <span className="text-xs font-bold tracking-wider text-gray-500 uppercase">{label}</span>
                {count !== undefined && (
                    <span className="bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded text-[10px] font-medium">{count}</span>
                )}
            </div>
        </div>
    );

    const MeetingCard = ({ title, time, status, participants = [], channel, onJoin }) => (
        <div className="mx-3 mb-2 p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 rounded-xl hover:shadow-md hover:border-gray-200 dark:hover:border-gray-700 transition-all cursor-pointer group relative overflow-hidden">
            {/* Left Status Bar */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${status === 'live' ? 'bg-gradient-to-b from-red-500 to-pink-500' :
                status === 'upcoming' ? 'bg-gradient-to-b from-blue-500 to-indigo-500' :
                    'bg-gray-300'
                }`} />

            <div className="flex justify-between items-start mb-2 pl-2">
                <div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {title}
                    </h4>
                    {channel && (
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                            <Hash size={10} />
                            <span>{channel}</span>
                        </div>
                    )}
                </div>
                {status === 'live' ? (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[10px] font-bold rounded-full uppercase tracking-wide border border-red-100 dark:border-red-900/30">
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                        </span>
                        Live
                    </span>
                ) : (
                    <div className="flex items-center gap-1 text-xs text-gray-400 bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                        <Clock size={10} />
                        <span>{time}</span>
                    </div>
                )}
            </div>

            {/* Participants */}
            <div className="flex items-center justify-between pl-2 mt-3">
                <div className="flex -space-x-1.5">
                    {participants.slice(0, 3).map((p, i) => (
                        <div
                            key={i}
                            className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-800 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[8px] font-bold text-gray-600 dark:text-gray-300 relative z-10"
                            style={{ backgroundImage: p.img ? `url(${p.img})` : undefined, backgroundSize: 'cover' }}
                        >
                            {!p.img && p.initials}
                        </div>
                    ))}
                    {participants.length > 3 && (
                        <div className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-800 bg-gray-100 dark:bg-gray-700/80 flex items-center justify-center text-[9px] font-bold text-gray-500 z-0">
                            +{participants.length - 3}
                        </div>
                    )}
                </div>

                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onJoin) onJoin();
                        }}
                        className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                        {status === 'live' ? <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Join</span> : <MoreHorizontal size={14} />}
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col h-full w-full">
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-5 bg-white dark:bg-gray-900 shrink-0 border-b border-gray-200 dark:border-gray-800">
                <h2 className="font-bold text-lg text-gray-800 dark:text-gray-100 tracking-tight">
                    Video Huddles
                </h2>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setShowMeetingOverlay(true)}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                        title="New Instant Huddle"
                    >
                        <Video size={20} />
                    </button>
                    <button
                        onClick={() => showToast("Schedule modal opening...", "info")}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                        title="Schedule for Later"
                    >
                        <Calendar size={20} />
                    </button>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {/* Hero Action Section */}
                <div className="px-4 mb-2 mt-6">
                    <div className="p-1 bg-gray-100 dark:bg-gray-800 rounded-xl flex gap-1">
                        <button
                            onClick={() => setActiveTab("upcoming")}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-lg shadow-sm transition-all ${activeTab === "upcoming" ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"}`}
                        >
                            Upcoming
                        </button>
                        <button
                            onClick={() => setActiveTab("history")}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-lg shadow-sm transition-all ${activeTab === "history" ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"}`}
                        >
                            History
                        </button>
                    </div>
                </div>

                <div className="space-y-1 pb-4">
                    {/* UPCOMING VIEW */}
                    {activeTab === "upcoming" && (
                        <>
                            <SectionHeader
                                label="Today"
                                count={2}
                                isOpen={expanded.meetings}
                                onClick={() => toggle("meetings")}
                            />

                            {expanded.meetings && (
                                <div className="space-y-0.5 animate-fade-in relative">
                                    <MeetingCard
                                        title="Team Sync"
                                        time="Now"
                                        status="live"
                                        channel="general"
                                        onJoin={() => setShowMeetingOverlay(true)}
                                        participants={[
                                            { initials: 'JD' },
                                            { initials: 'AS' },
                                            { initials: 'TK' },
                                            { initials: 'JD' }
                                        ]}
                                    />
                                    <MeetingCard
                                        title="Daily Standup"
                                        time="10:00 AM"
                                        status="upcoming"
                                        channel="engineering"
                                        participants={[
                                            { initials: 'JD' },
                                            { initials: 'AS' }
                                        ]}
                                    />
                                    <MeetingCard
                                        title="Design Review"
                                        time="2:00 PM"
                                        status="upcoming"
                                        channel="design"
                                        participants={[
                                            { initials: 'TK' }
                                        ]}
                                    />
                                </div>
                            )}
                        </>
                    )}

                    {/* HISTORY VIEW */}
                    {activeTab === "history" && (
                        <>
                            <SectionHeader
                                label="Yesterday"
                                isOpen={expanded.history}
                                onClick={() => toggle("history")}
                            />

                            {expanded.history && (
                                <div className="space-y-0.5 animate-fade-in">
                                    <MeetingCard
                                        title="Sprint Planning"
                                        time="10:00 AM"
                                        status="past"
                                        channel="product"
                                        participants={[
                                            { initials: 'JD' },
                                            { initials: 'AS' },
                                            { initials: 'TK' }
                                        ]}
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Bottom teaser or stats */}
            <div className="mt-auto p-4 border-t border-gray-100 dark:border-gray-800 shrink-0 bg-gray-50 dark:bg-gray-900 z-10">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg flex items-center gap-3">
                    <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-md">
                        <Users size={14} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Weekly Huddles</p>
                        <p className="text-lg font-bold text-indigo-900 dark:text-indigo-100 leading-none">24<span className="text-xs font-normal text-indigo-500 ml-1">huddles</span></p>
                    </div>
                </div>
            </div>

            {/* Meeting Overlay */}
            <ActiveMeetingOverlay
                isOpen={showMeetingOverlay}
                onClose={() => setShowMeetingOverlay(false)}
            />
        </div>
    );
};

export default MeetingsPanel;
