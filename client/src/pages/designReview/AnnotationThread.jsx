import React, { useState } from 'react';
import { Check, RotateCcw, Trash2, Send, Clock, FileText } from 'lucide-react';
import { Btn, Chip, timeAgo, errorMessage } from '../../components/ui/page';
import { formatTimestamp } from './reviewGeometry';

/** One pinned comment with its replies, reply box and resolve / delete actions. */
export default function AnnotationThread({ annotation: a, number, active, kind, canResolve, canDelete, onSelect, onReply, onResolve, onDelete, showToast }) {
    const [reply, setReply] = useState('');
    const [busy, setBusy] = useState(null);

    const run = async (what, fn, fallback) => {
        setBusy(what);
        try { await fn(); return true; } catch (err) { showToast?.(errorMessage(err, fallback), 'error'); return false; } finally { setBusy(null); }
    };
    const sendReply = async () => {
        const body = reply.trim();
        if (!body) return;
        if (await run('reply', () => onReply(a, body), 'Couldn’t post the reply')) setReply('');
    };

    return (
        <div className="dr-thread" data-active={active ? 'true' : undefined} data-resolved={a.resolved ? 'true' : undefined} onClick={() => onSelect(a)}>
            <div className="dr-thread-head">
                <span className="dr-badge">{number}</span>
                <strong>{a.authorId?.username || 'Someone'}</strong>
                <span>{timeAgo(a.createdAt)}</span>
                <span style={{ flex: 1 }} />
                {kind === 'video' && a.timeMs !== null && a.timeMs !== undefined && <Chip><Clock size={11} /> {formatTimestamp(a.timeMs)}</Chip>}
                {kind === 'pdf' && <Chip><FileText size={11} /> p.{a.page || 1}</Chip>}
                {a.resolved && <Chip tone="success">Resolved</Chip>}
            </div>
            <p className="dr-body">{a.body}</p>
            {(a.replies || []).length > 0 && (
                <div className="dr-replies">
                    {a.replies.map((r) => (
                        <div key={r._id} className="dr-reply"><strong>{r.authorId?.username || 'Someone'}</strong>{r.body}</div>
                    ))}
                </div>
            )}
            {active && (
                <div onClick={(e) => e.stopPropagation()}>
                    <div className="dr-compose">
                        <input
                            className="gl-input"
                            value={reply}
                            onChange={(e) => setReply(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') sendReply(); }}
                            placeholder="Reply…"
                            aria-label={`Reply to comment ${number}`}
                            maxLength={5000}
                        />
                        <Btn size="sm" variant="primary" icon={Send} loading={busy === 'reply'} disabled={!reply.trim()} onClick={sendReply}>Reply</Btn>
                    </div>
                    <div className="dr-actions">
                        {canResolve && (a.resolved
                            ? <Btn size="sm" variant="ghost" icon={RotateCcw} loading={busy === 'resolve'} onClick={() => run('resolve', () => onResolve(a, false), 'Couldn’t reopen it')}>Reopen</Btn>
                            : <Btn size="sm" icon={Check} loading={busy === 'resolve'} onClick={() => run('resolve', () => onResolve(a, true), 'Couldn’t resolve it')}>Resolve</Btn>)}
                        {canDelete && <Btn size="sm" variant="ghost" icon={Trash2} loading={busy === 'delete'} onClick={() => run('delete', () => onDelete(a), 'Couldn’t delete it')}>Delete</Btn>}
                    </div>
                </div>
            )}
        </div>
    );
}
