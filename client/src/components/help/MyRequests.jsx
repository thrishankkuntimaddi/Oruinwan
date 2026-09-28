import React, { useEffect, useState } from 'react';
import { Inbox, ChevronDown } from 'lucide-react';
import api from '../../services/api';

const STATUS_LABEL = { open: 'Open', 'in-progress': 'In progress', resolved: 'Resolved', closed: 'Closed' };
const CATEGORY_LABEL = { question: 'Question', problem: 'Problem', feedback: 'Feedback', billing: 'Billing' };

function when(date) {
    if (!date) return '';
    return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** The signed-in user's support requests with their status and support's replies. */
export default function MyRequests({ onNew }) {
    const [state, setState] = useState({ loading: true, error: '', tickets: [] });
    const [expanded, setExpanded] = useState(null);

    useEffect(() => {
        let alive = true;
        api.get('/api/support/tickets/mine')
            .then((res) => { if (alive) setState({ loading: false, error: '', tickets: res.data?.tickets || [] }); })
            .catch((err) => {
                if (alive) setState({ loading: false, error: err?.response?.data?.message || 'Could not load your requests.', tickets: [] });
            });
        return () => { alive = false; };
    }, []);

    if (state.loading) return <p className="hp-muted hp-pad" role="status">Loading your requests…</p>;
    if (state.error) return <p className="hp-error hp-pad" role="alert">{state.error}</p>;

    if (!state.tickets.length) {
        return (
            <div className="gl-empty">
                <span className="gl-empty-mark"><Inbox size={18} aria-hidden="true" /></span>
                <p className="gl-empty-title">No requests yet</p>
                <p className="gl-empty-text">Questions and problem reports you send from Help show up here with their status.</p>
                <button type="button" className="gl-btn gl-btn--sm" onClick={onNew}>Contact support</button>
            </div>
        );
    }

    return (
        <>
            <ul className="hp-requests">
                {state.tickets.map((t) => {
                    const isOpen = expanded === t._id;
                    const supportReplies = t.replies.filter((r) => r.fromSupport).length;
                    return (
                        <li key={t._id} className="gl-card hp-request">
                            <button
                                type="button"
                                className="hp-request__head"
                                aria-expanded={isOpen}
                                onClick={() => setExpanded(isOpen ? null : t._id)}
                            >
                                <span className="hp-request__main">
                                    <span className="hp-request__subject">{t.subject}</span>
                                    <span className="hp-muted hp-small">
                                        {CATEGORY_LABEL[t.category] || 'Question'} · {when(t.createdAt)}
                                        {supportReplies > 0 && ` · ${supportReplies} ${supportReplies === 1 ? 'reply' : 'replies'}`}
                                    </span>
                                </span>
                                <span className={`hp-status hp-status--${t.status}`}>{STATUS_LABEL[t.status] || t.status}</span>
                                <ChevronDown size={14} aria-hidden="true" className="hp-request__chev" />
                            </button>
                            {isOpen && (
                                <div className="hp-request__body">
                                    <p className="hp-request__desc">{t.description}</p>
                                    {t.replies.map((r) => (
                                        <div key={r._id} className={`hp-reply${r.fromSupport ? ' hp-reply--support' : ''}`}>
                                            <p className="hp-small hp-muted">{r.fromSupport ? 'Oruinwan support' : 'You'} · {when(r.createdAt)}</p>
                                            <p>{r.message}</p>
                                        </div>
                                    ))}
                                    {!t.replies.length && <p className="hp-muted hp-small">No replies yet. We&apos;ll answer here.</p>}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
            <div className="hp-pad">
                <button type="button" className="gl-btn gl-btn--sm" onClick={onNew}>New request</button>
            </div>
        </>
    );
}
