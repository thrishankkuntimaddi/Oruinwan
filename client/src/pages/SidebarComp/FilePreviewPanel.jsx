import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Download, Trash2, MessageSquare, History, Send, Share2, Upload, RotateCcw, Tag, PenTool } from 'lucide-react';
import { useNavigate, useInRouterContext } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { Btn, IconBtn, Chip, EmptyState, LoadingState, Dialog, Confirm, Field, errorMessage, timeAgo } from '../../components/ui/page';
import { fileKind, formatSize, announceFilesChanged } from './fileKinds';
import FileTagsInput, { FILE_TAGS_CSS } from './FileTagsInput';
import AttachmentPreview from './AttachmentPreview';
import { downloadLibraryFile } from '../../hooks/useFiles';
import FileShareDialog, { FILE_SHARE_CSS } from './FileShareDialog';
import StartReviewDialog from '../designReview/StartReviewDialog';
import designReviewService from '../../services/designReviewService';
import { reviewKind, REVIEW_STATUS } from '../designReview/reviewGeometry';

const idOf = (u) => (typeof u === 'string' ? u : String(u?._id || u?.id || u?.sub || u || ''));

/** Design reviews of this file + "Start review" (images, PDFs and videos). Needs a router. */
function FileReviews({ file, workspaceId }) {
    const navigate = useNavigate();
    const [reviews, setReviews] = useState([]);
    const [starting, setStarting] = useState(false);
    const ws = workspaceId || file.workspaceId;

    useEffect(() => {
        let cancelled = false;
        Promise.resolve()
            .then(() => designReviewService.list({ fileId: file._id }))
            .then((list) => { if (!cancelled) setReviews(Array.isArray(list) ? list : []); })
            .catch(() => { if (!cancelled) setReviews([]); });
        return () => { cancelled = true; };
    }, [file._id]);

    const go = (r) => navigate(`/workspace/${ws}/reviews/${r._id}`);
    return (
        <div>
            <div className="fl-subhead"><PenTool size={12} /> Design reviews</div>
            {reviews.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                    {reviews.slice(0, 4).map((r) => {
                        const st = REVIEW_STATUS[r.status] || REVIEW_STATUS.open;
                        return (
                            <button key={r._id} type="button" className="gl-btn gl-btn--ghost gl-btn--sm" onClick={() => go(r)} style={{ justifyContent: 'space-between', width: '100%' }}>
                                <span className="fl-name" style={{ minWidth: 0 }}>{r.title} · v{r.versionNumber}</span>
                                <Chip tone={st.tone}>{st.label}</Chip>
                            </button>
                        );
                    })}
                </div>
            )}
            <Btn icon={PenTool} onClick={() => setStarting(true)}>Start review</Btn>
            <StartReviewDialog open={starting} workspaceId={ws} file={file} onClose={() => setStarting(false)} onCreated={(r) => { setStarting(false); go(r); }} />
        </div>
    );
}

/** Owner, or someone the owner gave edit access to (the server's own rule for edits). */
export function canEditFile(file, userId) {
    if (!file || !userId) return false;
    if (idOf(file.createdBy) === String(userId)) return true;
    const perm = (file.permissions || []).find((p) => idOf(p.user) === String(userId));
    return perm?.role === 'edit' || perm?.role === 'download';
}

/**
 * The file details side panel: preview + tags, comments, versions (upload a new one, restore an
 * older one) and sharing. `api` is the page's useFiles() result so changes land in its list.
 */
export default function FilePreviewPanel({ file, workspaceId, api, allTags = [], onClose, onDelete, onFileChange, source = 'library' }) {
    const { getComments, addComment, getVersions, uploadVersion, restoreVersion, updateTags, shareFile } = api;
    const { user } = useAuth() || {};
    const userId = idOf(user);
    const isOwner = Boolean(userId) && idOf(file.createdBy) === userId;
    const canEdit = canEditFile(file, userId);
    const { showToast } = useToast();
    const inRouter = useInRouterContext();

    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [posting, setPosting] = useState(false);
    const [activeTab, setActiveTab] = useState('preview');
    const [versions, setVersions] = useState([]);
    const [versionsLoading, setVersionsLoading] = useState(false);
    const [tags, setTags] = useState(file.tags || []);
    const [savingTags, setSavingTags] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);
    const [pendingVersion, setPendingVersion] = useState(null);
    const [changeNote, setChangeNote] = useState('');
    const [uploadingVersion, setUploadingVersion] = useState(false);
    const [confirmRestore, setConfirmRestore] = useState(null);
    const [restoring, setRestoring] = useState(false);
    const versionInput = useRef(null);

    const { Icon, label } = fileKind(file.mimeType);
    const download = async (version) => {
        try {
            await downloadLibraryFile(file._id, { versionId: version?._id, name: file.name });
        } catch (err) {
            showToast(errorMessage(err, 'Couldn’t download the file'), 'error');
        }
    };

    useEffect(() => { setTags(file.tags || []); }, [file._id, file.tags]);

    const loadVersions = useCallback(() => {
        setVersionsLoading(true);
        return getVersions(file._id)
            .then((d) => setVersions(d?.versions || []))
            .catch(() => setVersions([]))
            .finally(() => setVersionsLoading(false));
    }, [file._id, getVersions]);

    useEffect(() => {
        if (activeTab === 'comments') getComments(file._id).then(setComments).catch(() => { });
        if (activeTab === 'versions') loadVersions();
    }, [activeTab, file._id, getComments, loadVersions]);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.cd-dialog')) onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    const handleAddComment = async () => {
        if (!newComment.trim()) return;
        setPosting(true);
        try {
            const c = await addComment(file._id, newComment.trim());
            setComments((prev) => [...prev, c]);
            setNewComment('');
        } catch {
            showToast('Couldn’t post the comment', 'error');
        } finally {
            setPosting(false);
        }
    };

    const saveTags = async (next) => {
        const before = tags;
        setTags(next);
        setSavingTags(true);
        try {
            const updated = await updateTags(file._id, next);
            onFileChange?.({ ...file, tags: updated?.tags || next });
            announceFilesChanged(source);
        } catch (err) {
            setTags(before);
            showToast(errorMessage(err, 'Couldn’t save the tags'), 'error');
        } finally {
            setSavingTags(false);
        }
    };

    const submitVersion = async () => {
        if (!pendingVersion) return;
        setUploadingVersion(true);
        try {
            const data = await uploadVersion(file._id, pendingVersion, changeNote.trim());
            if (data?.file) onFileChange?.(data.file);
            showToast(`Uploaded version ${data?.version || ''}`.trim(), 'success');
            announceFilesChanged(source);
            setPendingVersion(null);
            setChangeNote('');
            loadVersions();
        } catch (err) {
            showToast(errorMessage(err, 'Couldn’t upload the new version'), 'error');
        } finally {
            setUploadingVersion(false);
        }
    };

    const doRestore = async () => {
        const v = confirmRestore;
        if (!v) return;
        setRestoring(true);
        try {
            const data = await restoreVersion(file._id, v._id);
            if (data?.file) onFileChange?.(data.file);
            showToast(`Restored version ${v.versionNumber}`, 'success');
            announceFilesChanged(source);
            setConfirmRestore(null);
            loadVersions();
        } catch (err) {
            showToast(errorMessage(err, 'Couldn’t restore that version'), 'error');
        } finally {
            setRestoring(false);
        }
    };

    const facts = [
        ['Size', formatSize(file.size)],
        ['Version', `v${file.currentVersion || 1}`],
        ['Uploaded', timeAgo(file.createdAt)],
        ['Type', (file.mimeType || '').split('/')[1] || label],
    ];

    return (
        <aside className="fl-preview" aria-label={`Preview of ${file.name}`}>
            <div className="fl-preview-head">
                <span className="gl-empty-mark" style={{ margin: 0, width: 30, height: 30 }}><Icon size={15} /></span>
                <strong className="fl-name" style={{ flex: 1, fontSize: 14 }} title={file.name}>{file.name}</strong>
                <IconBtn label="Share" onClick={() => setShareOpen(true)}><Share2 size={15} /></IconBtn>
                <IconBtn label="Close preview" onClick={onClose}><X size={16} /></IconBtn>
            </div>

            <div className="fl-preview-tabs">
                <div className="gl-tabs" role="tablist" aria-label="File details">
                    {[['preview', 'Preview'], ['comments', 'Comments'], ['versions', 'Versions']].map(([key, text]) => (
                        <button key={key} type="button" role="tab" className="gl-tab" aria-selected={activeTab === key} onClick={() => setActiveTab(key)}>{text}</button>
                    ))}
                </div>
            </div>

            <div className="fl-preview-body">
                {activeTab === 'preview' && (
                    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div className="fl-media fl-media--viewer">
                            <AttachmentPreview attachment={file} />
                        </div>

                        <dl className="fl-facts">
                            {facts.map(([k, v]) => (
                                <div key={k}>
                                    <dt>{k}</dt>
                                    <dd>{v}</dd>
                                </div>
                            ))}
                        </dl>

                        <div>
                            <div className="fl-subhead"><Tag size={12} /> Tags {savingTags && <span className="fl-meta" style={{ margin: 0 }}>Saving…</span>}</div>
                            {canEdit ? (
                                <FileTagsInput value={tags} onChange={saveTags} suggestions={allTags} label="Add a tag" placeholder="Add a tag and press Enter" />
                            ) : tags.length > 0 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {tags.map((tag) => <Chip key={tag} tone="accent">#{tag}</Chip>)}
                                </div>
                            ) : (
                                <span className="fl-meta">No tags. The owner or an editor can add them.</span>
                            )}
                        </div>

                        {inRouter && reviewKind(file.mimeType) && <FileReviews file={file} workspaceId={workspaceId} />}

                        <div style={{ display: 'flex', gap: 8 }}>
                            <Btn variant="primary" icon={Download} onClick={() => download()} style={{ flex: 1, justifyContent: 'center' }}>Download</Btn>
                            <Btn variant="ghost" icon={Share2} onClick={() => setShareOpen(true)}>Share</Btn>
                            {isOwner && <Btn variant="ghost" icon={Trash2} onClick={onDelete}>Delete</Btn>}
                        </div>
                    </div>
                )}

                {activeTab === 'comments' && (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {comments.length === 0 && (
                                <EmptyState icon={MessageSquare} title="No comments yet" text="Ask a question or leave feedback — everyone with access to the file sees it." />
                            )}
                            {comments.map((c) => (
                                <div key={c._id} style={{ display: 'flex', gap: 10 }}>
                                    <span className="fl-avatar">{(c.author?.username || 'U')[0].toUpperCase()}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p className="fl-meta" style={{ margin: '0 0 2px' }}>
                                            <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{c.author?.username}</strong> · {timeAgo(c.createdAt)}
                                        </p>
                                        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}>{c.content}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="fl-compose">
                            <input
                                className="gl-input"
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                                placeholder="Add a comment…"
                                aria-label="Add a comment"
                                style={{ flex: 1, minWidth: 0 }}
                            />
                            <Btn variant="primary" icon={Send} loading={posting} disabled={!newComment.trim()} onClick={handleAddComment}>Post</Btn>
                        </div>
                    </div>
                )}

                {activeTab === 'versions' && (
                    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <input
                            ref={versionInput}
                            type="file"
                            hidden
                            data-testid="version-input"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) setPendingVersion(f); e.target.value = ''; }}
                        />
                        {canEdit ? (
                            <Btn variant="primary" icon={Upload} onClick={() => versionInput.current?.click()}>Upload new version</Btn>
                        ) : (
                            <p className="fl-meta" style={{ whiteSpace: 'normal', margin: 0 }}>Only the owner and people who can edit may upload or restore versions.</p>
                        )}
                        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <li className="fl-version" data-current="true">
                                <span className="fl-vnum">v{file.currentVersion || 1}</span>
                                <span style={{ flex: 1, minWidth: 0 }}>
                                    <strong style={{ display: 'block', fontSize: 13, color: 'var(--text-primary)' }}>Current version</strong>
                                    <span className="fl-meta">{formatSize(file.size)} · {timeAgo(file.updatedAt || file.createdAt)}</span>
                                </span>
                                <Chip tone="accent">Current</Chip>
                            </li>
                            {versionsLoading && versions.length === 0 && <LoadingState label="Loading versions…" />}
                            {versions.map((v) => (
                                <li key={v._id} className="fl-version">
                                    <span className="fl-vnum">v{v.versionNumber}</span>
                                    <span style={{ flex: 1, minWidth: 0 }}>
                                        <strong style={{ display: 'block', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }} className="fl-name">{v.changeNote || `Version ${v.versionNumber}`}</strong>
                                        <span className="fl-meta">
                                            {formatSize(v.size)} · {timeAgo(v.createdAt)}{v.createdBy?.username ? ` · ${v.createdBy.username}` : ''}
                                        </span>
                                    </span>
                                    <span className="fl-actions" style={{ opacity: 1 }}>
                                        <IconBtn label={`Download version ${v.versionNumber}`} onClick={() => download(v)}><Download size={14} /></IconBtn>
                                        {canEdit && <Btn size="sm" variant="ghost" icon={RotateCcw} onClick={() => setConfirmRestore(v)}>Restore</Btn>}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        {!versionsLoading && versions.length === 0 && (
                            <EmptyState icon={History} title="No earlier versions" text="When someone uploads a new version, the older ones are kept here and can be restored." />
                        )}
                    </div>
                )}
            </div>

            <Dialog
                open={Boolean(pendingVersion)}
                title="Upload a new version"
                lead={`“${pendingVersion?.name || ''}” replaces the current copy of ${file.name}. The current copy stays in the version list.`}
                onClose={() => { setPendingVersion(null); setChangeNote(''); }}
                busy={uploadingVersion}
                size="sm"
                footer={(
                    <>
                        <Btn variant="ghost" onClick={() => { setPendingVersion(null); setChangeNote(''); }} disabled={uploadingVersion}>Cancel</Btn>
                        <Btn variant="primary" icon={Upload} loading={uploadingVersion} onClick={submitVersion}>Upload version</Btn>
                    </>
                )}
            >
                <Field label="What changed? (optional)" htmlFor="fl-change-note">
                    <input
                        id="fl-change-note"
                        className="gl-input"
                        value={changeNote}
                        maxLength={200}
                        onChange={(e) => setChangeNote(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') submitVersion(); }}
                        placeholder="e.g. Updated pricing table"
                    />
                </Field>
            </Dialog>

            <Confirm
                open={Boolean(confirmRestore)}
                title={`Restore version ${confirmRestore?.versionNumber}?`}
                confirmLabel="Restore"
                busy={restoring}
                onConfirm={doRestore}
                onClose={() => setConfirmRestore(null)}
            >
                It becomes the current copy for everyone. The copy you have now is kept in the version list, so you can switch back.
            </Confirm>

            <FileShareDialog
                open={shareOpen}
                file={file}
                workspaceId={workspaceId || file.workspaceId}
                isOwner={isOwner}
                shareFile={shareFile}
                onShared={(f) => f && onFileChange?.(f)}
                onClose={() => setShareOpen(false)}
                showToast={showToast}
            />
            <style>{FILE_TAGS_CSS + FILE_SHARE_CSS + PREVIEW_EXTRA_CSS}</style>
        </aside>
    );
}

const PREVIEW_EXTRA_CSS = `
.fl-subhead { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--text-muted); }
`;
