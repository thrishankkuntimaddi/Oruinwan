import React, { useState } from 'react';
import { Plus, X, FileText, MessageSquare, CheckSquare, Palette, List } from 'lucide-react';

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
        <div className="flex flex-col bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
            {/* Tabs Bar - Modern Underline Layout */}
            <div className="flex items-center gap-2 px-4 overflow-x-auto no-scrollbar">
                {/* Main Chat Tab */}
                <button
                    onClick={() => onTabChange("chat")}
                    className={`flex items-center gap-2 py-3 text-sm font-medium transition-all whitespace-nowrap border-b-2 ${activeTab === "chat"
                        ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                        : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-200"
                        }`}
                >
                    <MessageSquare size={16} />
                    <span>Chat</span>
                </button>

                {/* Threads Tab */}
                <button
                    onClick={() => onTabChange("threads")}
                    className={`flex items-center gap-2 py-3 text-sm font-medium transition-all whitespace-nowrap border-b-2 ${activeTab === "threads"
                        ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                        : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-200"
                        }`}
                >
                    <List size={16} />
                    <span>Threads</span>
                </button>

                {/* Tasks Tab */}
                <button
                    onClick={() => onTabChange("tasks")}
                    className={`flex items-center gap-2 py-3 text-sm font-medium transition-all whitespace-nowrap border-b-2 ${activeTab === "tasks"
                        ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                        : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-200"
                        }`}
                >
                    <CheckSquare size={16} />
                    <span>Tasks</span>
                </button>

                {/* Canvas Tab */}
                <button
                    onClick={() => onTabChange("canvas")}
                    className={`flex items-center gap-2 py-3 text-sm font-medium transition-all whitespace-nowrap border-b-2 ${activeTab === "canvas"
                        ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                        : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-200"
                        }`}
                >
                    <Palette size={16} />
                    <span>Canvas</span>
                </button>

                {/* Dynamic Canvas Tabs */}
                {tabs.map((tab) => (
                    <div
                        key={tab._id}
                        className={`group flex items-center gap-2 py-3 text-sm font-medium transition-all whitespace-nowrap border-b-2 cursor-pointer ${activeTab === tab._id
                            ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                            : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-200"
                            }`}
                        onClick={() => onTabChange(tab._id)}
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
                                className="text-sm px-1 py-0.5 rounded border-b border-blue-400 focus:outline-none bg-transparent min-w-[100px]"
                            />
                        ) : (
                            <div
                                onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    handleDoubleClick(tab);
                                }}
                                className="flex items-center gap-2"
                            >
                                <FileText size={16} className="shrink-0" />
                                <span>{tab.name}</span>
                            </div>
                        )}

                        {/* Delete Tab Button - Removed per user request */}
                    </div>
                ))}

                {/* Add Tab Button */}
                <button
                    onClick={handleAddClick}
                    disabled={tabs.length >= 5}
                    className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-all ml-2 ${tabs.length >= 5
                        ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed'
                        : 'text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400'
                        }`}
                    title={tabs.length >= 5 ? "Maximum 5 canvases reached" : "Add Canvas"}
                >
                    <Plus size={16} />
                </button>
            </div>
        </div>
    );
}
