import React from 'react';
import { useNavigate } from 'react-router-dom';

const CreateChannelModal = ({
    showCreateChannelModal,
    setShowCreateChannelModal,
    newChannelData,
    setNewChannelData,
    createStep,
    setCreateStep,
    selectedChannelMembers,
    setSelectedChannelMembers,
    MOCK_USERS,
    addItem
}) => {
    const navigate = useNavigate();

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
            path: `/channel/${channelId}`,
            isFavorite: false,
            isPrivate: newChannelData.isPrivate,
        };

        addItem(newChannel);
        navigate(`/channel/${channelId}`);

        // Reset
        setShowCreateChannelModal(false);
        setNewChannelData({ name: "", description: "", isPrivate: false });
        setCreateStep(1);
        setSelectedChannelMembers([]);
    };

    if (!showCreateChannelModal) return null;

    return (
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
    );
};

const NewDMModal = ({
    showNewDMModal,
    setShowNewDMModal,
    MOCK_USERS,
    handleStartDM
}) => {
    if (!showNewDMModal) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center animate-fade-in backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-[500px] h-[600px] flex flex-col overflow-hidden transform transition-all scale-100 border border-gray-100">
                <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-gray-900">New Message</h3>
                    <button onClick={() => setShowNewDMModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>
                <div className="p-4 border-b border-gray-100">
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                        <input type="text" placeholder="Search for people..." className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" autoFocus />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                    <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wide">Suggested</div>
                    {MOCK_USERS.map((user, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 hover:bg-blue-50 rounded-xl cursor-pointer transition-colors group">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold shadow-sm">
                                {user.name.charAt(0)}
                            </div>
                            <div className="flex-1">
                                <div className="font-bold text-gray-900">{user.name}</div>
                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                    <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                                    {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                                </div>
                            </div>
                            <button
                                onClick={() => handleStartDM(user)}
                                className="opacity-0 group-hover:opacity-100 px-3 py-1.5 bg-white border border-gray-200 text-blue-600 text-xs font-bold rounded-lg shadow-sm hover:bg-blue-50 transition-all transform active:scale-95"
                            >
                                Message
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export { CreateChannelModal, NewDMModal };
