/**
 * PollMessage.jsx — Phase 7.3
 *
 * Renders an embedded poll from msg.poll (inside MessageSchema).
 * No separate API fetch needed — data is embedded in the message.
 *
 * Props from ChannelMessageItem / DMMessageItem:
 *   msg           — full message object (msg.poll has the poll payload)
 *   currentUserId — for detecting which options the current user voted on
 *   onVote        — (optionIndices: number[]) => void
 */
import React, { useState, useMemo, useCallback } from 'react';
import { BarChart2, Users, Clock, Lock, CheckCircle, Circle, Loader2 } from 'lucide-react';
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
    // Pending selection before submitting
    const [selected, setSelected] = useState([]);

    if (!localPoll) return null;

    const {
        question,
        options = [],
        allowMultiple,
        anonymous,
        endDate,
        isActive = true,
        totalVotes = 0,
    } = localPoll;

    const isExpired = endDate ? new Date(endDate) < new Date() : false;
    const closed = !isActive || isExpired;

    // Determine which options the current user has voted on
    const userIdStr = currentUserId?.toString();
    const userVotedIndices = useMemo(
        () => options.reduce((acc, opt, i) => {
            const voted = opt.votes?.some(v =>
                (v._id?.toString() || v?.toString()) === userIdStr
            );
            if (voted) acc.push(i);
            return acc;
        }, []),
        [options, userIdStr]
    );
    const hasVoted = userVotedIndices.length > 0;
    const canVote = !closed && !pending;

    // Compute vote percentages
    const optionsWithStats = useMemo(() => {
        return options.map((opt, i) => {
            const count = opt.votes?.length || 0;
            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            return { ...opt, voteCount: count, percentage: pct, index: i };
        });
    }, [options, totalVotes]);

    const toggleSelect = useCallback((idx) => {
        if (!canVote) return;
        if (allowMultiple) {
            setSelected(prev =>
                prev.includes(idx)
                    ? prev.filter(i => i !== idx)
                    : [...prev, idx]
            );
        } else {
            setSelected([idx]);
        }
    }, [canVote, allowMultiple]);

    const submitVote = useCallback(async () => {
        if (selected.length === 0) return;
        setPending(true);
        setError(null);
        try {
            const { data } = await api.post(`/api/v2/messages/${messageId}/vote`, {
                optionIndices: selected,
            });
            // Update local state from server response (includes updated votes)
            setLocalPoll(data.message?.poll || localPoll);
            setSelected([]);
        } catch (err) {
            setError(err?.response?.data?.message || 'Vote failed. Try again.');
        } finally {
            setPending(false);
        }
    }, [selected, messageId, localPoll]);

    return (
        <div className="mt-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 max-w-md">
            {/* Header */}
            <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    <BarChart2 size={18} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-0.5">
                        {allowMultiple ? 'Multiple Choice Poll' : 'Single Choice Poll'}
                    </p>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug">
                        {question}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                            <Users size={11} />
                            {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
                        </span>
                        {endDate && (
                            <span className="flex items-center gap-1">
                                <Clock size={11} />
                                {isExpired ? 'Ended' : 'Ends'} {formatDate(endDate)}
                            </span>
                        )}
                        {anonymous && (
                            <span className="flex items-center gap-1">
                                <Lock size={11} />
                                Anonymous
                            </span>
                        )}
                        {closed && (
                            <span className="text-orange-500 dark:text-orange-400 font-medium">Closed</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Options */}
            <div className="space-y-2">
                {optionsWithStats.map((opt) => {
                    const isUserVote = userVotedIndices.includes(opt.index);
                    const isPendingSel = selected.includes(opt.index);
                    const showResults = hasVoted || closed;

                    return (
                        <button
                            key={opt.index}
                            onClick={() => !hasVoted && toggleSelect(opt.index)}
                            disabled={!canVote || hasVoted}
                            className={`w-full text-left rounded-lg border transition-all relative overflow-hidden
                                ${hasVoted ? 'cursor-default' : canVote ? 'cursor-pointer hover:shadow-sm' : 'cursor-not-allowed opacity-60'}
                                ${isUserVote
                                    ? 'border-blue-500 bg-blue-600 dark:bg-blue-500 text-white'
                                    : isPendingSel
                                        ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-gray-900 dark:text-gray-100'
                                        : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                                }`}
                        >
                            {/* Vote-result progress bar */}
                            {showResults && opt.percentage > 0 && (
                                <div
                                    className={`absolute inset-0 rounded-lg transition-all duration-500
                                        ${isUserVote
                                            ? 'bg-blue-700 dark:bg-blue-600'
                                            : 'bg-blue-100 dark:bg-blue-900/30'
                                        }`}
                                    style={{ width: `${opt.percentage}%` }}
                                />
                            )}

                            {/* Content */}
                            <div className="relative z-10 flex items-center justify-between px-3 py-2.5">
                                <div className="flex items-center gap-2">
                                    {/* Radio / checkbox indicator */}
                                    {!hasVoted && (
                                        isPendingSel
                                            ? <CheckCircle size={15} className="text-blue-600 flex-shrink-0" />
                                            : <Circle size={15} className="text-gray-400 flex-shrink-0" />
                                    )}
                                    {hasVoted && isUserVote && (
                                        <CheckCircle size={15} className="text-white flex-shrink-0" />
                                    )}
                                    {hasVoted && !isUserVote && (
                                        <div className="w-[15px] flex-shrink-0" />
                                    )}
                                    <span className="text-sm font-medium">{opt.text}</span>
                                </div>

                                {showResults && (
                                    <div className="flex items-center gap-1.5 ml-2">
                                        <span className={`text-xs font-bold ${isUserVote ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                                            {opt.percentage}%
                                        </span>
                                        <span className={`text-[10px] ${isUserVote ? 'text-blue-100' : 'text-gray-400'}`}>
                                            ({opt.voteCount})
                                        </span>
                                    </div>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Submit button — visible only before user has voted */}
            {!hasVoted && !closed && selected.length > 0 && (
                <button
                    onClick={submitVote}
                    disabled={pending}
                    className="mt-3 w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors font-medium text-sm flex items-center justify-center gap-2"
                >
                    {pending && <Loader2 size={14} className="animate-spin" />}
                    {pending ? 'Voting…' : 'Submit Vote'}
                </button>
            )}

            {/* Error */}
            {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

            {/* After-vote message */}
            {hasVoted && !closed && (
                <p className="mt-2 text-xs text-green-600 dark:text-green-400 font-medium">
                    ✓ You voted · Results shown above
                </p>
            )}
        </div>
    );
}
