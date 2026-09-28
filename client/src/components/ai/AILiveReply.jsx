import React from 'react';
import { AlertCircle } from 'lucide-react';
import AIMarkdown from './AIMarkdown';
import BRAND from '../../shared/brand';

/** Oruinwan AI answering live in a conversation (before the final message is stored). */
const AILiveReply = ({ reply }) => (
    <div className="ai-live" role="status" aria-live="polite" aria-label={`${BRAND.ai} is replying`}>
        <img src="/icons/oruinwan-128.png" alt="" className="ai-live__avatar" />
        <div className="ai-live__body">
            <div className="ai-live__meta">
                <strong>{BRAND.ai}</strong>
                <span className="ai-live__badge">AI</span>
                {!reply.error && <span className="ai-live__state">{reply.text ? 'typing' : 'thinking'}</span>}
            </div>
            {reply.error ? (
                <p className="ai-live__error"><AlertCircle size={13} aria-hidden="true" /> {reply.error}</p>
            ) : (
                <>
                    {reply.text && <AIMarkdown text={reply.text} streaming />}
                    {reply.status && <p className="ai-live__status"><span className="ai-status-dot" /> {reply.status}</p>}
                    {!reply.text && !reply.status && <p className="ai-live__status"><span className="ai-status-dot" /> Thinking…</p>}
                </>
            )}
        </div>
    </div>
);

/** All live AI replies for a view (main conversation or one thread). */
export const AILiveReplies = ({ replies = [] }) => (
    replies.length ? <div className="ai-live-list">{replies.map((r) => <AILiveReply key={r.replyId} reply={r} />)}</div> : null
);

export default AILiveReply;
