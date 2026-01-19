import React, { useState, useMemo } from 'react';
import { CheckCircle, Circle, Users, Clock, Lock, BarChart2 } from 'lucide-react';

export default function PollMessage({ poll, onVote, currentUserId, formatTime }) {
    const [selectedOptions, setSelectedOptions] = useState([]);
    const [showVoters, setShowVoters] = useState(null);

    const hasVoted = useMemo(() => {
        return poll.votes && poll.votes[currentUserId];
    }, [poll.votes, currentUserId]);

    const userVotes = useMemo(() => {
        return poll.votes?.[currentUserId] || [];
    }, [poll.votes, currentUserId]);

    const isExpired = useMemo(() => {
        if (!poll.endDate) return false;
        return new Date(poll.endDate) < new Date();
    }, [poll.endDate]);

    const canVote = !hasVoted && !isExpired && poll.status === 'active';

    const handleOptionClick = (optionIndex) => {
        if (!canVote) return;

        if (poll.allowMultiple) {
            if (selectedOptions.includes(optionIndex)) {
                setSelectedOptions(selectedOptions.filter(i => i !== optionIndex));
            } else {
                setSelectedOptions([...selectedOptions, optionIndex]);
            }
        } else {
            setSelectedOptions([optionIndex]);
        }
    };

    const handleSubmitVote = () => {
        if (selectedOptions.length > 0) {
            onVote(poll.id, selectedOptions);
            setSelectedOptions([]);
        }
    };

    // Calculate percentages
    const optionsWithStats = useMemo(() => {
        const total = poll.totalVotes || 0;
        return poll.options.map((option, index) => ({
            ...option,
            percentage: total > 0 ? Math.round((option.count / total) * 100) : 0,
            isUserVote: userVotes.includes(index)
        }));
    }, [poll.options, poll.totalVotes, userVotes]);

    const maxVotes = Math.max(...optionsWithStats.map(o => o.count), 1);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 my-2">
            {/* Header */}
            <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    <BarChart2 size={20} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                        {poll.question}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                            <Users size={14} />
                            {poll.totalVotes || 0} {poll.totalVotes === 1 ? 'vote' : 'votes'}
                        </span>
                        {poll.endDate && (
                            <span className="flex items-center gap-1">
                                <Clock size={14} />
                                {isExpired ? 'Ended' : 'Ends'} {formatTime(poll.endDate)}
                            </span>
                        )}
                        {poll.anonymous && (
                            <span className="flex items-center gap-1">
                                <Lock size={14} />
                                Anonymous
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Options */}
            <div className="space-y-2">
                {optionsWithStats.map((option, index) => {
                    const isSelected = selectedOptions.includes(index);
                    const isWinning = option.count === maxVotes && option.count > 0;

                    return (
                        <div key={index}>
                            <button
                                onClick={() => handleOptionClick(index)}
                                disabled={!canVote}
                                className={`w-full text-left rounded-lg border transition-all ${canVote
                                        ? isSelected
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                                        : 'border-gray-200 dark:border-gray-700'
                                    } ${!canVote && 'cursor-default'}`}
                            >
                                {/* Option content */}
                                <div className="relative p-3">
                                    {/* Background bar for votes */}
                                    {hasVoted && (
                                        <div
                                            className={`absolute inset-0 rounded-lg transition-all ${isWinning
                                                    ? 'bg-green-100 dark:bg-green-900/20'
                                                    : 'bg-gray-100 dark:bg-gray-700/50'
                                                }`}
                                            style={{ width: `${option.percentage}%` }}
                                        />
                                    )}

                                    {/* Option text and icon */}
                                    <div className="relative flex items-center justify-between">
                                        <div className="flex items-center gap-3 flex-1">
                                            {canVote ? (
                                                isSelected ? (
                                                    <CheckCircle size={20} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                                ) : (
                                                    <Circle size={20} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                                                )
                                            ) : option.isUserVote ? (
                                                <CheckCircle size={20} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                            ) : (
                                                <div className="w-5" />
                                            )}
                                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                {option.text}
                                            </span>
                                        </div>

                                        {/* Vote count/percentage */}
                                        {hasVoted && (
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                    {option.percentage}%
                                                </span>
                                                {!poll.anonymous && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setShowVoters(showVoters === index ? null : index);
                                                        }}
                                                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                                    >
                                                        ({option.count})
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </button>

                            {/* Voter list (if not anonymous) */}
                            {!poll.anonymous && showVoters === index && option.votes && option.votes.length > 0 && (
                                <div className="mt-1 ml-8 p-2 bg-gray-50 dark:bg-gray-700/50 rounded text-xs text-gray-600 dark:text-gray-400">
                                    {option.votes.map((voter, i) => (
                                        <span key={i}>
                                            {voter.name || voter.username}
                                            {i < option.votes.length - 1 && ', '}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Vote button */}
            {canVote && selectedOptions.length > 0 && (
                <button
                    onClick={handleSubmitVote}
                    className="mt-4 w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                    Submit Vote
                </button>
            )}

            {/* Status messages */}
            {hasVoted && (
                <div className="mt-4 text-sm text-green-600 dark:text-green-400 font-medium">
                    ✓ You voted for: {userVotes.map(i => poll.options[i].text).join(', ')}
                </div>
            )}

            {isExpired && (
                <div className="mt-4 text-sm text-gray-500 dark:text-gray-400 font-medium">
                    This poll has ended
                </div>
            )}
        </div>
    );
}
