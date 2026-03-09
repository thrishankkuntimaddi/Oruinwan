import React, { useState, useCallback } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import {
    Video, Calendar, Clock, Users, ChevronRight, Hash,
    Plus, Mic, PhoneOutgoing, MoreHorizontal, Radio, History,
} from "lucide-react";
import { useHuddleContext } from "../../../contexts/HuddleContext";
import { useToast } from "../../../contexts/ToastContext";

// ── Section Header (same pattern as TasksPanel) ───────────────────────────
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
                <span className="bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded text-[10px] font-medium">
                    {count}
                </span>
            )}
        </div>
    </div>
);

// ── Meeting Card ───────────────────────────────────────────────────────────
const MeetingCard = ({ title, time, status, participants = [], channel, onJoin, isSelected }) => (
    <div
        onClick={onJoin}
        className={`mx-3 mb-1.5 p-3 rounded-xl border transition-all cursor-pointer group relative overflow-hidden
            ${isSelected
                ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800"
                : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700/50 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-700"
            }`}
    >
        {/* Left Status Bar */}
        <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${status === "live"
                ? "bg-gradient-to-b from-red-500 to-pink-500"
                : status === "upcoming"
                    ? "bg-gradient-to-b from-blue-500 to-indigo-500"
                    : "bg-gray-200 dark:bg-gray-700"
            }`} />

        <div className="flex justify-between items-start mb-2 pl-2">
            <div>
                <h4 className={`text-sm font-semibold ${isSelected
                        ? "text-indigo-700 dark:text-indigo-300"
                        : "text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                    } transition-colors`}>
                    {title}
                </h4>
                {channel && (
                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                        <Hash size={10} />
                        <span>{channel}</span>
                    </div>
                )}
            </div>
            {status === "live" ? (
                <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[10px] font-bold rounded-full uppercase tracking-wide border border-red-100 dark:border-red-900/30 shrink-0">
                    <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                    </span>
                    Live
                </span>
            ) : status === "past" ? (
                <div className="flex items-center gap-1 text-xs text-gray-400 bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 rounded shrink-0">
                    <History size={10} />
                    <span>{time}</span>
                </div>
            ) : (
                <div className="flex items-center gap-1 text-xs text-gray-400 bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 rounded shrink-0">
                    <Clock size={10} />
                    <span>{time}</span>
                </div>
            )}
        </div>

        {/* Participants Row */}
        <div className="flex items-center justify-between pl-2">
            <div className="flex -space-x-1.5">
                {participants.slice(0, 4).map((p, i) => (
                    <div
                        key={i}
                        className="w-5 h-5 rounded-full border-2 border-white dark:border-gray-800 bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-[7px] font-bold text-indigo-600 dark:text-indigo-300"
                        title={p.username || p.initials}
                    >
                        {(p.username || p.initials || "?").slice(0, 2).toUpperCase()}
                    </div>
                ))}
                {participants.length > 4 && (
                    <div className="w-5 h-5 rounded-full border-2 border-white dark:border-gray-800 bg-gray-100 dark:bg-gray-700/80 flex items-center justify-center text-[8px] font-bold text-gray-500">
                        +{participants.length - 4}
                    </div>
                )}
                {participants.length === 0 && (
                    <span className="text-[10px] text-gray-400 pl-0.5">No participants yet</span>
                )}
            </div>

            {(status === "live" || status === "upcoming") && (
                <button
                    onClick={(e) => { e.stopPropagation(); onJoin && onJoin(); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                    {status === "live" ? "Join" : "View"}
                </button>
            )}
        </div>
    </div>
);

// ── Main Panel ─────────────────────────────────────────────────────────────
const MeetingsPanel = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { workspaceId } = useParams();
    const { showToast } = useToast();

    const {
        active,
        participants,
        muted,
        selectedHuddle,
        setSelectedHuddle,
        startHuddle,
        leaveHuddle,
        toggleMute,
        huddleHistory,
        activeWorkspaceHuddles,
    } = useHuddleContext();

    const activeTab = new URLSearchParams(location.search).get("tab") || "upcoming";
    const [expanded, setExpanded] = useState({ live: true, workspace: true, history: true });
    const [starting, setStarting] = useState(false);

    const handleTab = (tab) => {
        navigate(`/workspace/${workspaceId}/huddles?tab=${tab}`, { replace: true });
    };

    const toggle = (section) => setExpanded(prev => ({ ...prev, [section]: !prev[section] }));

    const handleStartInstant = useCallback(async () => {
        if (starting) return;
        setStarting(true);
        try {
            await startHuddle("Instant Huddle");
        } catch (err) {
            showToast("Microphone permission denied. Please allow mic access to start a huddle.", "error");
        } finally {
            setStarting(false);
        }
    }, [startHuddle, starting, showToast]);

    const handleSelectHuddle = (huddleData) => {
        setSelectedHuddle(huddleData);
    };

    const totalLive = (active ? 1 : 0) + activeWorkspaceHuddles.length;

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
            {/* ── Header ── */}
            <div className="h-16 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-5 bg-white dark:bg-gray-900 shrink-0">
                <h2 className="font-bold text-lg text-gray-800 dark:text-gray-100 tracking-tight">
                    Video Huddles
                </h2>
                <div className="flex items-center gap-1">
                    <button
                        onClick={handleStartInstant}
                        disabled={starting || active}
                        title="Start Instant Huddle"
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {starting ? (
                            <span className="block w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Video size={18} />
                        )}
                    </button>
                    <button
                        onClick={() => showToast("Schedule modal coming soon", "info")}
                        title="Schedule for Later"
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                    >
                        <Calendar size={18} />
                    </button>
                </div>
            </div>

            {/* ── Active Huddle Quick Bar ── */}
            {active && (
                <div
                    onClick={() => setSelectedHuddle(prev => prev || { title: "Instant Huddle", status: "live", participants })}
                    className="mx-3 mt-3 p-2.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-center gap-2.5 cursor-pointer group hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                >
                    <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                        <Radio size={13} className="text-white animate-pulse" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-green-800 dark:text-green-200 truncate">
                            {selectedHuddle?.title || "Instant Huddle"} • Active
                        </p>
                        <p className="text-[10px] text-green-600 dark:text-green-400">
                            {participants.length} participant{participants.length !== 1 ? "s" : ""} · {muted ? "Muted" : "Unmuted"}
                        </p>
                    </div>
                    <div className="flex gap-1">
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                            title={muted ? "Unmute" : "Mute"}
                            className={`p-1.5 rounded-lg transition-colors ${muted ? "bg-red-100 dark:bg-red-900/30 text-red-600" : "bg-green-100 dark:bg-green-900/30 text-green-700"}`}
                        >
                            <Mic size={11} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); leaveHuddle(); }}
                            title="Leave Huddle"
                            className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 hover:bg-red-200 transition-colors"
                        >
                            <PhoneOutgoing size={11} />
                        </button>
                    </div>
                </div>
            )}

            {/* ── Tabs ── */}
            <div className="px-4 py-3 shrink-0">
                <div className="p-1 bg-gray-100 dark:bg-gray-800 rounded-xl flex gap-1">
                    {[
                        { id: "upcoming", label: "Upcoming" },
                        { id: "history", label: "History" },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => handleTab(tab.id)}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${activeTab === tab.id
                                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                                    : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Scrollable Content ── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pb-4 space-y-1">

                {/* UPCOMING TAB */}
                {activeTab === "upcoming" && (
                    <>
                        {/* My Active Huddle */}
                        {active && selectedHuddle && (
                            <>
                                <SectionHeader
                                    label="My Huddle"
                                    count={participants.length}
                                    isOpen={expanded.live}
                                    onClick={() => toggle("live")}
                                />
                                {expanded.live && (
                                    <MeetingCard
                                        title={selectedHuddle.title || "Instant Huddle"}
                                        time="Now"
                                        status="live"
                                        channel={selectedHuddle.channel}
                                        participants={participants}
                                        isSelected={true}
                                        onJoin={() => handleSelectHuddle(selectedHuddle)}
                                    />
                                )}
                            </>
                        )}

                        {/* Workspace Live Huddles */}
                        {activeWorkspaceHuddles.length > 0 && (
                            <>
                                <SectionHeader
                                    label="Live Now"
                                    count={activeWorkspaceHuddles.length}
                                    isOpen={expanded.workspace}
                                    onClick={() => toggle("workspace")}
                                />
                                {expanded.workspace && activeWorkspaceHuddles.map(h => (
                                    <MeetingCard
                                        key={h.id}
                                        title={h.title}
                                        time="Now"
                                        status="live"
                                        channel={h.channel}
                                        participants={[]}
                                        isSelected={selectedHuddle?.id === h.id}
                                        onJoin={() => handleSelectHuddle(h)}
                                    />
                                ))}
                            </>
                        )}

                        {/* Empty state */}
                        {!active && activeWorkspaceHuddles.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                                <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mb-3">
                                    <Video size={20} className="text-indigo-500" />
                                </div>
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">No active huddles</p>
                                <p className="text-xs text-gray-400 mb-4">Start an instant huddle or schedule one</p>
                                <button
                                    onClick={handleStartInstant}
                                    disabled={starting}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm shadow-indigo-500/30 disabled:opacity-60"
                                >
                                    <Plus size={13} />
                                    {starting ? "Starting..." : "Start Instant Huddle"}
                                </button>
                            </div>
                        )}
                    </>
                )}

                {/* HISTORY TAB */}
                {activeTab === "history" && (
                    <>
                        {huddleHistory.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                                    <History size={20} className="text-gray-400" />
                                </div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No huddle history yet</p>
                                <p className="text-xs text-gray-400 mt-1">Ended huddles will appear here</p>
                            </div>
                        ) : (
                            <>
                                <SectionHeader
                                    label="Recent"
                                    count={huddleHistory.length}
                                    isOpen={expanded.history}
                                    onClick={() => toggle("history")}
                                />
                                {expanded.history && huddleHistory.map((h, i) => (
                                    <MeetingCard
                                        key={i}
                                        title={h.title || "Instant Huddle"}
                                        time={h.endTime ? new Date(h.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                                        status="past"
                                        channel={h.channel}
                                        participants={[]}
                                        isSelected={false}
                                        onJoin={null}
                                    />
                                ))}
                            </>
                        )}
                    </>
                )}
            </div>

            {/* ── Footer Stats ── */}
            <div className="mt-auto px-4 py-3 border-t border-gray-100 dark:border-gray-800 shrink-0">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex items-center gap-3">
                    <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-lg">
                        <Users size={14} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Live Huddles</p>
                        <p className="text-lg font-bold text-indigo-900 dark:text-indigo-100 leading-none">
                            {totalLive}
                            <span className="text-xs font-normal text-indigo-500 ml-1">active</span>
                        </p>
                    </div>
                    {active && (
                        <div className="ml-auto">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MeetingsPanel;
