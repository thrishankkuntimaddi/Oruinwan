import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    PenTool, ArrowLeft, Check, AlertTriangle, Columns2, MousePointer2, MessageSquarePlus, RefreshCcw, Layers, Trash2, ChevronLeft, ChevronRight, MessageSquare,
} from 'lucide-react';
import {
    DashPage, PageHead, Panel, Btn, IconBtn, Chip, FilterTabs, EmptyState, LoadingState, ErrorState, Confirm, Dialog, Field, Avatar, errorMessage, timeAgo,
} from '../../components/ui/page';
import { useAuth } from '../../contexts/AuthContext';
import { useOptionalSocket } from '../../contexts/SocketContext';
import { useToast } from '../../contexts/ToastContext';
import designReviewService from '../../services/designReviewService';
import ReviewCanvas from './ReviewCanvas';
import AnnotationThread from './AnnotationThread';
import VersionCompare from './VersionCompare';
import { applyAnnotationEvent, sortAnnotations, formatTimestamp, REVIEW_STATUS, DECISION } from './reviewGeometry';
import './designReview.css';

const idOf = (v) => String(v?._id || v?.id || v?.sub || v || '');
const POINTER_TTL = 4000;

export default function DesignReviewPage() {
    const { workspaceId, reviewId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth() || {};
    const me = idOf(user);
    const socket = useOptionalSocket()?.socket;
    const { showToast } = useToast();
    const canvasRef = useRef(null);

    const [state, setState] = useState({ loading: true, error: null, review: null });
    const [annotations, setAnnotations] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [annotating, setAnnotating] = useState(false);
    const [draft, setDraft] = useState(null);
    const [draftBody, setDraftBody] = useState('');
    const [posting, setPosting] = useState(false);
    const [filter, setFilter] = useState('open');
    const [page, setPage] = useState(1);
    const [mode, setMode] = useState('review'); // review | compare
    const [viewers, setViewers] = useState([]);
    const [pointers, setPointers] = useState({});
    const [decision, setDecision] = useState(null); // 'approved' | 'changes_requested'
    const [note, setNote] = useState('');
    const [deciding, setDeciding] = useState(false);
    const [confirm, setConfirm] = useState(null); // 'round' | 'delete'
    const [busy, setBusy] = useState(false);

    const review = state.review;
    const reviewRef = useRef(null);
    reviewRef.current = review;
    const kind = review?.file?.kind || 'image';

    const load = useCallback(async () => {
        setState((s) => ({ ...s, loading: true, error: null }));
        try {
            const data = await designReviewService.get(reviewId);
            setState({ loading: false, error: null, review: data.review });
            setAnnotations(data.annotations || []);
        } catch (err) {
            setState({ loading: false, error: errorMessage(err, 'Couldn’t load this review'), review: null });
        }
    }, [reviewId]);

    useEffect(() => { load(); }, [load]);

    // Live room: annotations, decisions, rounds, presence and pointers.
    useEffect(() => {
        if (!socket || !reviewId) return undefined;
        const mine = (p) => p && String(p.reviewId) === String(reviewId);
        const join = () => socket.emit('design-review:join', { reviewId }, (res) => { if (res?.ok) setViewers(res.viewers || []); });
        const onAnnotation = (p) => { if (mine(p)) setAnnotations((list) => applyAnnotationEvent(list, p)); };
        const onUpdated = (p) => {
            if (!mine(p) || !p.review) return;
            if (reviewRef.current && p.review.versionNumber !== reviewRef.current.versionNumber) { load(); return; }
            setState((s) => {
                if (!s.review) return s;
                return { ...s, review: { ...s.review, ...p.review, file: s.review.file, version: s.review.version, permissions: s.review.permissions } };
            });
        };
        const onDeleted = (p) => {
            if (!mine(p)) return;
            showToast('This review was deleted', 'info');
            navigate(`/workspace/${workspaceId}/reviews`, { replace: true });
        };
        const onPresence = (p) => {
            if (!mine(p)) return;
            setViewers((v) => (p.action === 'joined' ? [...new Set([...v, String(p.userId)])] : v.filter((x) => x !== String(p.userId))));
            if (p.action === 'left') setPointers((ps) => { const n = { ...ps }; delete n[p.userId]; return n; });
        };
        const onPointer = (p) => {
            if (!mine(p) || String(p.userId) === me) return;
            setPointers((ps) => ({ ...ps, [p.userId]: { ...p, at: Date.now() } }));
        };
        join();
        socket.on('connect', join);
        socket.on('design-review:annotation', onAnnotation);
        socket.on('design-review:updated', onUpdated);
        socket.on('design-review:deleted', onDeleted);
        socket.on('design-review:presence', onPresence);
        socket.on('design-review:pointer', onPointer);
        return () => {
            socket.emit('design-review:leave', { reviewId });
            socket.off('connect', join);
            socket.off('design-review:annotation', onAnnotation);
            socket.off('design-review:updated', onUpdated);
            socket.off('design-review:deleted', onDeleted);
            socket.off('design-review:presence', onPresence);
            socket.off('design-review:pointer', onPointer);
        };
    }, [socket, reviewId, workspaceId, me, navigate, showToast, load]);

    // Drop stale pointers.
    useEffect(() => {
        const t = setInterval(() => setPointers((ps) => {
            const now = Date.now();
            const keep = Object.entries(ps).filter(([, p]) => now - p.at < POINTER_TTL);
            return keep.length === Object.keys(ps).length ? ps : Object.fromEntries(keep);
        }), 1000);
        return () => clearInterval(t);
    }, []);

    const people = useMemo(() => {
        const map = {};
        if (review?.createdBy) map[idOf(review.createdBy)] = review.createdBy;
        (review?.reviewers || []).forEach((r) => { if (r.user) map[idOf(r.user)] = r.user; });
        annotations.forEach((a) => { if (a.authorId) map[idOf(a.authorId)] = a.authorId; });
        return map;
    }, [review, annotations]);

    const current = useMemo(() => annotations.filter((a) => a.versionNumber === undefined || !review || a.versionNumber === review.versionNumber), [annotations, review]);
    const ordered = useMemo(() => sortAnnotations(current), [current]);
    const numbers = useMemo(() => {
        const byAge = [...current].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
        return Object.fromEntries(byAge.map((a, i) => [a._id, i + 1]));
    }, [current]);
    const openCount = current.filter((a) => !a.resolved).length;
    const listed = ordered.filter((a) => (filter === 'all' ? true : filter === 'open' ? !a.resolved : a.resolved));

    if (state.loading && !review) return <DashPage head={<PageHead eyebrow="Design review" title="Loading…" icon={PenTool} />}><LoadingState label="Opening the review…" /></DashPage>;
    if (!review) {
        return (
            <DashPage head={<PageHead eyebrow="Design review" title="Review not found" icon={PenTool} />}>
                <ErrorState title="Couldn’t open this review" message={state.error} onRetry={load} />
                <div><Btn variant="ghost" icon={ArrowLeft} onClick={() => navigate(`/workspace/${workspaceId}/reviews`)}>All reviews</Btn></div>
            </DashPage>
        );
    }

    const perms = review.permissions || {};
    const isCreator = idOf(review.createdBy) === me;
    const isReviewer = (review.reviewers || []).some((r) => idOf(r.user) === me);
    const myDecision = (review.reviewers || []).find((r) => idOf(r.user) === me)?.decision;
    const status = REVIEW_STATUS[review.status] || REVIEW_STATUS.open;
    const fileCurrent = review.file?.currentVersion || review.versionNumber;
    const behind = fileCurrent > review.versionNumber;

    const select = (a) => {
        setActiveId(a._id);
        if (kind === 'video' && a.timeMs !== null && a.timeMs !== undefined) canvasRef.current?.seek(a.timeMs);
        if (kind === 'pdf' && a.page && a.page !== page) setPage(a.page);
    };

    const postDraft = async () => {
        const body = draftBody.trim();
        if (!draft || !body) return;
        setPosting(true);
        try {
            const payload = { x: draft.x, y: draft.y, w: draft.w, h: draft.h, body };
            if (kind === 'pdf') payload.page = draft.page;
            if (kind === 'video' && draft.timeMs !== null) payload.timeMs = draft.timeMs;
            const created = await designReviewService.annotate(review._id, payload);
            setAnnotations((list) => applyAnnotationEvent(list, { action: 'created', annotation: created }));
            setActiveId(created._id);
            setDraft(null); setDraftBody(''); setFilter((f) => (f === 'resolved' ? 'open' : f));
        } catch (err) {
            showToast(errorMessage(err, 'Couldn’t post the comment'), 'error');
        } finally {
            setPosting(false);
        }
    };

    const onReply = async (a, body) => {
        const { annotation } = await designReviewService.reply(review._id, a._id, body);
        setAnnotations((list) => applyAnnotationEvent(list, { action: 'reply', annotation }));
    };
    const onResolve = async (a, resolved) => {
        const annotation = await designReviewService.resolve(review._id, a._id, resolved);
        setAnnotations((list) => applyAnnotationEvent(list, { action: resolved ? 'resolved' : 'reopened', annotation }));
    };
    const onDelete = async (a) => {
        await designReviewService.deleteAnnotation(review._id, a._id);
        setAnnotations((list) => applyAnnotationEvent(list, { action: 'deleted', annotation: { _id: a._id } }));
        setActiveId(null);
    };

    const decide = async () => {
        setDeciding(true);
        try {
            const next = await designReviewService.decide(review._id, decision, note.trim() || undefined);
            setState((s) => ({ ...s, review: { ...s.review, ...next, file: s.review.file, version: s.review.version, permissions: s.review.permissions } }));
            showToast(decision === 'approved' ? 'You approved this design' : 'You asked for changes', 'success');
            setDecision(null); setNote('');
        } catch (err) {
            showToast(errorMessage(err, 'Couldn’t save your decision'), 'error');
        } finally {
            setDeciding(false);
        }
    };

    const doConfirm = async () => {
        setBusy(true);
        try {
            if (confirm === 'round') {
                await designReviewService.newRound(review._id);
                showToast(`Review moved to version ${fileCurrent}`, 'success');
                setConfirm(null);
                await load();
            } else {
                await designReviewService.remove(review._id);
                navigate(`/workspace/${workspaceId}/reviews`, { replace: true });
            }
        } catch (err) {
            showToast(errorMessage(err, 'Something went wrong'), 'error');
            setConfirm(null);
        } finally {
            setBusy(false);
        }
    };

    const emitPointer = socket ? (p) => socket.emit('design-review:pointer', { reviewId, ...p }) : undefined;
    const pointerList = Object.values(pointers).map((p) => ({ ...p, name: people[p.userId]?.username || 'Someone' }));

    const actions = (
        <>
            <Btn variant="ghost" icon={ArrowLeft} onClick={() => navigate(`/workspace/${workspaceId}/reviews`)}>All reviews</Btn>
            {fileCurrent > 1 && (
                <Btn variant="ghost" icon={mode === 'compare' ? PenTool : Columns2} onClick={() => setMode((m) => (m === 'compare' ? 'review' : 'compare'))}>
                    {mode === 'compare' ? 'Back to review' : 'Compare versions'}
                </Btn>
            )}
            {perms.canManage && behind && <Btn icon={Layers} onClick={() => setConfirm('round')}>Review v{fileCurrent}</Btn>}
            {perms.canDecide && (
                <>
                    <Btn icon={AlertTriangle} onClick={() => setDecision('changes_requested')} disabled={myDecision === 'changes_requested'}>Request changes</Btn>
                    <Btn variant="primary" icon={Check} onClick={() => setDecision('approved')} disabled={myDecision === 'approved'}>Approve</Btn>
                </>
            )}
            {perms.canManage && <IconBtn label="Delete review" onClick={() => setConfirm('delete')} style={{ width: 32, height: 32, border: '1px solid var(--border-default)' }}><Trash2 size={14} /></IconBtn>}
        </>
    );

    const lead = (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Chip tone={status.tone}>{status.label}</Chip>
            <span>{review.file?.name || 'File'} · version {review.versionNumber}{behind ? ` (file is at v${fileCurrent})` : ''}</span>
            {review.dueDate && <span>· due {new Date(review.dueDate).toLocaleDateString()}</span>}
        </span>
    );

    return (
        <DashPage wide head={<PageHead eyebrow="Design review" title={review.title} icon={PenTool} lead={lead} actions={actions} />}>
            {review.description && <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{review.description}</p>}

            {mode === 'compare' ? (
                <VersionCompare review={review} />
            ) : (
                <div className="dr-layout">
                    <div className="dr-stage">
                        <div className="dr-stage-bar">
                            <Btn size="sm" variant={annotating ? 'primary' : undefined} icon={annotating ? MessageSquarePlus : MousePointer2} onClick={() => { setAnnotating((v) => !v); setDraft(null); }} aria-pressed={annotating}>
                                {annotating ? 'Commenting: click or drag on the file' : 'Add comment'}
                            </Btn>
                            {kind === 'pdf' && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <IconBtn label="Previous page" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}><ChevronLeft size={14} /></IconBtn>
                                    <span>Page</span>
                                    <input className="gl-input" type="number" min={1} value={page} onChange={(e) => setPage(Math.max(1, Number(e.target.value) || 1))} aria-label="PDF page" style={{ width: 64 }} />
                                    <IconBtn label="Next page" onClick={() => setPage((p) => p + 1)}><ChevronRight size={14} /></IconBtn>
                                </span>
                            )}
                            <span className="dr-spacer" />
                            {viewers.filter((v) => v !== me).length > 0 && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} aria-label="Also viewing">
                                    {viewers.filter((v) => v !== me).slice(0, 5).map((v) => (
                                        <span key={v} title={people[v]?.username || 'Viewer'}><Avatar user={people[v] || { username: '?' }} size="sm" /></span>
                                    ))}
                                    <span>viewing</span>
                                </span>
                            )}
                            <IconBtn label="Refresh" onClick={load}><RefreshCcw size={14} className={state.loading ? 'animate-spin' : ''} /></IconBtn>
                        </div>
                        <ReviewCanvas
                            ref={canvasRef}
                            kind={kind}
                            url={review.version?.url}
                            annotations={current}
                            numbers={numbers}
                            activeId={activeId}
                            draft={draft}
                            annotating={annotating}
                            page={page}
                            onSelect={select}
                            onDraft={(d) => { setDraft(d); setActiveId(null); }}
                            onPointer={emitPointer}
                            pointers={pointerList}
                        />
                    </div>

                    <div className="dr-side">
                        {draft && (
                            <Panel flush>
                                <div className="dr-draft">
                                    <strong style={{ fontSize: 13 }}>New comment{kind === 'video' && draft.timeMs !== null ? ` at ${formatTimestamp(draft.timeMs)}` : ''}{kind === 'pdf' ? ` on page ${draft.page}` : ''}</strong>
                                    <textarea className="gl-input" rows={3} autoFocus value={draftBody} onChange={(e) => setDraftBody(e.target.value)} placeholder="What should change here?" aria-label="Comment" maxLength={5000}
                                        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) postDraft(); }} />
                                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                        <Btn size="sm" variant="ghost" onClick={() => { setDraft(null); setDraftBody(''); }} disabled={posting}>Cancel</Btn>
                                        <Btn size="sm" variant="primary" loading={posting} disabled={!draftBody.trim()} onClick={postDraft}>Comment</Btn>
                                    </div>
                                </div>
                            </Panel>
                        )}

                        <Panel title="Reviewers">
                            {(review.reviewers || []).length === 0 && <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>No reviewers yet.</span>}
                            {(review.reviewers || []).map((r) => {
                                const d = DECISION[r.decision] || DECISION.pending;
                                return (
                                    <div key={idOf(r.user)} className="dr-reviewer" title={r.note || undefined}>
                                        <Avatar user={r.user || {}} size="sm" />
                                        <strong>{r.user?.username || 'Reviewer'}{idOf(r.user) === me ? ' (you)' : ''}</strong>
                                        <Chip tone={d.tone}>{d.label}</Chip>
                                    </div>
                                );
                            })}
                            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                                Started by {review.createdBy?.username || 'someone'} · {timeAgo(review.createdAt)}
                                {(review.rounds || []).length > 1 && ` · round ${review.rounds.length}`}
                            </div>
                        </Panel>

                        <Panel flush title={`Comments · ${openCount} open`} action={null}>
                            <div style={{ padding: '0 14px 10px' }}>
                                <FilterTabs label="Show comments" value={filter} onChange={setFilter}
                                    options={[{ value: 'open', label: 'Open', count: openCount }, { value: 'resolved', label: 'Resolved', count: current.length - openCount }, { value: 'all', label: 'All' }]} />
                            </div>
                            <div className="dr-threads">
                                {listed.length === 0 ? (
                                    <EmptyState icon={MessageSquare}
                                        title={filter === 'resolved' ? 'Nothing resolved yet' : 'No open comments'}
                                        text={filter === 'resolved' ? 'Resolved comments move here.' : 'Choose “Add comment”, then click or drag on the file to pin feedback to a spot.'} />
                                ) : listed.map((a) => {
                                    const author = idOf(a.authorId) === me;
                                    return (
                                        <AnnotationThread
                                            key={a._id}
                                            annotation={a}
                                            number={numbers[a._id]}
                                            active={activeId === a._id}
                                            kind={kind}
                                            canResolve={author || isCreator || isReviewer}
                                            canDelete={author || perms.canManage}
                                            onSelect={select}
                                            onReply={onReply}
                                            onResolve={onResolve}
                                            onDelete={onDelete}
                                            showToast={showToast}
                                        />
                                    );
                                })}
                            </div>
                        </Panel>
                    </div>
                </div>
            )}

            <Dialog
                open={Boolean(decision)}
                title={decision === 'approved' ? 'Approve this design?' : 'Request changes?'}
                lead={decision === 'approved' ? 'The review creator is notified. You can change your decision later.' : 'Tell the creator what needs to change. Pinned comments help them find each spot.'}
                onClose={() => setDecision(null)}
                busy={deciding}
                size="sm"
                footer={(
                    <>
                        <Btn variant="ghost" onClick={() => setDecision(null)} disabled={deciding}>Cancel</Btn>
                        <Btn variant="primary" loading={deciding} onClick={decide}>{decision === 'approved' ? 'Approve' : 'Request changes'}</Btn>
                    </>
                )}
            >
                <Field label="Note (optional)" htmlFor="dr-note">
                    <textarea id="dr-note" className="gl-input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
                </Field>
            </Dialog>

            <Confirm
                open={Boolean(confirm)}
                title={confirm === 'round' ? `Start a new round on version ${fileCurrent}?` : 'Delete this review?'}
                confirmLabel={confirm === 'round' ? 'Start round' : 'Delete'}
                tone={confirm === 'delete' ? 'danger' : undefined}
                busy={busy}
                onConfirm={doConfirm}
                onClose={() => setConfirm(null)}
            >
                {confirm === 'round'
                    ? 'Reviewers see the new version and every decision goes back to pending. Comments on earlier versions stay in the compare view.'
                    : 'The review and all of its comments are removed for everyone. The file itself stays in the library.'}
            </Confirm>
        </DashPage>
    );
}
