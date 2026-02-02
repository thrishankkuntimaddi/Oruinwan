import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Plus, Search, Trash2, CheckSquare, Megaphone, Settings2, X } from "lucide-react";
import { useWorkspace } from "../../../contexts/WorkspaceContext";
import { useSocket } from "../../../contexts/SocketContext";
import { useToast } from "../../../contexts/ToastContext";
import { messageService } from "../../../services/messageService";
import NewDMModal from "../../messagesComp/NewDMModal";
import BroadcastModal from "../../messagesComp/BroadcastModal";
import ConfirmationModal from "../../../shared/components/ui/ConfirmationModal";
import api from "../../../services/api";

const MessagesPanel = ({ title }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { workspaceId, dmId, channelId } = useParams();
    const { activeWorkspace } = useWorkspace();
    const { showToast } = useToast();

    const [searchQuery, setSearchQuery] = useState("");
    const [showCreateDM, setShowCreateDM] = useState(false);
    const [showBroadcast, setShowBroadcast] = useState(false);
    const [broadcasts, setBroadcasts] = useState([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [filter, setFilter] = useState("all");

    // Selection Mode State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedItems, setSelectedItems] = useState(new Set());

    // ✅ CORRECT: Active chat derived from URL (single source of truth)
    const activeChatId = dmId || channelId || null;

    const [contacts, setContacts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const { socket } = useSocket();

    useEffect(() => {
        const loadDMs = async () => {
            if (!workspaceId) return;
            setIsLoading(true);
            try {
                const res = await api.get(`/api/messages/workspace/${workspaceId}/dms`);
                const formatted = (res.data.sessions || []).map(session => {
                    // Determine initial status
                    const user = session.otherUser;
                    let initialStatus = "offline";
                    if (user?.isOnline) {
                        initialStatus = user.userStatus || "active"; // active, away, dnd
                    }

                    return {
                        id: session.id,
                        userId: session.otherUser?._id || session.otherUser?.id, // Store User ID for socket updates
                        name: session.otherUser?.username || "User",
                        avatar: session.otherUser?.profilePicture,
                        status: initialStatus,
                        unread: session.unreadCount || 0,
                        lastMessage: session.lastMessage || "No messages yet",
                        type: "dm"
                    };
                });
                setContacts(formatted);
            } catch (err) {
                console.error("Failed to load DMs:", err);
            } finally {
                setIsLoading(false);
            }
        };

        loadDMs();
    }, [workspaceId, activeWorkspace?.currentUserId]);

    // Listen for status changes
    useEffect(() => {
        if (!socket) return;

        const handleStatusChange = ({ userId, status }) => {
            setContacts(prev => prev.map(contact => {
                // Check if this contact corresponds to the user who changed status
                if (String(contact.userId) === String(userId)) {
                    return { ...contact, status: status };
                }
                return contact;
            }));
        };

        socket.on("user-status-changed", handleStatusChange);

        return () => {
            socket.off("user-status-changed", handleStatusChange);
        };
    }, [socket]);

    const displayList = [...broadcasts, ...contacts];

    const filteredList = displayList.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = filter === "all" || (filter === "unread" && item.unread > 0);
        return matchesSearch && matchesFilter;
    });

    const handleStartDM = (selectedUser) => {
        setShowCreateDM(false);
        // Navigate to the "new" DM route with the target user's ID
        navigate(`/workspace/${workspaceId}/messages/dm/${selectedUser._id || selectedUser.id}`);
    };

    const handleBroadcast = () => {
        setShowBroadcast(true);
    };

    const handleSendBroadcast = async (selectedItems, message) => {
        try {
            // Separate users and channels
            const userRecipients = selectedItems.filter(item => item.type === 'dm' || item.type === 'member');
            const channelRecipients = selectedItems.filter(item => item.type === 'channel');

            const promises = [];

            // 1. Send to Users (DMs)
            if (userRecipients.length > 0) {
                const userIds = userRecipients.map(u => u.id); // Correctly extract 'id' property
                promises.push(messageService.sendBroadcast(workspaceId, userIds, message));
            }

            // 2. Send to Channels
            if (channelRecipients.length > 0) {
                const channelPromises = channelRecipients.map(ch =>
                    api.post('/api/messages/channel/send', {
                        channelId: ch.id,
                        text: message,
                        attachments: []
                    })
                );
                promises.push(...channelPromises);
            }

            await Promise.all(promises);

            showToast(`Broadcast sent to ${selectedItems.length} recipient(s) successfully!`, 'success');
            setShowBroadcast(false);

            // Optionally refresh DM list to show new conversations
            const res = await api.get(`/api/messages/workspace/${workspaceId}/dms`);
            const formatted = (res.data.sessions || []).map(session => {
                const user = session.otherUser;
                let initialStatus = "offline";
                if (user?.isOnline) {
                    initialStatus = user.userStatus || "active";
                }

                return {
                    id: session.id,
                    userId: session.otherUser?._id || session.otherUser?.id,
                    name: session.otherUser?.username || "User",
                    avatar: session.otherUser?.profilePicture,
                    status: initialStatus,
                    unread: session.unreadCount || 0,
                    lastMessage: session.lastMessage || "No messages yet",
                    type: "dm"
                };
            });
            setContacts(formatted);
        } catch (err) {
            console.error('Failed to send broadcast:', err);
            showToast('Failed to send broadcast. Please try again.', 'error');
            throw err; // Re-throw so BroadcastModal can handle it
        }
    };

    const handleDeleteSelected = () => {
        setContacts(prev => prev.filter(c => !selectedItems.has(c.id)));
        setBroadcasts(prev => prev.filter(b => !selectedItems.has(b.id)));
        setSelectedItems(new Set());
        setIsSelectionMode(false);
        setShowDeleteConfirm(false);
    };

    const Item = ({ item }) => {
        const isBroadcast = item.type === "broadcast";
        const isSelected = selectedItems.has(item.id);

        const isActive = activeChatId === item.id ||
            (isBroadcast && location.pathname.includes(`/broadcast/${item.id}`)) ||
            (!isBroadcast && location.pathname.includes(`/dm/${item.id}`));

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
                // ✅ CORRECT: Use React Router navigation only
                // Keep sidebar context: DMs from Messages panel should stay in Messages view
                const targetPath = isBroadcast
                    ? `/workspace/${workspaceId}/messages/broadcast/${item.id}`
                    : `/workspace/${workspaceId}/messages/dm/${item.id}`;

                navigate(targetPath);
            }
        };

        return (
            <div
                key={item.id}
                onClick={handleClick}
                className={`group p-2 rounded-xl cursor-pointer flex items-center justify-between border transition-all duration-200
                    ${isSelectionMode && isSelected ? "bg-blue-50 dark:bg-blue-900/40 border-blue-200 dark:border-blue-800" :
                        isActive
                            ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 shadow-sm"
                            : "hover:bg-white dark:hover:bg-gray-800 hover:shadow-sm border-transparent hover:border-gray-100 dark:hover:border-gray-700"
                    }`}
            >
                <div className="flex items-center gap-2.5 flex-1">
                    {isSelectionMode && (
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? "bg-blue-600 border-blue-600" : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                            }`}>
                            {isSelected && <CheckSquare size={10} className="text-white" />}
                        </div>
                    )}
                    <div className="relative">
                        {/* Dynamic avatar color based on user status - matching HomePanel style */}
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shadow-inner
                            ${isActive ? "bg-blue-200 text-blue-700 dark:bg-blue-800 dark:text-blue-200" :
                                item.status === "active" || item.status === "online"
                                    ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
                                    : item.status === "away"
                                        ? "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300"
                                        : item.status === "dnd" || item.status === "busy"
                                            ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
                                            : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                            }`}>
                            {isBroadcast ? <Megaphone size={14} /> : item.name.charAt(0).toUpperCase()}
                        </div>
                        {/* Status Indicator */}
                        {!isBroadcast && (
                            <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-900 ${item.status === "active" || item.status === "online" ? "bg-green-500" :
                                item.status === "away" ? "bg-yellow-500" :
                                    item.status === "dnd" || item.status === "busy" ? "bg-red-500" :
                                        "bg-gray-400"
                                }`}></div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className={`text-sm font-semibold truncate ${isActive ? "text-blue-900 dark:text-blue-100" : "text-gray-900 dark:text-gray-100"}`}>
                            {item.name}
                        </div>
                        <div className={`text-xs line-clamp-1 ${isActive ? "text-blue-600 dark:text-blue-300" : "text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300"}`}>
                            {item.lastMessage || "No messages yet"}
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
    };

    return (
        <div className="flex flex-col h-full bg-gray-50/50 dark:bg-gray-900">
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-5 bg-white dark:bg-gray-900 shrink-0 border-b border-gray-200 dark:border-gray-800">
                <h2 className="font-bold text-lg text-gray-800 dark:text-gray-100 tracking-tight">
                    Messages
                </h2>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setIsSelectionMode(!isSelectionMode)}
                        className={`p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors ${isSelectionMode ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600" : ""
                            }`}
                        title="Manage Messages"
                    >
                        <Settings2 size={20} />
                    </button>
                    <button
                        onClick={() => setShowCreateDM(true)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                        title="New Message"
                    >
                        <Plus size={20} />
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="px-4 pt-6">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search messages..."
                        className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                </div>
            </div>

            {/* Filters & Broadcast */}
            <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex space-x-2">
                    <button
                        onClick={() => setFilter("all")}
                        className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors ${filter === "all" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                            }`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilter("unread")}
                        className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors ${filter === "unread" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                            }`}
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
                <div className="px-2 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {activeWorkspace?.name || 'Workspace'} Conversations
                </div>

                {isLoading ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-500">Loading...</div>
                ) : filteredList.length > 0 ? (
                    filteredList.map((item) => <Item key={item.id} item={item} />)
                ) : (
                    <div className="px-4 py-8 text-center text-sm text-gray-500">
                        {searchQuery ? 'No conversations found' : 'No conversations yet'}
                    </div>
                )}
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
                    workspaceId={workspaceId}
                    onClose={() => setShowBroadcast(false)}
                    onSendBroadcast={handleSendBroadcast}
                />
            )}
        </div>
    );
};

export default MessagesPanel;
