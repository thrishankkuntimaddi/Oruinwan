import React, { useEffect, useId, useState } from 'react';
import { Plus } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { Badge, Button, ConfirmDialog, Field, Input, Notice, Section, errorMessage } from '../settingsUi';
import './account.css';

const MAX_EMAILS = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const idOf = (e) => String(e?.id || e?._id || '');

/** The server returns emails as {id|_id, email, verified, isPrimary}. */
const normalize = (list, fallbackEmail) => {
    const items = Array.isArray(list) ? list.filter((e) => e && e.email) : [];
    if (!items.length && fallbackEmail) return [{ id: '', email: fallbackEmail, verified: true, isPrimary: true }];
    return [...items].sort((a, b) => Number(!!b.isPrimary) - Number(!!a.isPrimary));
};

const onlyDigits = (v) => v.replace(/\D/g, '').slice(0, 6);

/** Inline "enter the code we sent" form under an unverified address. */
function VerifyForm({ entry, onVerified, onCancel }) {
    const { showToast } = useToast();
    const inputId = useId();
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [resending, setResending] = useState(false);
    const [error, setError] = useState('');

    const verify = async () => {
        if (code.length !== 6) { setError('Enter the 6-digit code'); return; }
        setBusy(true);
        setError('');
        try {
            const { data } = await api.post(`/api/auth/me/emails/${idOf(entry)}/verify`, { code });
            showToast(`${entry.email} verified`, 'success');
            onVerified(data?.emails);
        } catch (err) {
            setError(errorMessage(err, 'That code did not work'));
        } finally {
            setBusy(false);
        }
    };

    const resend = async () => {
        setResending(true);
        try {
            const { data } = await api.post(`/api/auth/me/emails/${idOf(entry)}/resend`);
            showToast(data?.message || 'A new code is on its way', 'info');
        } catch (err) {
            showToast(errorMessage(err, 'Could not send a new code'), 'error');
        } finally {
            setResending(false);
        }
    };

    return (
        <div className="stg-acc-item-extra">
            <Field
                id={inputId}
                label={`Code sent to ${entry.email}`}
                error={error}
                hint="The code expires after 15 minutes."
            >
                <div className="stg-acc-inline">
                    <Input
                        id={inputId}
                        className="stg-acc-code stg-mono"
                        value={code}
                        onChange={(e) => { setCode(onlyDigits(e.target.value)); setError(''); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') verify(); }}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        placeholder="000000"
                        invalid={!!error}
                        autoFocus
                    />
                    <Button variant="primary" onClick={verify} loading={busy} disabled={code.length !== 6}>Verify</Button>
                    <Button variant="ghost" onClick={resend} loading={resending} disabled={busy}>Resend code</Button>
                    <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
                </div>
            </Field>
        </div>
    );
}

export default function EmailAddresses() {
    const { user, setUser } = useAuth();
    const { showToast } = useToast();
    const addId = useId();

    const [emails, setEmails] = useState(() => normalize(user?.emails, user?.email));
    const [adding, setAdding] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [addError, setAddError] = useState('');
    const [addBusy, setAddBusy] = useState(false);
    const [verifyingId, setVerifyingId] = useState(null);
    const [busyId, setBusyId] = useState(null);
    const [removing, setRemoving] = useState(null);
    const [locked, setLocked] = useState('');

    // Follow the signed-in user when it changes elsewhere (e.g. a refresh).
    useEffect(() => { setEmails(normalize(user?.emails, user?.email)); }, [user?.emails, user?.email]);

    const apply = (list) => {
        if (!Array.isArray(list)) return;
        const next = normalize(list, user?.email);
        setEmails(next);
        const primary = next.find((e) => e.isPrimary)?.email;
        setUser((prev) => (prev ? { ...prev, emails: list, ...(primary ? { email: primary } : {}) } : prev));
    };

    const handleForbidden = (err) => {
        if (err?.response?.status === 403) {
            setLocked(errorMessage(err, 'Your email addresses are managed by your organisation.'));
            setAdding(false);
            return true;
        }
        return false;
    };

    const add = async () => {
        const email = newEmail.trim().toLowerCase();
        if (!EMAIL_RE.test(email)) { setAddError('Enter a valid email address'); return; }
        if (emails.some((e) => e.email.toLowerCase() === email)) { setAddError('That address is already on your account'); return; }
        setAddBusy(true);
        setAddError('');
        try {
            const { data } = await api.post('/api/auth/me/emails', { email });
            apply(data?.emails);
            const added = (data?.emails || []).find((e) => e.email === email);
            setNewEmail('');
            setAdding(false);
            if (added) setVerifyingId(idOf(added));
            showToast(`We sent a code to ${email}`, 'info');
        } catch (err) {
            if (!handleForbidden(err)) setAddError(errorMessage(err, 'Could not add that address'));
        } finally {
            setAddBusy(false);
        }
    };

    const makePrimary = async (entry) => {
        setBusyId(idOf(entry));
        try {
            const { data } = await api.put(`/api/auth/me/emails/${idOf(entry)}/primary`);
            apply(data?.emails);
            showToast(`${entry.email} is now your primary email`, 'success');
        } catch (err) {
            if (!handleForbidden(err)) showToast(errorMessage(err, 'Could not change your primary email'), 'error');
        } finally {
            setBusyId(null);
        }
    };

    const remove = async () => {
        const entry = removing;
        setBusyId(idOf(entry));
        try {
            const { data } = await api.delete(`/api/auth/me/emails/${idOf(entry)}`);
            if (Array.isArray(data?.emails)) apply(data.emails);
            else setEmails((list) => list.filter((e) => idOf(e) !== idOf(entry)));
            if (verifyingId === idOf(entry)) setVerifyingId(null);
            showToast(`${entry.email} removed`, 'success');
            setRemoving(null);
        } catch (err) {
            setRemoving(null);
            if (!handleForbidden(err)) showToast(errorMessage(err, 'Could not remove that address'), 'error');
        } finally {
            setBusyId(null);
        }
    };

    const canAdd = !locked && emails.length < MAX_EMAILS && emails.every((e) => idOf(e));

    return (
        <Section
            title="Email addresses"
            description="Your primary email is used to sign in and for notifications."
            action={canAdd && !adding ? <Button size="sm" icon={Plus} onClick={() => { setAdding(true); setAddError(''); }}>Add email</Button> : null}
        >
            {locked && <div className="stg-acc-pad-top"><Notice tone="info">{locked}</Notice></div>}

            <ul className="stg-list" aria-label="Email addresses">
                {emails.map((entry) => {
                    const id = idOf(entry);
                    const busy = busyId === id;
                    return (
                        <li key={id || entry.email} className="stg-acc-email">
                            <div className="stg-list-item stg-acc-list-item" data-noicon="true">
                                <div className="stg-acc-item-main">
                                    <div className="stg-acc-item-title">
                                        <span>{entry.email}</span>
                                        {entry.isPrimary && <Badge tone="accent">Primary</Badge>}
                                        {entry.verified ? <Badge tone="success">Verified</Badge> : <Badge>Unverified</Badge>}
                                    </div>
                                    {!entry.verified && verifyingId !== id && (
                                        <div className="stg-acc-item-meta">Verify this address before you can make it primary.</div>
                                    )}
                                </div>
                                {id && !locked && !entry.isPrimary && (
                                    <div className="stg-acc-item-actions">
                                        {!entry.verified && verifyingId !== id && (
                                            <Button size="sm" onClick={() => setVerifyingId(id)} disabled={busy}>Verify</Button>
                                        )}
                                        {entry.verified && (
                                            <Button size="sm" onClick={() => makePrimary(entry)} loading={busy}>Make primary</Button>
                                        )}
                                        <Button size="sm" variant="danger-soft" onClick={() => setRemoving(entry)} disabled={busy}>Remove</Button>
                                    </div>
                                )}
                            </div>
                            {verifyingId === id && !entry.verified && (
                                <VerifyForm
                                    entry={entry}
                                    onVerified={(list) => { apply(list); setVerifyingId(null); }}
                                    onCancel={() => setVerifyingId(null)}
                                />
                            )}
                        </li>
                    );
                })}
            </ul>

            {adding && (
                <div className="stg-acc-add">
                    <Field id={addId} label="New email address" error={addError} hint="We'll send a 6-digit code to confirm it's yours.">
                        <div className="stg-acc-inline">
                            <Input
                                id={addId}
                                type="email"
                                value={newEmail}
                                onChange={(e) => { setNewEmail(e.target.value); setAddError(''); }}
                                onKeyDown={(e) => { if (e.key === 'Enter') add(); if (e.key === 'Escape') setAdding(false); }}
                                placeholder="name@example.com"
                                autoComplete="email"
                                invalid={!!addError}
                                autoFocus
                            />
                            <Button variant="primary" onClick={add} loading={addBusy} disabled={!newEmail.trim()}>Send code</Button>
                            <Button variant="ghost" onClick={() => { setAdding(false); setNewEmail(''); setAddError(''); }} disabled={addBusy}>Cancel</Button>
                        </div>
                    </Field>
                </div>
            )}

            {!locked && emails.length >= MAX_EMAILS && (
                <div className="stg-acc-item-meta stg-acc-item-extra">
                    You can have up to {MAX_EMAILS} addresses. Remove one to add another.
                </div>
            )}

            <ConfirmDialog
                open={!!removing}
                title="Remove email address?"
                confirmLabel="Remove"
                tone="danger"
                loading={!!removing && busyId === idOf(removing)}
                onConfirm={remove}
                onCancel={() => setRemoving(null)}
            >
                {removing?.email} will no longer be linked to your account.
            </ConfirmDialog>
        </Section>
    );
}
