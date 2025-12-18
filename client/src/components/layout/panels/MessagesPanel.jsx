import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MessageCircle, Plus, Search, Trash2, X, Settings2, CheckSquare, Megaphone } from 'lucide-react';
import NewDMModal from "../../messagesComp/NewDMModal";
import BroadcastModal from "../../messagesComp/BroadcastModal";
import ConfirmationModal from "../../modals/ConfirmationModal";

const MessagesPanel = ({ title }) => {
    const navigate = useNavigate();
    const { workspaceId } = useParams();

    const [searchQuery, setSearchQuery] = useState("");
    const [showCreateDM, setShowCreateDM] = useState(false);
    const [showBroadcast, setShowBroadcast] = useState(false);
    const [broadcasts, setBroadcasts] = useState([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [filter, setFilter] = useState("all");

    // Selection Mode State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedItems, setSelectedItems] = useState(new Set());

    // Track active chat for selection highlighting
    const [activeChatId, setActiveChatId] = useState(null);

    // Listen for chat changes
    useEffect(() => {
        const handleChatChange = () => {
            const activeChat = sessionStorage.getItem('activeChat');
            if (activeChat) {
                const chat = JSON.parse(activeChat);
                setActiveChatId(chat.id);
            } else {
                setActiveChatId(null);
            }
        };

        // Check initial state
        handleChatChange();

        // Listen for changes
        window.addEventListener('chatChanged', handleChatChange);
        return () => window.removeEventListener('chatChanged', handleChatChange);
    }, []);

    // Extract active user from URL
    // Assumes route is /workspace/:workspaceId/messages/dm/:username
    // Note: The original code used `location.pathname.split("/").pop();` but `useLocation` was removed.
    // This line is kept as per the instruction, but `activeId` might need to be derived differently
    // or `useLocation` re-added if this variable is still needed and `activeChatId` doesn't replace its purpose.
    const activeId = null; // Placeholder as `location` is no longer imported.

    const [contacts, setContacts] = useState([
        { id: 1, name: "Sarah Connor", status: "online", unread: 0 },
        { id: 2, name: "Thrishank", status: "offline", unread: 0 },
        { id: 3, name: "Alice Smith", status: "online", unread: 0 },
        { id: 4, name: "Bob Wilson", status: "busy", unread: 0 },
    ]);

    const displayList = [...broadcasts, ...contacts];

    const handleStartDM = (user) => {
        setShowCreateDM(false);
        navigate(`/workspace/${workspaceId}/messages/dm/${user.username}`);
    };

    const handleBroadcast = () => {
        setShowBroadcast(true);
    };

    const handleCreateBroadcast = (data) => {
        const newBroadcast = {
            id: `b-${Date.now()}`,
            type: "broadcast",
            name: data.name,
            recipients: data.recipients,
            lastMessage: `Broadcast created with ${data.recipients.length} recipients`,
            unread: 0,
        };
        setBroadcasts((prev) => [newBroadcast, ...prev]);
        setShowBroadcast(false);
        navigate(`/workspace/${workspaceId}/messages/broadcast/${newBroadcast.id}`, { state: { broadcast: newBroadcast } });
    };

    const handleDeleteSelected = () => {
        setContacts(prev => prev.filter(c => !selectedItems.has(c.id)));
        setBroadcasts(prev => prev.filter(b => !selectedItems.has(b.id)));
        setSelectedItems(new Set());
        setIsSelectionMode(false);
        setShowDeleteConfirm(false);
    };

    return (
        <div className="flex flex-col h-full bg-gray-50/50 border-r border-gray-200">
            {/* Header */}
            <div className="h-16 border-b border-gray-200 flex items-center justify-between px-5 bg-white shrink-0">
                <h2 className="font-bold text-xl text-gray-800 tracking-tight flex items-center gap-2">
                    <MessageCircle className="text-blue-600" size={20} />
                    Messages
                </h2>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setIsSelectionMode(!isSelectionMode)}
                        className={`p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors ${isSelectionMode ? "bg-blue-100 text-blue-600" : ""}`}
                        title="Manage Messages"
                    >
                        <Settings2 size={20} />
                    </button>
                    <button
                        onClick={() => setShowCreateDM(true)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="New Message"
                    >
                        <Plus size={20} />
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="px-4 pt-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search messages..."
                        className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                </div>
            </div>

            {/* Filters & Broadcast */}
            <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex space-x-2">
                    <button
                        onClick={() => setFilter("all")}
                        className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors ${filter === "all" ? "bg-blue-100 text-blue-700" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilter("unread")}
                        className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors ${filter === "unread" ? "bg-blue-100 text-blue-700" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                    >
                        Unread
                    </button>
                </div>

                <button
                    onClick={handleBroadcast}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                    title="New Broadcast"
                >
                    <Megaphone size={16} />
                </button>
            </div>

            {/* Selection Mode Header */}
            {isSelectionMode && (
                <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between sticky top-0 z-10">
                    <span className="text-sm font-bold text-blue-900">{selectedItems.size} selected</span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            disabled={selectedItems.size === 0}
                            className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete Selected"
                        >
                            <Trash2 size={16} />
                        </button>
                        <button
                            onClick={() => {
                                setIsSelectionMode(false);
                                setSelectedItems(new Set());
                            }}
                            className="p-1.5 text-gray-600 hover:bg-gray-200 rounded-lg"
                            title="Cancel"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Contact List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-3 space-y-1">
                <div className="px-2 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Recent Conversations</div>

                {displayList.map((item) => {
                    const isActive = activeChatId === item.id;
                    const isBroadcast = item.type === "broadcast";
                    const isSelected = selectedItems.has(item.id);

                    const handleClick = (e) => {
                        if (isSelectionMode) {
                            e.stopPropagation();
                            const newSelected = new Set(selectedItems);
                            if (newSelected.has(item.id)) {
                                newSelected.delete(item.id);
                            } else {
                                newSelected.add(item.id);
                            }
                            setSelectedItems(newSelected);
                        } else {
                            // Call global openChat function to open chat in-place
                            if (window.openChat) {
                                window.openChat({
                                    id: item.id,
                                    type: item.type || 'dm',
                                    label: item.name,
                                    name: item.name
                                });
                            }
                        }
                    };

                    return (
                        <div
                            key={item.id}
                            onClick={handleClick}
                            className={`group p-2 rounded-xl cursor-pointer flex items-center justify-between border transition-all duration-200
                                ${isSelectionMode && isSelected ? "bg-blue-50 border-blue-200" :
                                    isActive
                                        ? "bg-blue-50 border-blue-200 shadow-sm"
                                        : "hover:bg-white hover:shadow-sm border-transparent hover:border-gray-100"
                                }`}
                        >
                            <div className="flex items-center gap-2.5">
                                {isSelectionMode && (
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? "bg-blue-600 border-blue-600" : "border-gray-300 bg-white"}`}>
                                        {isSelected && <CheckSquare size={10} className="text-white" />}
                                    </div>
                                )}
                                <div className="relative">
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shadow-inner
                                        ${isActive ? "bg-blue-200 text-blue-700" : isBroadcast ? "bg-purple-100 text-purple-600" : "bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-600"}
                                    `}>
                                        {isBroadcast ? <Megaphone size={14} /> : item.name.charAt(0)}
                                    </div>
                                    {!isBroadcast && (
                                        <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${item.status === "online" ? "bg-green-500" :
                                            item.status === "busy" ? "bg-red-500" : "bg-gray-400"
                                            }`}></div>
                                    )}
                                </div>
                                <div>
                                    <div className={`text-sm font-semibold ${isActive ? "text-blue-900" : "text-gray-900"}`}>{item.name}</div>
                                    <div className={`text-xs line-clamp-1 ${isActive ? "text-blue-600" : "text-gray-500 group-hover:text-gray-700"}`}>
                                        {isBroadcast ? `You: ${item.lastMessage}` : "You: Hey there!"}
                                    </div>
                                </div>
                            </div>

                            {item.unread > 0 && !isSelectionMode && (
                                <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-[10px] text-white font-bold shadow-sm shadow-blue-500/30">
                                    {item.unread}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDeleteSelected}
                title="Delete Conversations?"
                message={`Are you sure you want to delete ${selectedItems.size} selected conversation(s)? This action cannot be undone.`}
                confirmText="Delete Conversations"
            />

            {/* New DM Modal */}
            {showCreateDM && (
                <NewDMModal
                    onClose={() => setShowCreateDM(false)}
                    onStart={handleStartDM}
                />
            )}

            {/* Broadcast Modal */}
            {showBroadcast && (
                <BroadcastModal
                    isOpen={showBroadcast}
                    onClose={() => setShowBroadcast(false)}
                    onCreate={handleCreateBroadcast}
                />
            )}
        </div>
    );
};

export default MessagesPanel;
