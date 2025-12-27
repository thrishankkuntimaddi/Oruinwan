import React, { useState } from 'react';
import { Plus, X, FileText, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';

export default function ChannelTabs({
    tabs = [],
    activeTab,
    onTabChange,
    onAddTab,
    onDeleteTab,
    onRenameTab,
    currentUserId,
    isAdmin
}) {
    const [editingTabId, setEditingTabId] = useState(null);
    const [editingName, setEditingName] = useState("");
    const [isCollapsed, setIsCollapsed] = useState(false);

    const handleAddClick = () => {
        // Check tab limit
        if (tabs.length >= 5) {
            return; // Silently prevent, button will be disabled
        }

        // Auto-generate name: Untitled 1, Untitled 2, etc.
        // Look at ALL existing tabs (including temp ones) to find the highest number
        const untitledPattern = /^Untitled (\d+)$/;
        const existingNumbers = tabs
            .map(t => {
                const match = t.name.match(untitledPattern);
                return match ? parseInt(match[1], 10) : 0;
            })
            .filter(n => n > 0);

        const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
        const name = `Untitled ${nextNumber}`;

        onAddTab(name);
    };

    const handleDoubleClick = (tab) => {
        setEditingTabId(tab._id);
        setEditingName(tab.name);
    };

    const handleRename = (tabId) => {
        if (editingName.trim() && editingName !== tabs.find(t => t._id === tabId)?.name) {
            onRenameTab(tabId, editingName.trim());
        }
        setEditingTabId(null);
        setEditingName("");
    };

    // Check if user can delete a specific tab
    const canDeleteTab = (tab) => {
        if (isAdmin) return true;
        return String(tab.createdBy) === String(currentUserId);
    };

    return (
        <div className="flex flex-col bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800">
            {/* Tabs Bar - Compact Horizontal Layout */}
            <div className="flex items-center gap-1 px-3 py-2 overflow-x-auto no-scrollbar">
                {/* Main Chat Tab */}
                <button
                    onClick={() => onTabChange("chat")}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === "chat"
                        ? "text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 shadow-sm"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}
                >
                    <MessageSquare size={16} />
                    <span>Chat</span>
                </button>

                {/* Dynamic Canvas Tabs */}
                {tabs.map((tab) => (
                    <div
                        key={tab._id}
                        className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab._id
                            ? "text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 shadow-sm"
                            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
                            }`}
                    >
                        {editingTabId === tab._id ? (
                            <input
                                autoFocus
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onBlur={() => handleRename(tab._id)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleRename(tab._id);
                                    if (e.key === 'Escape') {
                                        setEditingTabId(null);
                                        setEditingName("");
                                    }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="text-sm px-2 py-1 rounded border border-blue-400 focus:outline-none bg-white dark:bg-gray-800 min-w-[100px]"
                            />
                        ) : (
                            <button
                                onClick={() => onTabChange(tab._id)}
                                onDoubleClick={() => handleDoubleClick(tab)}
                                className="flex items-center gap-2"
                            >
                                <FileText size={16} className="shrink-0" />
                                <span>{tab.name}</span>
                            </button>
                        )}

                        {/* Delete Tab Button - only show if user can delete */}
                        {!editingTabId && canDeleteTab(tab) && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteTab(tab._id);
                                }}
                                className={`p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-600 ${activeTab === tab._id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
                                title="Delete canvas"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                ))}

                {/* Add Tab Button - disabled at 5 tabs */}
                <button
                    onClick={handleAddClick}
                    disabled={tabs.length >= 5}
                    className={`p-2 rounded-lg transition-all ml-1 ${tabs.length >= 5
                        ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed'
                        : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                        }`}
                    title={tabs.length >= 5 ? "Maximum 5 canvases reached" : "Add Canvas"}
                >
                    <Plus size={16} />
                </button>
            </div>
        </div>
    );
}
