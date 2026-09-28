import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Link2, AlertCircle, ArrowRight } from 'lucide-react';

/** Pull the invite token out of a pasted invite link (…/join-workspace?token=…) or a bare token. */
export function parseInviteToken(input) {
    const value = (input || '').trim();
    if (!value) return '';
    const match = value.match(/[?&]token=([^&#\s]+)/);
    if (match) {
        try { return decodeURIComponent(match[1]); } catch { return match[1]; }
    }
    // A bare token: letters, digits and URL-safe punctuation only.
    return /^[A-Za-z0-9._~-]{8,}$/.test(value) ? value : '';
}

/** "Join with invite": paste the invite link from the email, then continue on /join-workspace. */
export default function JoinInviteDialog({ open, onClose }) {
    const navigate = useNavigate();
    const [value, setValue] = useState('');
    const [error, setError] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        setValue('');
        setError('');
        const t = setTimeout(() => inputRef.current?.focus(), 30);
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); };
    }, [open, onClose]);

    if (!open) return null;

    const submit = (e) => {
        e.preventDefault();
        const token = parseInviteToken(value);
        if (!token) { setError('Paste the full invite link from your email (it contains “token=”).'); return; }
        onClose();
        navigate(`/join-workspace?token=${encodeURIComponent(token)}`);
    };

    return (
        <div className="gl-wsp-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
            <form className="gl-wsp-dialog" role="dialog" aria-modal="true" aria-labelledby="gl-wsp-join-title" onSubmit={submit}>
                <button type="button" className="gl-icon-btn gl-wsp-dialog__close" onClick={onClose} aria-label="Close"><X size={16} /></button>
                <span className="gl-eyebrow">Invitation</span>
                <h2 id="gl-wsp-join-title" className="gl-wsp-dialog__title">Join a workspace</h2>
                <p className="gl-wsp-dialog__text">Paste the invite link someone sent you. You’ll see the workspace before you join.</p>

                <label className="gl-wsp-label" htmlFor="gl-wsp-join-input">Invite link</label>
                <div className="gl-search">
                    <Link2 size={14} />
                    <input
                        id="gl-wsp-join-input"
                        ref={inputRef}
                        className="gl-input"
                        style={{ height: 38, fontSize: 13 }}
                        placeholder="https://…/join-workspace?token=…"
                        value={value}
                        onChange={e => { setValue(e.target.value); setError(''); }}
                        aria-invalid={!!error}
                        autoComplete="off"
                        spellCheck={false}
                    />
                </div>
                {error && <p className="gl-wsp-dialog__error" role="alert"><AlertCircle size={13} /> {error}</p>}

                <div className="gl-wsp-dialog__foot">
                    <button type="button" className="gl-btn gl-btn--ghost" onClick={onClose}>Cancel</button>
                    <button type="submit" className="gl-btn gl-btn--primary" disabled={!value.trim()}>Continue <ArrowRight size={14} /></button>
                </div>
            </form>
        </div>
    );
}
