import React from 'react';
import CreateChannelModal from '../../../messagesComp/CreateChannelModal';

const NewDMModal = ({
    showNewDMModal,
    setShowNewDMModal,
    workspaceMembers,
    handleStartDM
}) => {
    if (!showNewDMModal) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center animate-fade-in backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-[500px] h-[600px] flex flex-col overflow-hidden transform transition-all scale-100 border border-gray-100 dark:border-gray-700">
                <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">New Message</h3>
                    <button onClick={() => setShowNewDMModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
                </div>
                <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                        <input type="text" placeholder="Search for people..." className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900 dark:text-white placeholder-gray-400" autoFocus />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                    <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wide">Workspace Members</div>
                    {workspaceMembers.map((member) => (
                        <div key={member._id} className="flex items-center gap-3 p-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl cursor-pointer transition-colors group">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold shadow-sm">
                                {(member?.name || member?.username || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1">
                                <div className="font-bold text-gray-900 dark:text-gray-100">{member?.name || member?.username || 'Unknown'}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">{member?.email || ''}</div>
                            </div>
                            <button
                                onClick={() => handleStartDM(member)}
                                className="opacity-0 group-hover:opacity-100 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-lg shadow-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all transform active:scale-95"
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
