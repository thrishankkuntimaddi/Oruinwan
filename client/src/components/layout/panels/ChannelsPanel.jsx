import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { Plus, Hash, Search, Trash2, X, CheckSquare, Settings2 } from 'lucide-react';
import ConfirmationModal from "../../modals/ConfirmationModal";

const ChannelsPanel = ({ title }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { workspaceId } = useParams(); // Get current workspace ID
    const currentPath = location.pathname;

    const [searchQuery, setSearchQuery] = useState("");
    const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Selection Mode State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedItems, setSelectedItems] = useState(new Set());

    // Channel Creation State 
    const [newChannelData, setNewChannelData] = useState({ name: "", description: "", isPrivate: false });
    const [createStep, setCreateStep] = useState(1);
    const [selectedChannelMembers, setSelectedChannelMembers] = useState([]);

    const MOCK_USERS = [
        { id: 'u1', name: 'Sarah Connor', status: 'online' },
        { id: 'u2', name: 'Thrishank', status: 'away' },
        { id: 'u3', name: 'Alice Smith', status: 'online' },
        { id: 'u4', name: 'Mike Ross', status: 'offline' },
        { id: 'u5', name: 'Rachel Zane', status: 'busy' },
        { id: 'u6', name: 'Harvey Specter', status: 'online' },
        { id: 'u7', name: 'Donna Paulsen', status: 'online' },
    ];

    // Real channels from backend - filtered by workspace
    const [items, setItems] = useState([]);
    const [isLoadingChannels, setIsLoadingChannels] = useState(true);

    // Fetch workspace-specific channels
    useEffect(() => {
        const fetchChannels = async () => {
            if (!workspaceId) {
                console.log('⚠️ No workspace ID available');
                return;
            }

            try {
                setIsLoadingChannels(true);
                const token = localStorage.getItem('accessToken');

                if (!token) {
                    console.error('No access token');
                    return;
                }

                console.log('📡 Fetching channels for workspace:', workspaceId);

                const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/api/channels/my`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) throw new Error('Failed to fetch channels');

                const data = await response.json();
                console.log('📋 All channels received:', data.channels);

                // Filter channels by current workspace
                const workspaceChannels = data.channels
                    .filter(ch => ch.workspace && ch.workspace.toString() === workspaceId)
                    .map(ch => ({
                        id: ch._id,
                        type: 'channel',
                        label: ch.name,
                        path: `/workspace/${workspaceId}/channels/${ch._id}`,
                        isFavorite: ch.isDefault || false,
                        isPrivate: ch.isPrivate || false,
                        description: ch.description || ''
                    }));

                console.log(`✅ Filtered ${workspaceChannels.length} channels for workspace ${workspaceId}`);
                setItems(workspaceChannels);
                setIsLoadingChannels(false);
            } catch (err) {
                console.error('Error fetching channels:', err);
                setIsLoadingChannels(false);
            }
        };

        fetchChannels();
    }, [workspaceId]);

    const handleCreateChannel = () => {
        if (!newChannelData.name) return;

        if (newChannelData.isPrivate && createStep === 1) {
            setCreateStep(2);
            return;
        }

        const channelId = newChannelData.name.toLowerCase().replace(/\s+/g, '-');
        const newChannel = {
            id: channelId,
            type: 'channel',
            label: newChannelData.name.toLowerCase().replace(/\s+/g, '-'),
            path: `/ channels / ${channelId} `,
            isFavorite: false,
            isPrivate: newChannelData.isPrivate,
        };

        setItems(prev => [...prev, newChannel]);
        navigate(`/ channels / ${channelId} `);

        // Reset
        setShowCreateChannelModal(false);
        setNewChannelData({ name: "", description: "", isPrivate: false });
        setCreateStep(1);
        setSelectedChannelMembers([]);
    };

    const handleDeleteSelected = () => {
        setItems(prev => prev.filter(i => !selectedItems.has(i.id)));
        setSelectedItems(new Set());
        setIsSelectionMode(false);
        setShowDeleteConfirm(false);
    };

    const filteredChannels = items.filter(item =>
        item.type === 'channel' &&
        item.label.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const Item = ({ item }) => {
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
                // Call global openChat function
                if (window.openChat) {
                    window.openChat(item);
                }
            }
        };

        return (
            <div
                onClick={handleClick}
                className={`px-4 py-2 mx-2 rounded-md cursor-pointer flex items-center justify-between group transition-colors ${isSelectionMode && isSelected
                        ? "bg-blue-50 border border-blue-200"
                        : "hover:bg-gray-200 text-gray-600 hover:text-gray-900"
                    }`}
            >
                <div className="flex items-center truncate flex-1 gap-2">
                    {isSelectionMode && (
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? "bg-blue-600 border-blue-600" : "border-gray-300 bg-white"
                            }`}>
                            {isSelected && <CheckSquare size={10} className="text-white" />}
                        </div>
                    )}
                    <span className="opacity-70 text-lg">#</span>
                    <span className="truncate text-sm">{item.label}</span>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-gray-50/50 border-r border-gray-200">
            {/* Header */}
            <div className="h-16 border-b border-gray-200 flex items-center justify-between px-5 bg-white shrink-0">
                <h2 className="font-bold text-xl text-gray-800 tracking-tight flex items-center gap-2">
                    <Hash className="text-blue-600" size={20} />
                    Channels
                </h2>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setIsSelectionMode(!isSelectionMode)}
                        className={`p - 2 text - gray - 400 hover: text - blue - 600 hover: bg - blue - 50 rounded - lg transition - colors ${isSelectionMode ? "bg-blue-100 text-blue-600" : ""} `}
                        title="Manage Channels"
                    >
                        <Settings2 size={20} />
                    </button>
                    <button
                        onClick={() => setShowCreateChannelModal(true)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Create Channel"
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
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search channels..."
                        className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                </div>
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

            {/* Channel List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-4 space-y-0.5">
                <div className="px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">All Channels</div>
                {filteredChannels.length > 0 ? (
                    filteredChannels.map(item => (
                        <Item key={item.id} item={item} />
                    ))
                ) : (
                    <div className="px-4 py-8 text-center text-sm text-gray-500">
                        No channels found
                    </div>
                )}
            </div>

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDeleteSelected}
                title="Delete Channels?"
                message={`Are you sure you want to delete ${selectedItems.size} selected channel(s) ? This action cannot be undone.`}
                confirmText="Delete Channels"
            />

            {/* Create Channel Modal */}
            {showCreateChannelModal && (
                <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center animate-fade-in backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-[500px] overflow-hidden transform transition-all scale-100 border border-gray-100">
                        <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-900">
                                {createStep === 1 ? "Create New Channel" : "Add Members"}
                            </h3>
                            <button onClick={() => setShowCreateChannelModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>

                        {createStep === 1 ? (
                            <div className="p-8 space-y-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Channel Name</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">#</span>
                                        <input
                                            type="text"
                                            value={newChannelData.name}
                                            onChange={(e) => setNewChannelData({ ...newChannelData, name: e.target.value })}
                                            placeholder="e.g. marketing-updates"
                                            className="w-full pl-8 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                                            autoFocus
                                        />
                                    </div>
                                    <p className="text-xs text-gray-400 mt-2">Channels are where your team communicates. They're best when organized around a topic.</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Description <span className="text-gray-300 font-normal">(Optional)</span></label>
                                    <input
                                        type="text"
                                        value={newChannelData.description}
                                        onChange={(e) => setNewChannelData({ ...newChannelData, description: e.target.value })}
                                        placeholder="What's this channel about?"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="flex items-center cursor-pointer group p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={newChannelData.isPrivate}
                                                onChange={(e) => setNewChannelData({ ...newChannelData, isPrivate: e.target.checked })}
                                            />
                                            <div className="w-10 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                        </div>
                                        <div className="ml-3">
                                            <span className="block text-sm font-bold text-gray-900">Make Private</span>
                                            <span className="block text-xs text-gray-500">Only invited members can view this channel.</span>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        ) : (
                            <div className="p-0">
                                <div className="p-4 bg-blue-50 border-b border-blue-100 text-sm text-blue-800 flex items-center gap-2">
                                    <span>#</span>
                                    <span>Adding members to <strong>#{newChannelData.name}</strong></span>
                                </div>
                                <div className="max-h-[300px] overflow-y-auto p-2">
                                    {MOCK_USERS.map(user => (
                                        <label key={user.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl cursor-pointer transition-colors">
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                                    checked={selectedChannelMembers.includes(user.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedChannelMembers([...selectedChannelMembers, user.id]);
                                                        } else {
                                                            setSelectedChannelMembers(selectedChannelMembers.filter(id => id !== user.id));
                                                        }
                                                    }}
                                                />
                                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                                                    {user.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-gray-900">{user.name}</div>
                                                    <div className="text-xs text-gray-500">Member</div>
                                                </div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="px-8 py-5 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                            <button onClick={() => setShowCreateChannelModal(false)} className="px-6 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-xl transition-colors">Cancel</button>
                            <button
                                onClick={handleCreateChannel}
                                disabled={!newChannelData.name}
                                className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md hover:shadow-lg transition-all transform active:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {createStep === 1 && newChannelData.isPrivate ? "Next: Add Members" : "Create Channel"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChannelsPanel;
