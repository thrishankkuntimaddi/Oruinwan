import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { BarChart2, Users, Clock, Lock, Check, Loader2, ChevronDown, ChevronUp, StopCircle } from 'lucide-react';
import api from '@services/api';
import logger from '../../../../../utils/logger';

/*
 * Poll card rendered inside a message row.
 *
 * Votes are applied optimistically: the card updates the instant an option is
 * clicked, the request runs in the background, and the server's answer (or the
 * realtime `poll:vote_updated` broadcast) replaces the local state. On failure
 * the previous state is restored.
 */

const idOf = (v) => (v && typeof v === 'object' ? String(v._id ?? v.id ?? '') : String(v ?? ''));

function formatEnd(dateStr) {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Apply a user's new selection to a poll locally (mirrors the server rules). */
function applyVote(poll, userId, indices, userName) {
    const me = String(userId);
    const options = poll.options.map((opt, i) => {
        const others = (opt.votes || []).filter((v) => idOf(v) !== me);
        return indices.includes(i)
            ? { ...opt, votes: [...others, { _id: me, username: userName || 'You' }] }
            : { ...opt, votes: others };
    });
    const voters = new Set();
    options.forEach((o) => o.votes.forEach((v) => voters.add(idOf(v))));
    return { ...poll, options, totalVotes: voters.size };
}

const S = {
    card: {
        marginTop: '4px', maxWidth: '420px', border: '1px solid var(--border-default)',
        backgroundColor: 'var(--bg-surface)', borderRadius: '4px', overflow: 'hidden',
    },
    head: { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px 4px' },
    badge: {
        fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
        color: 'var(--accent)', backgroundColor: 'var(--accent-dim, rgba(184,149,106,0.12))',
        padding: '2px 6px', borderRadius: '2px',
    },
    question: { fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, padding: '4px 14px 0', margin: 0 },
    meta: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', padding: '4px 14px 10px', fontSize: '11px', color: 'var(--text-muted)' },
    metaItem: { display: 'inline-flex', alignItems: 'center', gap: '4px' },
    options: { display: 'flex', flexDirection: 'column', gap: '6px', padding: '0 10px 10px' },
    footer: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
        padding: '8px 14px', borderTop: '1px solid var(--border-subtle)', fontSize: '11px', color: 'var(--text-muted)',
    },
};

export default function PollMessage({ msg, currentUserId }) {
    const messageId = msg?._id || msg?.id;
    const incoming = msg?.poll || null;

    const [poll, setPoll] = useState(incoming);
    const [pendingCount, setPendingCount] = useState(0);
    const [closing, setClosing] = useState(false);
    const [error, setError] = useState(null);
    const [expanded, setExpanded] = useState(null);
    const lastConfirmed = useRef(incoming);

    // Server/realtime updates always win over local optimistic state.
    useEffect(() => {
        if (incoming) {
            lastConfirmed.current = incoming;
            setPoll(incoming);
        }
    }, [incoming]);

    const me = currentUserId ? String(currentUserId) : '';
    const options = useMemo(() => poll?.options || [], [poll]);
    const totalVotes = poll?.totalVotes || 0;
    const allowMultiple = !!poll?.allowMultiple;
    const anonymous = !!poll?.anonymous;
    const isExpired = poll?.endDate ? new Date(poll.endDate) < new Date() : false;
    const closed = poll ? (poll.isActive === false || isExpired) : true;
    const creatorId = idOf(poll?.createdBy || msg?.sender);
    const isCreator = !!me && creatorId === me;

    const myVotes = useMemo(
        () => options.reduce((acc, opt, i) => ((opt.votes || []).some((v) => idOf(v) === me) ? [...acc, i] : acc), []),
        [options, me]
    );
    const hasVoted = myVotes.length > 0;
    const showResults = hasVoted || closed;

    const rows = useMemo(() => options.map((opt, i) => {
        const count = opt.votes?.length || 0;
        return {
            text: opt.text,
            index: i,
            count,
            pct: totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0,
            voters: anonymous ? [] : (opt.votes || []).map((v) => (typeof v === 'object' ? v.username : null)).filter(Boolean),
        };
    }), [options, totalVotes, anonymous]);

    const vote = useCallback(async (indices) => {
        if (!poll || closed || !messageId) return;
        setError(null);
        // Optimistic: show the result immediately.
        setPoll((p) => applyVote(p, me, indices));
        setPendingCount((n) => n + 1);
        try {
            const { data } = await api.post(`/api/v2/messages/${messageId}/vote`, { optionIndices: indices });
            if (data?.message?.poll) {
                lastConfirmed.current = data.message.poll;
                setPoll(data.message.poll);
            }
        } catch (err) {
            logger.error('[Poll] vote failed:', err);
            setPoll(lastConfirmed.current);
            setError(err?.response?.data?.message || 'Vote failed. Try again.');
        } finally {
            setPendingCount((n) => n - 1);
        }
    }, [poll, closed, messageId, me]);

    const onOption = useCallback((idx) => {
        if (closed) return;
        const mine = myVotes.includes(idx);
        const next = allowMultiple
            ? (mine ? myVotes.filter((i) => i !== idx) : [...myVotes, idx])
            : (mine ? [] : [idx]);
        vote(next);
    }, [closed, myVotes, allowMultiple, vote]);

    const endPoll = useCallback(async () => {
        if (!messageId || closing) return;
        setClosing(true);
        setError(null);
        try {
            const { data } = await api.post(`/api/v2/messages/${messageId}/poll/close`);
            if (data?.message?.poll) {
                lastConfirmed.current = data.message.poll;
                setPoll(data.message.poll);
            }
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not end the poll.');
        } finally {
            setClosing(false);
        }
    }, [messageId, closing]);

    if (!poll) return null;

    return (
        <div style={S.card}>
            <div style={S.head}>
                <BarChart2 size={14} style={{ color: 'var(--accent)' }} />
                <span style={S.badge}>{allowMultiple ? 'Multiple choice' : 'Poll'}</span>
                {closed && <span style={{ ...S.badge, color: 'var(--text-muted)', backgroundColor: 'var(--bg-active)' }}>Closed</span>}
            </div>

            <p style={S.question}>{poll.question}</p>

            <div style={S.meta}>
                <span style={S.metaItem}><Users size={11} /> {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}</span>
                {poll.endDate && <span style={S.metaItem}><Clock size={11} /> {isExpired ? 'Ended' : 'Ends'} {formatEnd(poll.endDate)}</span>}
                {anonymous && <span style={S.metaItem}><Lock size={11} /> Anonymous</span>}
            </div>

            <div style={S.options}>
                {rows.map((row) => {
                    const mine = myVotes.includes(row.index);
                    const open = expanded === row.index;
                    return (
                        <div key={row.index}>
                            <button
                                type="button"
                                onClick={() => onOption(row.index)}
                                disabled={closed}
                                aria-pressed={mine}
                                style={{
                                    position: 'relative', width: '100%', textAlign: 'left', overflow: 'hidden',
                                    padding: '9px 12px', borderRadius: '3px', fontFamily: 'inherit',
                                    border: `1px solid ${mine ? 'var(--accent)' : 'var(--border-default)'}`,
                                    backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)',
                                    cursor: closed ? 'default' : 'pointer', transition: 'border-color 120ms ease',
                                }}
                                onMouseEnter={(e) => { if (!closed && !mine) e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
                                onMouseLeave={(e) => { if (!mine) e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                            >
                                {showResults && (
                                    <span
                                        aria-hidden
                                        style={{
                                            position: 'absolute', inset: 0, width: `${row.pct}%`,
                                            backgroundColor: mine ? 'rgba(184,149,106,0.18)' : 'var(--bg-active)',
                                            transition: 'width 350ms cubic-bezier(0.16,1,0.3,1)',
                                        }}
                                    />
                                )}
                                <span style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                        <span
                                            aria-hidden
                                            style={{
                                                width: '14px', height: '14px', flexShrink: 0,
                                                borderRadius: allowMultiple ? '2px' : '50%',
                                                border: `1.5px solid ${mine ? 'var(--accent)' : 'var(--text-muted)'}`,
                                                backgroundColor: mine ? 'var(--accent)' : 'transparent',
                                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                            }}
                                        >
                                            {mine && <Check size={10} strokeWidth={3} style={{ color: 'var(--bg-base, #0c0c0c)' }} />}
                                        </span>
                                        <span style={{ fontSize: '13px', fontWeight: mine ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {row.text}
                                        </span>
                                    </span>
                                    {showResults && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0, fontSize: '12px', color: mine ? 'var(--accent)' : 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                                            <strong>{row.pct}%</strong>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{row.count}</span>
                                            {!anonymous && row.voters.length > 0 && (
                                                <span
                                                    role="button"
                                                    tabIndex={0}
                                                    title="Who voted"
                                                    onClick={(e) => { e.stopPropagation(); setExpanded(open ? null : row.index); }}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setExpanded(open ? null : row.index); } }}
                                                    style={{ display: 'inline-flex', color: 'var(--text-muted)' }}
                                                >
                                                    {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                </span>
                                            )}
                                        </span>
                                    )}
                                </span>
                            </button>
                            {open && row.voters.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '6px 4px 2px' }}>
                                    {row.voters.map((name, i) => (
                                        <span key={i} style={{ fontSize: '11px', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-subtle)', padding: '1px 6px', borderRadius: '2px' }}>
                                            {name}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {error && <div style={{ padding: '0 14px 8px', fontSize: '11px', color: 'var(--text-danger, #e05252)' }}>{error}</div>}

            <div style={S.footer}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    {pendingCount > 0 && <Loader2 size={11} className="animate-spin" />}
                    {closed
                        ? 'Voting has ended'
                        : hasVoted
                            ? 'You voted. Click again to change.'
                            : allowMultiple ? 'Select one or more options' : 'Select one option'}
                </span>
                {isCreator && !closed && (
                    <button
                        type="button"
                        onClick={endPoll}
                        disabled={closing}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 500,
                            color: 'var(--text-secondary)', background: 'transparent', border: '1px solid var(--border-default)',
                            borderRadius: '2px', padding: '3px 8px', cursor: closing ? 'default' : 'pointer', fontFamily: 'inherit',
                        }}
                    >
                        {closing ? <Loader2 size={11} className="animate-spin" /> : <StopCircle size={11} />}
                        End poll
                    </button>
                )}
            </div>
        </div>
    );
}
