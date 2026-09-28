import React, { useId, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import api from '../../services/api';
import { getHelpState } from './helpStore';

export const SUPPORT_CATEGORIES = [
    { id: 'question', label: 'Question' },
    { id: 'problem', label: 'Problem' },
    { id: 'feedback', label: 'Feedback' },
    { id: 'billing', label: 'Billing' },
];

const LIMITS = { subject: 150, description: 5000 };
const APP_VERSION = import.meta.env.VITE_APP_VERSION || `web-${import.meta.env.MODE}`;

/** Page + app details sent with a request when the box is ticked. Never message contents. */
export function supportContext() {
    return {
        path: window.location.pathname.slice(0, 300),
        appVersion: APP_VERSION,
        userAgent: navigator.userAgent.slice(0, 400),
    };
}

export default function SupportForm({ onDone }) {
    const id = useId();
    const [category, setCategory] = useState(() => getHelpState().category || 'question');
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [includeContext, setIncludeContext] = useState(true);
    const [status, setStatus] = useState('idle'); // idle | sending | sent
    const [error, setError] = useState('');

    const submit = async (e) => {
        e.preventDefault();
        if (!subject.trim() || !description.trim()) {
            setError('Add a subject and describe what you need.');
            return;
        }
        setStatus('sending');
        setError('');
        try {
            await api.post('/api/support/tickets', {
                category,
                subject: subject.trim(),
                description: description.trim(),
                ...(includeContext ? { context: supportContext() } : {}),
            });
            setStatus('sent');
        } catch (err) {
            setStatus('idle');
            setError(err?.response?.data?.message || 'Could not send your request. Check your connection and try again.');
        }
    };

    if (status === 'sent') {
        return (
            <div className="gl-empty" role="status">
                <span className="gl-empty-mark"><CheckCircle2 size={18} aria-hidden="true" /></span>
                <p className="gl-empty-title">Request sent</p>
                <p className="gl-empty-text">The Oruinwan team will reply here. You can follow its status under Your requests.</p>
                <div className="hp-actions">
                    <button type="button" className="gl-btn gl-btn--sm" onClick={onDone}>View your requests</button>
                    <button
                        type="button"
                        className="gl-btn gl-btn--ghost gl-btn--sm"
                        onClick={() => { setSubject(''); setDescription(''); setStatus('idle'); }}
                    >
                        Send another
                    </button>
                </div>
            </div>
        );
    }

    const placeholder = category === 'problem'
        ? 'What happened, what you expected, and the steps to make it happen again.'
        : 'How can we help?';

    return (
        <form className="hp-form" onSubmit={submit} noValidate>
            <fieldset className="hp-fieldset">
                <legend className="hp-label">Type</legend>
                <div className="gl-tabs" role="radiogroup" aria-label="Request type">
                    {SUPPORT_CATEGORIES.map((c) => (
                        <button
                            key={c.id}
                            type="button"
                            role="radio"
                            aria-checked={category === c.id}
                            className={`gl-tab${category === c.id ? " is-active" : ""}`}
                            onClick={() => setCategory(c.id)}
                        >
                            {c.label}
                        </button>
                    ))}
                </div>
            </fieldset>

            <label className="hp-label" htmlFor={`${id}-subject`}>Subject</label>
            <input
                id={`${id}-subject`}
                className="gl-input"
                value={subject}
                maxLength={LIMITS.subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={category === 'problem' ? 'e.g. Files over 5 MB fail to upload' : 'A short summary'}
                required
            />

            <label className="hp-label" htmlFor={`${id}-description`}>Details</label>
            <textarea
                id={`${id}-description`}
                className="gl-input hp-textarea"
                value={description}
                maxLength={LIMITS.description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={placeholder}
                rows={6}
                required
            />
            <p className="hp-muted hp-counter">{description.length}/{LIMITS.description}</p>

            <label className="hp-check">
                <input type="checkbox" checked={includeContext} onChange={(e) => setIncludeContext(e.target.checked)} />
                <span>Include the page I&apos;m on and my browser/app version (never message contents)</span>
            </label>

            {error && <p className="hp-error" role="alert">{error}</p>}

            <button type="submit" className="gl-btn gl-btn--primary gl-btn--block" disabled={status === 'sending'}>
                {status === 'sending' ? 'Sending…' : 'Send request'}
            </button>
            <p className="hp-muted hp-small">Don&apos;t include passwords, 2FA codes or recovery keys. Oruinwan staff will never ask for them.</p>
        </form>
    );
}
