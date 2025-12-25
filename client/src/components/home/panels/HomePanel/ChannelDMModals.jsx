import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const CreateChannelModal = ({
    showCreateChannelModal,
    setShowCreateChannelModal,
    newChannelData,
    setNewChannelData,
    createStep,
    setCreateStep,
    selectedChannelMembers,
    setSelectedChannelMembers,
    workspaceMembers,
    addItem
}) => {
    const navigate = useNavigate();
    const { workspaceId } = useParams();

    const handleCreateChannel = async () => {
        if (!newChannelData.name) return;

        try {
            console.log('📡 Creating channel:', newChannelData.name);

            // Backend determines public/private based on members array
            // - undefined/empty array → PUBLIC (all workspace members)
            // - array with IDs → PRIVATE (only selected members + creator)
            const payload = {
                name: newChannelData.name,
                description: newChannelData.description,
                members: selectedChannelMembers.length > 0
                    ? selectedChannelMembers
                    : undefined // Backend will make it public
            };

            console.log('📦 Payload:', {
                ...payload,
                visibility: selectedChannelMembers.length > 0 ? 'PRIVATE' : 'PUBLIC'
            });

            // Import api at the top of the file
            const api = (await import('../../../../services/api')).default;

            // Call backend API
            const response = await api.post(`/api/workspaces/${workspaceId}/channels`, payload);

            const createdChannel = response.data.channel;
            console.log('✅ Channel created:', createdChannel);

            // Append real channel to list
            const newChannel = {
                id: createdChannel._id,
                type: 'channel',
                label: createdChannel.name,
                path: `/workspace/${workspaceId}/channel/${createdChannel._id}`,
                isFavorite: false,
                isPrivate: createdChannel.isPrivate,
                isDefault: false,
                description: createdChannel.description || '',
                canDelete: true,
                createdBy: createdChannel.createdBy
            };

            addItem(newChannel);

            // Navigate with workspace context
            navigate(`/workspace/${workspaceId}/channel/${createdChannel._id}`);

            // Reset
            setShowCreateChannelModal(false);
            setNewChannelData({ name: "", description: "", isPrivate: false });
            setCreateStep(1);
            setSelectedChannelMembers([]);
        } catch (err) {
            console.error('❌ Error creating channel:', err);
            alert(err.response?.data?.message || 'Failed to create channel');
        }
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

                        {/* ✨ Channel Visibility Info */}
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                            <h4 className="text-sm font-bold text-blue-900 mb-2">Channel Visibility</h4>
                            <div className="space-y-2 text-xs text-blue-800">
                                <p>
                                    <span className="font-bold">🌐 Public:</span> Skip member selection - all workspace members can view and join
                                </p>
                                <p>
                                    <span className="font-bold">🔒 Private:</span> Select specific members - only they can view and participate
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-0">
                        <div className="p-4 bg-blue-50 border-b border-blue-100 text-sm text-blue-800 flex items-center gap-2">
                            <span>#</span>
                            <span>Adding members to <strong>#{newChannelData.name}</strong> (Private Channel)</span>
                        </div>
                        <div className="max-h-[300px] overflow-y-auto p-2">
                            {workspaceMembers.map(member => (
                                <label key={member._id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl cursor-pointer transition-colors">
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                            checked={selectedChannelMembers.includes(member._id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedChannelMembers([...selectedChannelMembers, member._id]);
                                                } else {
                                                    setSelectedChannelMembers(selectedChannelMembers.filter(id => id !== member._id));
                                                }
                                            }}
                                        />
                                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                                            {(member?.name || member?.username || 'U').charAt(0)}
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-gray-900">{member?.name || member?.username || 'Unknown'}</div>
                                            <div className="text-xs text-gray-500">{member?.email || 'Member'}</div>
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                <div className="px-8 py-5 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                    <button onClick={() => setShowCreateChannelModal(false)} className="px-6 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-xl transition-colors">Cancel</button>

                    {createStep === 1 ? (
                        <>
                            <button
                                onClick={() => setCreateStep(2)}
                                disabled={!newChannelData.name}
                                className="px-6 py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Add Specific Members
                            </button>
                            <button
                                onClick={handleCreateChannel}
                                disabled={!newChannelData.name}
                                className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md hover:shadow-lg transition-all transform active:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Create Public Channel
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={handleCreateChannel}
                            disabled={!newChannelData.name}
                            className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md hover:shadow-lg transition-all transform active:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Create Private Channel
                        </button>
                    )}
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
