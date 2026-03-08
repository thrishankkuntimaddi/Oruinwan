/**
 * PollMessage.jsx — WhatsApp-style Poll
 *
 * Features:
 *  • Single choice: selecting an option auto-submits immediately
 *  • Multiple choice: shows Submit button after selecting ≥1 option
 *  • Shows poll question, creator name, vote count
 *  • Per-option: vote percentage bar + count
 *  • Click a voted option to reveal voter names (non-anonymous polls)
 *  • Real-time vote updates via parent updating msg.poll
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BarChart2, Users, Clock, Lock, CheckCircle, Circle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../../../../services/api';

function formatDate(dateStr) {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });
}

export default function PollMessage({ msg, currentUserId }) {
    const poll = msg?.poll;
    const messageId = msg?._id || msg?.id;

    const [localPoll, setLocalPoll] = useState(poll);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState(null);
    // Which option's voter list is expanded (index or null)
    const [expandedVoters, setExpandedVoters] = useState(null);

    // Sync localPoll whenever the parent prop changes (e.g. from poll:vote_updated socket)
    useEffect(() => {
        if (poll) setLocalPoll(poll);
    }, [poll]);

    if (!localPoll) return null;

    const {
        question,
        options = [],
        allowMultiple = false,
        anonymous = false,
        endDate,
        isActive = true,
        totalVotes = 0,
        createdBy,
    } = localPoll;

    // Sender info — available at msg.sender (populated by backend)
    const creatorName = msg?.sender?.username || msg?.payload?.sender?.username || null;

    const isExpired = endDate ? new Date(endDate) < new Date() : false;
    const closed = !isActive || isExpired;

    // Determine which options the current user has already voted on (from server)
    const userIdStr = currentUserId?.toString();
    const userVotedIndices = useMemo(() =>
        options.reduce((acc, opt, i) => {
            const voted = opt.votes?.some(v =>
                (v._id?.toString() || v?.toString()) === userIdStr
            );
            if (voted) acc.push(i);
            return acc;
        }, []),
        [options, userIdStr]
    );
    const hasVoted = userVotedIndices.length > 0;
    // canVote: allow re-voting even after already voted (not closed, not mid-request)
    const canVote = !closed && !pending;

    // Compute vote stats per option
    const optionsWithStats = useMemo(() =>
        options.map((opt, i) => {
            const count = opt.votes?.length || 0;
            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            // Voter names from populated votes (if non-anonymous)
            const voterNames = !anonymous
                ? (opt.votes || []).map(v => v.username || v.name || '?')
                : [];
            return { ...opt, voteCount: count, percentage: pct, index: i, voterNames };
        }),
        [options, totalVotes, anonymous]
    );

    // Submit vote (called directly or after selecting in single-choice)
    const submitVote = useCallback(async (indices) => {
        if (!indices) return;
        setPending(true);
        setError(null);
        try {
            const { data } = await api.post(`/api/v2/messages/${messageId}/vote`, {
                optionIndices: indices,
            });
            setLocalPoll(data.message?.poll || localPoll);
        } catch (err) {
            setError(err?.response?.data?.message || 'Vote failed. Try again.');
        } finally {
            setPending(false);
        }
    }, [messageId, localPoll]);

    // Handle option click — supports re-voting, vote removal, and instant multi-select
    const handleOptionClick = useCallback((idx) => {
        if (!canVote) return;

        // Both single and multiple choice: compute new vote set and submit immediately
        // For single: toggle off if same, switch if different
        // For multiple: toggle this option in/out of the current voted set
        const alreadyVotedHere = userVotedIndices.includes(idx);

        let newIndices;
        if (!allowMultiple) {
            // Single choice: toggle off → [], or switch → [idx]
            newIndices = alreadyVotedHere ? [] : [idx];
        } else {
            // Multiple choice: toggle this option in/out
            newIndices = alreadyVotedHere
                ? userVotedIndices.filter(i => i !== idx)
                : [...userVotedIndices, idx];
        }

        submitVote(newIndices);
    }, [canVote, allowMultiple, userVotedIndices, submitVote]);

    const toggleVotersList = (idx) => {
        setExpandedVoters(prev => prev === idx ? null : idx);
    };

    const showResults = hasVoted || closed;

    return (
        <div className="mt-1 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden max-w-sm shadow-sm">
            {/* Creator Badge + Poll Label */}
            <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                <div className="w-7 h-7 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center flex-shrink-0">
                    <BarChart2 size={14} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {creatorName && (
                            <span className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">
                                {creatorName}
                            </span>
                        )}
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 uppercase tracking-wide whitespace-nowrap">
                            {allowMultiple ? 'Multiple Choice' : 'Single Choice'} Poll
                        </span>
                    </div>
                </div>
            </div>

            {/* Question */}
            <div className="px-4 pt-1 pb-2">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug">
                    {question}
                </h3>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                    <span className="flex items-center gap-1">
                        <Users size={10} />
                        {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
                    </span>
                    {endDate && (
                        <span className="flex items-center gap-1">
                            <Clock size={10} />
                            {isExpired ? 'Ended' : 'Ends'} {formatDate(endDate)}
                        </span>
                    )}
                    {anonymous && (
                        <span className="flex items-center gap-1">
                            <Lock size={10} />
                            Anonymous
                        </span>
                    )}
                    {closed && (
                        <span className="text-orange-500 dark:text-orange-400 font-semibold">Closed</span>
                    )}
                </div>
            </div>

            {/* Options */}
            <div className="px-3 pb-1 space-y-1.5">
                {optionsWithStats.map((opt) => {
                    const isUserVote = userVotedIndices.includes(opt.index);
                    const isExpanded = expandedVoters === opt.index;

                    return (
                        <div key={opt.index}>
                            <button
                                onClick={() => handleOptionClick(opt.index)}
                                disabled={pending || closed}
                                className={`w-full text-left rounded-xl border transition-all relative overflow-hidden
                                    ${closed
                                        ? 'cursor-not-allowed opacity-60'
                                        : 'cursor-pointer active:scale-[0.98]'
                                    }
                                    ${isUserVote
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                        : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-750 hover:border-blue-300 dark:hover:border-blue-600'
                                    }`}
                            >
                                {/* Progress bar behind */}
                                {showResults && opt.percentage > 0 && (
                                    <div
                                        className={`absolute left-0 top-0 bottom-0 rounded-xl transition-all duration-700 ease-out
                                            ${isUserVote
                                                ? 'bg-blue-200 dark:bg-blue-800/50'
                                                : 'bg-gray-200 dark:bg-gray-600/40'
                                            }`}
                                        style={{ width: `${opt.percentage}%` }}
                                    />
                                )}

                                <div className="relative z-10 flex items-center justify-between px-3 py-2.5">
                                    <div className="flex items-center gap-2 min-w-0">
                                        {/* Radio / Check indicator */}
                                        {!hasVoted && !closed ? (
                                            allowMultiple
                                                ? <div className="w-4 h-4 rounded border-2 border-gray-300 dark:border-gray-500 flex-shrink-0" />
                                                : <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-500 flex-shrink-0" />
                                        ) : isUserVote ? (
                                            <CheckCircle size={16} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                        ) : (
                                            <div className="w-4 h-4 flex-shrink-0" />
                                        )}
                                        <span className={`text-sm font-medium truncate
                                            ${isUserVote
                                                ? 'text-blue-700 dark:text-blue-300'
                                                : 'text-gray-800 dark:text-gray-200'
                                            }`}>
                                            {opt.text}
                                        </span>
                                    </div>

                                    {showResults && (
                                        <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                                            <span className={`text-xs font-bold tabular-nums
                                                ${isUserVote
                                                    ? 'text-blue-600 dark:text-blue-400'
                                                    : 'text-gray-500 dark:text-gray-400'
                                                }`}>
                                                {opt.percentage}%
                                            </span>
                                            <span className="text-[10px] text-gray-400">({opt.voteCount})</span>
                                            {!anonymous && opt.voteCount > 0 && (
                                                <div
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={(e) => { e.stopPropagation(); toggleVotersList(opt.index); }}
                                                    onKeyDown={(e) => e.key === 'Enter' && toggleVotersList(opt.index)}
                                                    className="p-0.5 hover:text-blue-500 transition-colors cursor-pointer"
                                                >
                                                    {isExpanded
                                                        ? <ChevronUp size={12} className="text-gray-400" />
                                                        : <ChevronDown size={12} className="text-gray-400" />
                                                    }
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </button>

                            {/* Voter names dropdown */}
                            {isExpanded && !anonymous && opt.voterNames.length > 0 && (
                                <div className="mt-1 ml-3 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600">
                                    <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                                        Voted by
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                        {opt.voterNames.map((name, i) => (
                                            <span
                                                key={i}
                                                className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium"
                                            >
                                                {name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>


            {/* Loading state */}
            {pending && (
                <div className="px-3 pb-3 pt-1 flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                    <Loader2 size={12} className="animate-spin" />
                    Submitting vote…
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="px-4 pb-3">
                    <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
                </div>
            )}

            {/* Footer: voted confirmation + hint */}
            <div className="px-4 pb-3 pt-0.5">
                {hasVoted && !closed && (
                    <p className="text-[11px] text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                        <CheckCircle size={10} />
                        You voted · Tap an option to see who voted
                    </p>
                )}
                {!hasVoted && !closed && (
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">
                        {allowMultiple ? 'Tap options to toggle your vote' : 'Tap an option to vote instantly'}
                    </p>
                )}
            </div>
        </div>
    );
}
