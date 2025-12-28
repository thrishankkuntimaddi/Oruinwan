import { useEffect, useState } from "react";
import { Search, X, Send, Users, Hash, MessageSquare } from "lucide-react";
import api from "../../services/api";

export default function BroadcastModal({ workspaceId, onClose, onSendBroadcast }) {
    const [activeTab, setActiveTab] = useState('dms'); // 'dms', 'channels', 'members'
    const [dmContacts, setDmContacts] = useState([]);
    const [channels, setChannels] = useState([]);
    const [members, setMembers] = useState([]);
    const [selectedItems, setSelectedItems] = useState([]);
    const [message, setMessage] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            if (!workspaceId) return;

            setLoading(true);
            try {
                // Fetch all workspace data in parallel
                const [dmsRes, channelsRes, membersRes] = await Promise.all([
                    api.get(`/api/messages/workspace/${workspaceId}/dms`),
                    api.get(`/api/workspaces/${workspaceId}/channels`),
                    api.get(`/api/workspaces/${workspaceId}/members`)
                ]);

                // Format DM contacts
                const dms = (dmsRes.data.sessions || []).map(session => ({
                    type: 'dm',
                    id: session.otherUser?._id,
                    name: session.otherUser?.username || 'Unknown',
                    avatar: session.otherUser?.profilePicture,
                    status: session.otherUser?.userStatus || 'offline'
                }));

                // Format channels
                const chans = (channelsRes.data.channels || []).map(ch => ({
                    type: 'channel',
                    id: ch._id,
                    name: ch.name,
                    isPrivate: ch.isPrivate
                }));

                // Format workspace members (exclude those already in DMs)
                const dmUserIds = new Set(dms.map(dm => dm.id));
                const mems = (membersRes.data.members || [])
                    .filter(m => !dmUserIds.has(m._id))
                    .map(m => ({
                        type: 'member',
                        id: m._id,
                        name: m.username,
                        avatar: m.profilePicture,
                        status: m.userStatus || 'offline'
                    }));

                setDmContacts(dms);
                setChannels(chans);
                setMembers(mems);
                setLoading(false);
            } catch (err) {
                console.error("Failed to load broadcast data:", err);
                setLoading(false);
            }
        }
        loadData();
    }, [workspaceId]);

    const toggleItem = (item) => {
        const exists = selectedItems.find(s => s.id === item.id && s.type === item.type);
        if (exists) {
            setSelectedItems(selectedItems.filter(s => !(s.id === item.id && s.type === item.type)));
        } else {
            setSelectedItems([...selectedItems, item]);
        }
    };

    const handleSend = () => {
        if (!message.trim() || selectedItems.length === 0) return;

        onSendBroadcast(selectedItems, message);
    };

    // Filter current tab items by search
    const getCurrentItems = () => {
        let items = activeTab === 'dms' ? dmContacts :
            activeTab === 'channels' ? channels : members;

        if (searchQuery) {
            items = items.filter(item =>
                item.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        return items;
    };

    const currentItems = getCurrentItems();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
            <div className="bg-white dark:bg-gray-800 w-full max-w-7xl h-[85vh] rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                            <Users className="text-blue-600 dark:text-blue-400" size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">New Broadcast</h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Send a message to multiple people at once</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <X size={20} className="text-gray-500 dark:text-gray-400" />
                    </button>
                </div>

                {/* Main Content - 2 Column Layout */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left Column - Contact Selection */}
                    <div className="w-96 border-r border-gray-200 dark:border-gray-700 flex flex-col">
                        {/* Horizontal Tabs */}
                        <div className="border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                            <div className="flex">
                                <button
                                    onClick={() => setActiveTab('dms')}
                                    className={`flex-1 px-3 py-4 text-xs font-medium transition-colors relative ${activeTab === 'dms'
                                        ? 'text-blue-600 dark:text-blue-400'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                        }`}
                                >
                                    <div className="flex items-center justify-center gap-1.5">
                                        <MessageSquare size={14} />
                                        <span>DMs</span>
                                        <span className="text-[10px] bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">
                                            {dmContacts.length}
                                        </span>
                                    </div>
                                    {activeTab === 'dms' && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"></div>
                                    )}
                                </button>

                                <button
                                    onClick={() => setActiveTab('channels')}
                                    className={`flex-1 px-3 py-4 text-xs font-medium transition-colors relative ${activeTab === 'channels'
                                        ? 'text-blue-600 dark:text-blue-400'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                        }`}
                                >
                                    <div className="flex items-center justify-center gap-1.5">
                                        <Hash size={14} />
                                        <span>Channels</span>
                                        <span className="text-[10px] bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">
                                            {channels.length}
                                        </span>
                                    </div>
                                    {activeTab === 'channels' && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"></div>
                                    )}
                                </button>

                                <button
                                    onClick={() => setActiveTab('members')}
                                    className={`flex-1 px-3 py-4 text-xs font-medium transition-colors relative ${activeTab === 'members'
                                        ? 'text-blue-600 dark:text-blue-400'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                        }`}
                                >
                                    <div className="flex items-center justify-center gap-1.5">
                                        <Users size={14} />
                                        <span>Members</span>
                                        <span className="text-[10px] bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">
                                            {members.length}
                                        </span>
                                    </div>
                                    {activeTab === 'members' && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"></div>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Search */}
                        <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                                />
                            </div>
                        </div>

                        {/* Contact List */}
                        <div className="flex-1 overflow-y-auto">
                            {loading ? (
                                <div className="flex items-center justify-center h-40">
                                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : currentItems.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-40 text-gray-500 dark:text-gray-400">
                                    <p className="text-sm">No {activeTab === 'dms' ? 'DMs' : activeTab === 'channels' ? 'channels' : 'members'} found</p>
                                </div>
                            ) : (
                                <div className="p-2">
                                    {currentItems.map((item) => {
                                        const isSelected = selectedItems.some(s => s.id === item.id && s.type === item.type);

                                        return (
                                            <button
                                                key={`${item.type}-${item.id}`}
                                                onClick={() => toggleItem(item)}
                                                className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg transition-colors ${isSelected
                                                    ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500'
                                                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 border-2 border-transparent'
                                                    }`}
                                            >
                                                {/* Avatar/Icon */}
                                                {item.type === 'channel' ? (
                                                    <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                                                        <Hash size={16} className="text-gray-600 dark:text-gray-400" />
                                                    </div>
                                                ) : (
                                                    <div className="relative flex-shrink-0">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${item.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' :
                                                            item.status === 'away' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' :
                                                                item.status === 'dnd' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                                                                    'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                                                            }`}>
                                                            {item.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        {/* Status dot */}
                                                        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-800 ${item.status === 'active' ? 'bg-green-500' :
                                                            item.status === 'away' ? 'bg-yellow-500' :
                                                                item.status === 'dnd' ? 'bg-red-500' :
                                                                    'bg-gray-400'
                                                            }`}></div>
                                                    </div>
                                                )}

                                                {/* Name */}
                                                <div className="flex-1 text-left min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                        {item.type === 'channel' && '# '}{item.name}
                                                    </p>
                                                </div>

                                                {/* Checkbox */}
                                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${isSelected
                                                    ? 'bg-blue-600 border-blue-600'
                                                    : 'border-gray-300 dark:border-gray-600'
                                                    }`}>
                                                    {isSelected && (
                                                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column - Message Area */}
                    <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900/50">
                        {/* Selected Recipients Header - Aligned with Tabs */}
                        <div className="border-b border-gray-200 dark:border-gray-700 flex-shrink-0 min-h-[61px] flex items-center px-4 bg-white dark:bg-gray-800">
                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                To:
                            </span>
                            {selectedItems.length === 0 ? (
                                <span className="ml-2 text-sm text-gray-400 dark:text-gray-500 italic">No recipients selected</span>
                            ) : (
                                <div className="flex flex-wrap gap-2 ml-2">
                                    {selectedItems.map(item => (
                                        <span
                                            key={`selected-${item.type}-${item.id}`}
                                            className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs"
                                        >
                                            {item.type === 'channel' && '# '}{item.name}
                                            <button
                                                onClick={() => toggleItem(item)}
                                                className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"
                                            >
                                                <X size={12} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Message Input */}
                        <div className="flex-1 p-4 flex flex-col">
                            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                                Your Message
                            </div>
                            <textarea
                                placeholder="Type your broadcast message here..."
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                className="flex-1 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                            />
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {selectedItems.length} recipient{selectedItems.length !== 1 ? 's' : ''} selected
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSend}
                                    disabled={!message.trim() || selectedItems.length === 0}
                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <Send size={16} />
                                    Send Broadcast
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
