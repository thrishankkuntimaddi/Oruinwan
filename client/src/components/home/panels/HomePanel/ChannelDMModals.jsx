import React, { useState } from 'react';
import CreateChannelModal from '../../../messagesComp/CreateChannelModal';
import { getAvatarUrl } from '../../../../utils/avatarUtils';

const NewDMModal = ({
    showNewDMModal,
    setShowNewDMModal,
    workspaceMembers,
    handleStartDM
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    if (!showNewDMModal) return null;

    const filtered = (workspaceMembers || []).filter(m => {
        const q = searchQuery.toLowerCase();
        return (m.username || m.name || '').toLowerCase().includes(q)
            || (m.email || '').toLowerCase().includes(q);
    });

    return (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center animate-fade-in backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-[520px] max-h-[640px] flex flex-col overflow-hidden border border-gray-100 dark:border-gray-700/50">

                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">New Message</h3>
                        <p className="text-xs text-gray-400 mt-0.5">Start a direct conversation</p>
                    </div>
                    <button
                        onClick={() => setShowNewDMModal(false)}
                        className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-all"
                    >
                        ✕
                    </button>
                </div>

                {/* Search */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                    <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                        <input
                            type="text"
                            placeholder="Search for people..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-gray-900 dark:text-white placeholder-gray-400"
                            autoFocus
                        />
                    </div>
                </div>

                {/* User List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                            <div className="text-3xl mb-2">👥</div>
                            <p className="text-sm font-medium">No members found</p>
                        </div>
                    ) : (
                        <div className="p-3">
                            <div className="px-2 py-1.5 mb-1 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                Workspace Members
                            </div>
                            <div className="space-y-1">
                                {filtered.map((member) => {
                                    const displayName = member.name || member.username || 'Unknown';
                                    const isOnline = member.status === 'online';
                                    const about = member.profile?.about || member.about || '';
                                    return (
                                        <div
                                            key={member._id}
                                            onClick={() => handleStartDM(member)}
                                            className="flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl cursor-pointer transition-all group"
                                        >
                                            {/* Avatar */}
                                            <div className="relative flex-shrink-0">
                                                <img
                                                    src={getAvatarUrl(member)}
                                                    alt={displayName}
                                                    className="w-11 h-11 rounded-full object-cover shadow-sm ring-2 ring-white dark:ring-slate-900"
                                                    onError={(e) => {
                                                        e.target.src = getAvatarUrl({ username: displayName });
                                                    }}
                                                />
                                                <span
                                                    className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
                                                        isOnline ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                                                    }`}
                                                />
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                                                        {displayName}
                                                    </span>
                                                    {member.role === 'owner' && (
                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full flex-shrink-0">
                                                            Owner
                                                        </span>
                                                    )}
                                                    {member.role === 'admin' && (
                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full flex-shrink-0">
                                                            Admin
                                                        </span>
                                                    )}
                                                </div>
                                                {member.email && (
                                                    <div className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                                                        {member.email}
                                                    </div>
                                                )}
                                                {about && (
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5 italic">
                                                        {about}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Action */}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleStartDM(member); }}
                                                className="flex-shrink-0 opacity-0 group-hover:opacity-100 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all transform active:scale-95"
                                            >
                                                Message
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export { CreateChannelModal, NewDMModal };
