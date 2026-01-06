import React, { useState, useEffect } from "react";
import { Search, X, User, Hash } from "lucide-react";
import { useContacts } from "../../../../contexts/ContactsContext";
import { useWorkspace } from "../../../../contexts/WorkspaceContext";
import api from "../../../../services/api";

export default function ForwardMessageModal({ onClose, onForward, currentChatId, currentChatType }) {
    const { channels } = useContacts();
    const { activeWorkspace } = useWorkspace();
    const [activeTab, setActiveTab] = useState('channels'); // 'channels' or 'dms'
    const [search, setSearch] = useState("");
    const [selectedItems, setSelectedItems] = useState(new Set()); // Multiple selection
    const [workspaceMembers, setWorkspaceMembers] = useState([]);
    const [loading, setLoading] = useState(false);

    // Fetch workspace members when DM tab is active
    useEffect(() => {
        if (activeTab === 'dms' && activeWorkspace) {
            loadWorkspaceMembers();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, activeWorkspace]);

    const loadWorkspaceMembers = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/api/workspaces/${activeWorkspace.id}/members`);
            setWorkspaceMembers(response.data.members || []);
        } catch (err) {
            console.error("Failed to load workspace members:", err);
        } finally {
            setLoading(false);
        }
    };

    // Filter out current channel/DM from the list
    const filteredChannels = channels
        .filter(ch => ch.id !== currentChatId)
        .filter(ch => ch.label.toLowerCase().includes(search.toLowerCase()));

    // For DMs tab: show workspace members (not just existing DM sessions)
    const filteredDMs = workspaceMembers
        .filter(member => member.username.toLowerCase().includes(search.toLowerCase()));


    const toggleSelection = (item) => {
        const newSelection = new Set(selectedItems);
        const itemId = activeTab === 'channels' ? item.id : item._id;

        if (newSelection.has(itemId)) {
            newSelection.delete(itemId);
        } else {
            newSelection.add(itemId);
        }
        setSelectedItems(newSelection);
    };

    const handleForward = () => {
        if (selectedItems.size === 0) return;

        const targets = [];

        if (activeTab === 'channels') {
            // Convert selected channel IDs to target objects
            selectedItems.forEach(id => {
                const channel = channels.find(ch => ch.id === id);
                if (channel) {
                    targets.push({
                        type: 'channel',
                        id: channel.id,
                        label: channel.label
                    });
                }
            });
        } else {
            // Convert selected member IDs to DM targets
            selectedItems.forEach(id => {
                const member = workspaceMembers.find(m => m._id === id);
                if (member) {
                    targets.push({
                        type: 'dm',
                        id: member._id, // User ID for new DM
                        label: member.username,
                        isNewDM: true // Flag to indicate this is a user ID, not DM session ID
                    });
                }
            });
        }

        // Pass all selected targets to parent handler
        onForward(targets);
    };

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-800 w-96 rounded-xl shadow-2xl flex flex-col max-h-[80vh] border border-gray-100 dark:border-gray-700">

                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-bold text-gray-800 dark:text-white">Forward message to...</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 dark:border-gray-700">
                    <button
                        onClick={() => setActiveTab('channels')}
                        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'channels'
                            ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700'
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Hash size={16} />
                            Channels
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('dms')}
                        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'dms'
                            ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700'
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <User size={16} />
                            Direct Messages
                        </div>
                    </button>
                </div>

                {/* Search */}
                <div className="p-3 border-b border-gray-100 dark:border-gray-700">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder={activeTab === 'channels' ? "Search channels..." : "Search people..."}
                            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-900 dark:text-white"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-[200px]">
                    {loading ? (
                        <div className="text-center py-8 text-gray-400 text-sm">
                            Loading...
                        </div>
                    ) : activeTab === 'channels' ? (
                        // Channels list
                        filteredChannels.length > 0 ? (
                            filteredChannels.map(channel => {
                                const isSelected = selectedItems.has(channel.id);
                                return (
                                    <button
                                        key={channel.id}
                                        onClick={() => toggleSelection(channel)}
                                        className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${isSelected
                                            ? "bg-blue-50 border border-blue-200"
                                            : "hover:bg-gray-50 dark:hover:bg-slate-700/50 border border-transparent"
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => { }}
                                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                        />
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs bg-gray-700">
                                            <Hash size={14} />
                                        </div>
                                        <div className="text-left flex-1">
                                            <div className="text-sm font-medium text-gray-900 dark:text-white">{channel.label}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">Channel</div>
                                        </div>
                                    </button>
                                );
                            })
                        ) : (
                            <div className="text-center py-8 text-gray-400 text-sm">
                                No channels found
                            </div>
                        )
                    ) : (
                        // DMs list (workspace members)
                        filteredDMs.length > 0 ? (
                            filteredDMs.map(member => {
                                const isSelected = selectedItems.has(member._id);
                                return (
                                    <button
                                        key={member._id}
                                        onClick={() => toggleSelection(member)}
                                        className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${isSelected
                                            ? "bg-blue-50 border border-blue-200"
                                            : "hover:bg-gray-50 border border-transparent"
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => { }}
                                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                        />
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs bg-blue-500">
                                            {member.profilePicture ? (
                                                <img src={member.profilePicture} alt={member.username} className="w-full h-full rounded-full object-cover" />
                                            ) : (
                                                <User size={14} />
                                            )}
                                        </div>
                                        <div className="text-left flex-1">
                                            <div className="text-sm font-medium text-gray-900 dark:text-white">{member.username}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">{member.email}</div>
                                        </div>
                                    </button>
                                );
                            })
                        ) : (
                            <div className="text-center py-8 text-gray-400 text-sm">
                                {loading ? "Loading..." : "No members found"}
                            </div>
                        )
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        {selectedItems.size > 0 && `${selectedItems.size} selected`}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleForward}
                            disabled={selectedItems.size === 0}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            Forward to {selectedItems.size || '...'}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
