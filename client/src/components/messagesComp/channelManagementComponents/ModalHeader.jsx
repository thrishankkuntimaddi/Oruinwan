import React from 'react';
import { Lock, Users, X, Info } from 'lucide-react';

export default function ModalHeader({
    channel,
    members,
    onClose,
    activeTab,
    showDebugInfo,
    onToggleDebugInfo
}) {
    return (
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
            <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    {channel.isPrivate ? <Lock size={20} className="text-gray-500" /> : <Users size={20} className="text-gray-500" />}
                    {channel.name}
                </h3>
                <div className="flex flex-col gap-0.5 mt-1">
                    <p className="text-xs text-gray-500">{members.length} members • {channel.isPrivate ? "Private" : "Public"} Channel</p>
                    {channel.description && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 italic mt-1">{channel.description}</p>
                    )}
                    <p className="text-[10px] text-gray-400">
                        Created on {new Date(channel.createdAt || Date.now()).toLocaleDateString()} by {channel.creatorName || "Admin"}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                {/* Debug Info Toggle Button - Only show on Invite tab */}
                {activeTab === "invite" && (
                    <button
                        onClick={onToggleDebugInfo}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
                        title={showDebugInfo ? 'Hide Debug Info' : 'Show Debug Info'}
                    >
                        <Info size={20} />
                    </button>
                )}
                <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                    <X size={20} />
                </button>
            </div>
        </div>
    );
}
