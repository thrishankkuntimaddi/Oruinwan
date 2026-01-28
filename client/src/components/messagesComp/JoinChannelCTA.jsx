import React, { useState } from 'react';
import { UserPlus, Hash, AlertCircle, Loader2 } from 'lucide-react';
import api from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';

/**
 * JoinChannelCTA Component
 * 
 * Shown when a non-member clicks a public discoverable channel.
 * Provides a button to self-join the channel via the backend endpoint.
 */
export default function JoinChannelCTA({ channel, onJoinSuccess }) {
    const [isJoining, setIsJoining] = useState(false);
    const [error, setError] = useState(null);
    const { showToast } = useToast();

    const handleJoin = async () => {
        setIsJoining(true);
        setError(null);

        try {
            await api.post(`/api/channels/${channel._id}/join-discoverable`);

            showToast(`Successfully joined #${channel.name}`, 'success');

            // Notify parent to refresh channel data
            if (onJoinSuccess) {
                onJoinSuccess();
            }
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Failed to join channel';
            const errorCode = err.response?.data?.code;

            setError(errorMessage);
            showToast(errorMessage, 'error');

            console.error('[JOIN_CTA] Error:', errorCode, errorMessage);
        } finally {
            setIsJoining(false);
        }
    };

    return (
        <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 p-8">
            <div className="max-w-md w-full text-center space-y-6">
                {/* Channel Icon */}
                <div className="flex justify-center">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                        <Hash size={36} className="text-white" strokeWidth={2.5} />
                    </div>
                </div>

                {/* Channel Name */}
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        #{channel.name}
                    </h2>
                    {channel.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {channel.description}
                        </p>
                    )}
                </div>

                {/* Message */}
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                        You are not a member of this channel. Join to start chatting and collaborating!
                    </p>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-3">
                        <AlertCircle size={20} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-700 dark:text-red-300 text-left">
                            {error}
                        </p>
                    </div>
                )}

                {/* Join Button */}
                <button
                    onClick={handleJoin}
                    disabled={isJoining}
                    className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all duration-200 flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:shadow-none"
                >
                    {isJoining ? (
                        <>
                            <Loader2 size={20} className="animate-spin" />
                            <span>Joining...</span>
                        </>
                    ) : (
                        <>
                            <UserPlus size={20} />
                            <span>Join Channel</span>
                        </>
                    )}
                </button>

                {/* Info */}
                <p className="text-xs text-gray-400 dark:text-gray-500">
                    This is a public discoverable channel. Anyone in the workspace can join.
                </p>
            </div>
        </div>
    );
}
