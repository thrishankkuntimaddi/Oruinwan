import React, { useState, useCallback } from "react";
import { BarChart3, CheckCircle, Circle, Users } from "lucide-react";
import api from '@services/api';

export default function PollBubble({ poll, messageId, currentUserId }) {
    const [localPoll, setLocalPoll] = useState(poll);
    const [voting, setVoting] = useState(false);

    const totalVotes = localPoll?.options?.reduce((s, o) => s + (o.votes?.length || 0), 0) || 0;

    const myVoteIndex = localPoll?.options?.findIndex(o =>
        o.votes?.some(v => (v?._id || v)?.toString() === currentUserId?.toString())
    );

    const handleVote = useCallback(async (optionIndex) => {
        if (voting || !localPoll?.isActive) return;
        
        if (!localPoll.allowMultiple && myVoteIndex === optionIndex) return;

        setVoting(true);
        try {
            const res = await api.post(`/api/v2/messages/${messageId}/poll/vote`, {
                optionIndex
            });
            if (res.data.poll) setLocalPoll(res.data.poll);
        } catch (err) {
            console.error("Vote failed:", err);
        } finally {
            setVoting(false);
        }
    }, [voting, localPoll, messageId, myVoteIndex]);

    if (!localPoll) return null;

    return (
        <div className="mt-1 bg-white border border-gray-200 rounded-2xl p-4 max-w-sm shadow-sm">
            {}
            <div className="flex items-start gap-2 mb-3">
                <BarChart3 size={16} className="text-violet-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm font-semibold text-gray-900 leading-snug">{localPoll.question}</p>
            </div>

            {}
            <div className="space-y-2">
                {localPoll.options?.map((option, idx) => {
                    const count = option.votes?.length || 0;
                    const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                    const isMine = option.votes?.some(v => (v?._id || v)?.toString() === currentUserId?.toString());

                    return (
                        <button
                            key={idx}
                            onClick={() => handleVote(idx)}
                            disabled={voting || !localPoll.isActive}
                            className={`relative w-full text-left rounded-xl overflow-hidden border transition-all ${isMine
                                ? "border-violet-400 bg-violet-50"
                                : "border-gray-200 hover:border-violet-300 hover:bg-gray-50"
                                } disabled:cursor-default`}
                        >
                            {}
                            <div
                                className={`absolute inset-y-0 left-0 rounded-xl transition-all duration-500 ${isMine ? "bg-violet-200" : "bg-gray-100"}`}
                                style={{ width: `${pct}%` }}
                            />
                            <div className="relative flex items-center justify-between px-3 py-2.5 z-10">
                                <div className="flex items-center gap-2">
                                    {isMine
                                        ? <CheckCircle size={14} className="text-violet-600 flex-shrink-0" />
                                        : <Circle size={14} className="text-gray-400 flex-shrink-0" />
                                    }
                                    <span className={`text-sm font-medium ${isMine ? "text-violet-700" : "text-gray-700"}`}>
                                        {option.text}
                                    </span>
                                </div>
                                <span className="text-xs text-gray-500 font-medium ml-2 flex-shrink-0">
                                    {pct}%
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {}
            <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-400">
                <Users size={11} />
                <span>{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</span>
                {!localPoll.isActive && (
                    <span className="ml-auto px-2 py-0.5 bg-gray-100 rounded-full text-gray-500 text-[10px] font-medium">Closed</span>
                )}
                {localPoll.anonymous && (
                    <span className="ml-1 text-[10px] text-gray-400">• Anonymous</span>
                )}
            </div>
        </div>
    );
}
