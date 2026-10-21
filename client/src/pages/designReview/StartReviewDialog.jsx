import React, { useEffect, useMemo, useState } from 'react';
import { PenTool } from 'lucide-react';
import { Dialog, Btn, Field, SearchBox, errorMessage } from '../../components/ui/page';
import { useAuth } from '../../contexts/AuthContext';
import designReviewService from '../../services/designReviewService';
import { reviewKind } from './reviewGeometry';
import './designReview.css';

const idOf = (v) => String(v?._id || v?.id || v || '');

/**
 * Start a design review. With `file` the file is fixed (from the file preview);
 * without it the dialog lists the workspace's images, PDFs and videos.
 * Calls onCreated(review) after POST /api/v2/design-reviews.
 */
export default function StartReviewDialog({ open, workspaceId, file = null, onClose, onCreated }) {
    const { user } = useAuth() || {};
    const me = idOf(user);
    const [members, setMembers] = useState([]);
    const [files, setFiles] = useState([]);
    const [fileId, setFileId] = useState('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [reviewers, setReviewers] = useState([]);
    const [q, setQ] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!open) return;
        setFileId(file?._id || ''); setTitle(file?.name || ''); setDescription(''); setDueDate(''); setReviewers([]); setError(null); setQ('');
        designReviewService.members(workspaceId).then(setMembers).catch(() => setMembers([]));
        if (!file) designReviewService.files(workspaceId).then((list) => setFiles(list.filter((f) => reviewKind(f.mimeType)))).catch(() => setFiles([]));
    }, [open, workspaceId, file]);

    const people = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return members.filter((m) => idOf(m) !== me && (!needle || String(m.username || m.email || '').toLowerCase().includes(needle)));
    }, [members, me, q]);

    const toggle = (id) => setReviewers((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));

    const submit = async () => {
        const target = file?._id || fileId;
        if (!target) { setError('Pick a file to review.'); return; }
        if (reviewers.length === 0) { setError('Add at least one reviewer.'); return; }
        setBusy(true); setError(null);
        try {
            const review = await designReviewService.create({
                fileId: target, title: title.trim() || undefined, description: description.trim() || undefined,
                reviewers, dueDate: dueDate || undefined,
            });
            onCreated?.(review);
        } catch (err) {
            setError(errorMessage(err, 'Couldn’t start the review'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog
            open={open}
            title="Start a design review"
            lead="Reviewers can pin comments on the file, then approve it or ask for changes."
            onClose={onClose}
            busy={busy}
            footer={(
                <>
                    <Btn variant="ghost" onClick={onClose} disabled={busy}>Cancel</Btn>
                    <Btn variant="primary" icon={PenTool} loading={busy} onClick={submit}>Start review</Btn>
                </>
            )}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {!file && (
                    <Field label="File" htmlFor="dr-file" hint={files.length === 0 ? 'Upload an image, PDF or video to the file library first.' : undefined}>
                        <select id="dr-file" className="gl-input cd-select" value={fileId} onChange={(e) => { setFileId(e.target.value); const f = files.find((x) => x._id === e.target.value); if (f && !title) setTitle(f.name); }}>
                            <option value="">Choose an image, PDF or video…</option>
                            {files.map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
                        </select>
                    </Field>
                )}
                <Field label="Title" htmlFor="dr-title">
                    <input id="dr-title" className="gl-input" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder={file?.name || 'Defaults to the file name'} />
                </Field>
                <Field label="What should reviewers look at? (optional)" htmlFor="dr-desc">
                    <textarea id="dr-desc" className="gl-input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} style={{ resize: 'vertical' }} />
                </Field>
                <Field label="Due (optional)" htmlFor="dr-due">
                    <input id="dr-due" type="date" className="gl-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </Field>
                <Field label={`Reviewers${reviewers.length ? ` · ${reviewers.length}` : ''}`}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {members.length > 6 && <SearchBox value={q} onChange={setQ} placeholder="Search people…" label="Search people" />}
                        <div className="dr-picklist" role="group" aria-label="Reviewers">
                            {people.length === 0 && <div className="dr-pick" style={{ cursor: 'default' }}>No one else in this workspace yet.</div>}
                            {people.map((m) => (
                                <label key={idOf(m)} className="dr-pick">
                                    <input type="checkbox" checked={reviewers.includes(idOf(m))} onChange={() => toggle(idOf(m))} />
                                    <span>{m.username || m.email}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </Field>
                {error && <div className="cd-error-text" role="alert">{error}</div>}
            </div>
        </Dialog>
    );
}
