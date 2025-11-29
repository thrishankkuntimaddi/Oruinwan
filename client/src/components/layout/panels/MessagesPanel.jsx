import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Plus, Search, MessageCircle, Megaphone } from "lucide-react";
import NewDMModal from "../../messagesComp/NewDMModal";
import BroadcastModal from "../../messagesComp/BroadcastModal";

const MessagesPanel = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [filter, setFilter] = useState("all"); // all, unread
    const [showNewDM, setShowNewDM] = useState(false);
    const [showBroadcast, setShowBroadcast] = useState(false);
    const [broadcasts, setBroadcasts] = useState([]);

    // Extract active user from URL
    // Assumes route is /messages/dm/:username
    const activeId = location.pathname.split("/").pop();

    const contacts = [
        { id: 1, name: "Sarah Connor", status: "online", unread: 0 },
        { id: 2, name: "John Doe", status: "offline", unread: 0 },
        { id: 3, name: "Alice Smith", status: "online", unread: 0 },
        { id: 4, name: "Bob Wilson", status: "busy", unread: 0 },
    ];

    const displayList = [...broadcasts, ...contacts];

    const handleStartDM = (user) => {
        setShowNewDM(false);
        navigate(`/messages/dm/${user.username}`);
    };

    const handleBroadcast = () => {
        setShowBroadcast(true);
    };

    const handleSendBroadcast = (recipients, message) => {
        const newBroadcast = {
            id: `broadcast-${Date.now()}`,
            name: `Broadcast (${recipients.length})`,
            recipients: recipients,
            lastMessage: message,
            unread: 0,
            type: "broadcast",
            status: "online"
        };
        setBroadcasts([newBroadcast, ...broadcasts]);
        setShowBroadcast(false);
    };

    return (
        <div className="flex flex-col h-full bg-gray-50/50 border-r border-gray-200">
            {/* Header */}
            <div className="h-16 border-b border-gray-200 flex items-center justify-between px-5 bg-white shrink-0">
                <h2 className="font-bold text-xl text-gray-800 tracking-tight flex items-center gap-2">
                    <MessageCircle className="text-blue-600" size={20} />
                    Messages
                </h2>
                <button
                    onClick={() => setShowNewDM(true)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="New Message"
                >
                    <Plus size={20} />
                </button>
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

            {/* Contact List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-3 space-y-1">
                <div className="px-2 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Recent Conversations</div>

                {displayList.map((item) => {
                    const isActive = decodeURIComponent(activeId) === item.name;
                    const isBroadcast = item.type === "broadcast";

                    return (
                        <div
                            key={item.id}
                            onClick={() => navigate(item.type === "broadcast" ? `/messages/broadcast/${item.id}` : `/messages/dm/${item.name}`, { state: { broadcast: item } })}
                            className={`group p-2 rounded-xl cursor-pointer flex items-center justify-between border transition-all duration-200
                                ${isActive
                                    ? "bg-blue-50 border-blue-200 shadow-sm"
                                    : "hover:bg-white hover:shadow-sm border-transparent hover:border-gray-100"
                                }`}
                        >
                            <div className="flex items-center gap-2.5">
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

                            {item.unread > 0 && (
                                <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-[10px] text-white font-bold shadow-sm shadow-blue-500/30">
                                    {item.unread}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* New DM Modal */}
            {showNewDM && (
                <NewDMModal
                    onClose={() => setShowNewDM(false)}
                    onStart={handleStartDM}
                />
            )}

            {/* Broadcast Modal */}
            {showBroadcast && (
                <BroadcastModal
                    onClose={() => setShowBroadcast(false)}
                    onSendBroadcast={handleSendBroadcast}
                />
            )}
        </div>
    );
};

export default MessagesPanel;
