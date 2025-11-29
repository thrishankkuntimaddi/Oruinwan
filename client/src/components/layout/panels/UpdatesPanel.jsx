import React from "react";
import { Layout, User, Bell, Hash, Zap, Search } from "lucide-react";
import { useBlogs } from "../../../contexts/BlogsContext";

const UpdatesPanel = () => {
    const { activeFilter, setActiveFilter } = useBlogs();

    const filters = [
        { id: "all", label: "Team Pulse", icon: Zap },
        { id: "my-posts", label: "My Achievements", icon: User },
        { id: "mentions", label: "Mentions", icon: Bell },
    ];

    const trendingTags = ["#Milestone", "#BugFix", "#Launch", "#Design", "#Engineering"];

    return (
        <div className="flex flex-col h-full bg-gray-50/50 border-r border-gray-200">
            {/* Header */}
            <div className="h-16 border-b border-gray-200 flex items-center px-5 bg-white shrink-0">
                <h2 className="font-bold text-xl text-gray-800 tracking-tight flex items-center gap-2">
                    <Layout className="text-blue-600" size={20} />
                    Updates
                </h2>
            </div>

            {/* Search */}
            <div className="px-4 pt-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search updates..."
                        className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                </div>
            </div>

            {/* Navigation */}
            <div className="p-4 space-y-1">
                {filters.map((filter) => (
                    <button
                        key={filter.id}
                        onClick={() => setActiveFilter(filter.id)}
                        className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center gap-3
                            ${activeFilter === filter.id
                                ? "bg-blue-100 text-blue-700 shadow-sm"
                                : "text-gray-600 hover:bg-gray-100"
                            }
                        `}
                    >
                        <filter.icon size={18} />
                        {filter.label}
                    </button>
                ))}
            </div>

            {/* Trending Tags */}
            <div className="mt-6 px-6">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                    <Hash size={12} /> Trending Topics
                </h3>
                <div className="flex flex-wrap gap-2">
                    {trendingTags.slice(0, 5).map(tag => (
                        <span key={tag} className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 hover:border-blue-300 hover:text-blue-600 cursor-pointer transition-colors">
                            {tag}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default UpdatesPanel;
