import React from 'react';
import { BarChart3, Trash2, CheckCircle2 } from 'lucide-react';

/**
 * Poll Card Component
 * Displays a poll with voting functionality and results
 */
export default function PollCard({ poll, currentUserId, onVote, onDelete, isChannelAdmin }) {
    if (!poll) return null;

    const { question, options = [], type, createdBy, _id: pollId, isActive = true, totalVotes = 0 } = poll;
    const isSingleChoice = type === 'single';

    // Calculate if current user has voted and which options
    const userVotedOptions = options
        .filter(opt => opt.votes?.some(voteId =>
            voteId.toString() === currentUserId?.toString() ||
            voteId._id?.toString() === currentUserId?.toString()
        ))
        .map(opt => opt._id.toString());

    const hasVoted = userVotedOptions.length > 0;

    // Calculate percentages for each option
    const optionsWithPercentage = options.map(opt => {
        const voteCount = opt.votes?.length || 0;
        const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
        return {
            ...opt,
            voteCount,
            percentage
        };
    });

    // Check if user can delete (creator or admin)
    const canDelete = isChannelAdmin || createdBy?._id?.toString() === currentUserId?.toString();

    // Handle voting
    const handleVote = (optionId) => {
        if (!isActive) return;

        const optionIdStr = optionId.toString();

        if (isSingleChoice) {
            // Single choice: vote for this option only
            onVote(pollId, [optionIdStr]);
        } else {
            // Multiple choice: toggle this option
            const newVotes = userVotedOptions.includes(optionIdStr)
                ? userVotedOptions.filter(id => id !== optionIdStr) // Remove if already voted
                : [...userVotedOptions, optionIdStr]; // Add if not voted

            if (newVotes.length > 0) {
                onVote(pollId, newVotes);
            }
        }
    };

    return (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700/30 my-2">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                    <BarChart3 size={18} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                        {isSingleChoice ? 'Single Choice Poll' : 'Multiple Choice Poll'}
                    </span>
                </div>

                {canDelete && (
                    <button
                        onClick={() => onDelete(pollId)}
                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                        title="Delete poll"
                    >
                        <Trash2 size={16} className="text-gray-400 hover:text-red-500" />
                    </button>
                )}
            </div>

            {/* Question */}
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
                {question}
            </h3>

            {/* Options */}
            <div className="space-y-2">
                {optionsWithPercentage.map((option) => {
                    const isSelected = userVotedOptions.includes(option._id.toString());
                    const showResults = hasVoted || !isActive;

                    return (
                        <button
                            key={option._id}
                            onClick={() => handleVote(option._id)}
                            disabled={!isActive}
                            className={`w-full text-left px-3 py-2.5 rounded-lg transition-all relative overflow-hidden ${isActive ? 'cursor-pointer hover:shadow-sm' : 'cursor-not-allowed opacity-75'
                                } ${isSelected
                                    ? 'bg-blue-600 dark:bg-blue-500 text-white border-2 border-blue-700'
                                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 hover:border-blue-400'
                                }`}
                        >
                            {/* Progress bar background (only show after voting) */}
                            {showResults && option.percentage > 0 && (
                                <div
                                    className={`absolute inset-0 ${isSelected ? 'bg-blue-700 dark:bg-blue-600' : 'bg-blue-100 dark:bg-blue-900/40'
                                        } transition-all duration-500`}
                                    style={{ width: `${option.percentage}%` }}
                                />
                            )}

                            {/* Option content */}
                            <div className="relative z-10 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {/* Radio/Checkbox indicator */}
                                    <div
                                        className={`w-4 h-4 rounded-${isSingleChoice ? 'full' : 'sm'} border-2 flex items-center justify-center ${isSelected
                                                ? 'bg-white border-white'
                                                : 'bg-transparent border-gray-400 dark:border-gray-500'
                                            }`}
                                    >
                                        {isSelected && (
                                            <CheckCircle2 size={12} className="text-blue-600" />
                                        )}
                                    </div>

                                    <span className="font-medium">{option.text}</span>
                                </div>

                                {/* Show percentage and vote count after voting */}
                                {showResults && (
                                    <div className="flex items-center gap-2">
                                        <span className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                                            {option.percentage}%
                                        </span>
                                        <span className={`text-xs ${isSelected ? 'text-blue-100' : 'text-gray-500 dark:text-gray-500'}`}>
                                            ({option.voteCount})
                                        </span>
                                    </div>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Footer - Vote count and creator */}
            <div className="mt-3 pt-3 border-t border-blue-200/50 dark:border-blue-700/30 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                <span>
                    {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
                </span>

                <div className="flex items-center gap-3">
                    {!isActive && (
                        <span className="text-orange-600 dark:text-orange-400 font-medium">
                            Poll closed
                        </span>
                    )}

                    {createdBy && (
                        <span>
                            by {createdBy.username || 'Unknown'}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
