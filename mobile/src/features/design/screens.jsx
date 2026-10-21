// Design review: reviews of library images, PDFs and videos with pinned comment threads,
// reviewer decisions and live updates (docs/api/design-review.md).
//  - List: every review in the workspace, filterable; start one from a library file or a new
//    photo / file from the phone.
//  - Review: the design with numbered pins (tap the image to drop one), each pin a thread you
//    can reply to and resolve; reviewers approve or request changes. Wide windows put the
//    comments beside the design; phones and split windows stack them under it.
// PDFs: the phone's WebView can't draw PDF pages (Android has no PDF renderer in WebView), so a
// PDF review lists its comments by page, opens the PDF in the system viewer and adds comments to
// a page rather than to a spot on it.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check, CheckCircle2, ExternalLink, File as FileIcon, FileImage, FileText, FileVideo, MessageSquare, MoreHorizontal, PenTool, Plus, RotateCcw, Send, Trash2, Upload, Users, X,
} from 'lucide-react';
import { nav, useIsOpen } from '../../app/nav.js';
import { useWide } from '../../app/layout.js';
import { api, useSession } from '../../data/session.js';
import { useDirectory } from '../../data/hooks.js';
import { getQueryData, invalidate, setQueryData, useQuery } from '../../data/query.js';
import { on, toast } from '../../lib/bus.js';
import { shortAgo } from '../../lib/time.js';
import { validateUpload } from '../../lib/files.js';
import { Body, Header, Screen } from '../../ui/Screen.jsx';
import { Button, IconButton } from '../../ui/Button.jsx';
import { Chips, Field, SearchField } from '../../ui/Controls.jsx';
import { ActionSheet, Dialog, Sheet } from '../../ui/Overlay.jsx';
import { EmptyState, SkeletonRows, Spinner } from '../../ui/Feedback.jsx';
import { RowGroup, Section } from '../../ui/List.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { cx } from '../../ui/cx.js';
import { openFile, useMediaUrl } from '../media/media.js';
import { PeoplePicker, toDateInput } from '../tasks/TaskEditorSheet.jsx';
import {
  DECISION_LABEL, REVIEW_STATUS, applyAnnotationEvent, applyPresence, canDeleteAnnotation, canResolve, countsLabel, formatTime, myReviewer,
  numberAnnotations, pagesWithPins, pinFromPoint, pinPosition, visibleAnnotations,
} from './designUi.js';

const KIND_ICON = { image: FileImage, pdf: FileText, video: FileVideo };
const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'mine', label: 'Mine' },
  { value: 'open', label: 'In review' },
  { value: 'changes_requested', label: 'Changes requested' },
  { value: 'approved', label: 'Approved' },
];

function StatusPill({ status, className }) {
  const m = REVIEW_STATUS[status] || REVIEW_STATUS.open;
  return <span className={cx('inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-medium', m.chip, className)}>{m.label}</span>;
}

const userOf = (directory, u) => (u?.id ? { ...u, ...(directory[u.id] || {}), name: directory[u.id]?.name || u.name || 'Someone' } : null);

// ---------------------------------------------------------------- list

function ReviewRow({ review, directory }) {
  const selected = useIsOpen('designReview', review.id);
  const kind = review.file?.kind || 'image';
  return (
    <button
      type="button"
      onClick={() => nav.push('designReview', { id: review.id })}
      className={cx('flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-surface-2', selected && 'bg-accent/8')}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-accent/15 text-accent-ink">
        <Icon as={KIND_ICON[kind] || FileIcon} size="sm" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{review.title}</span>
        <span className="mt-0.5 block truncate text-[13px] text-text-2">
          v{review.versionNumber} · {countsLabel(review.counts)} · {shortAgo(review.updatedAt)}
        </span>
        <StatusPill status={review.status} className="mt-1.5" />
      </span>
      <span className="flex shrink-0 -space-x-2">
        {review.reviewers.slice(0, 3).map((r) => {
          const u = userOf(directory, r.user);
          return u ? <Avatar key={u.id} name={u.name} src={u.avatarUrl} size="xs" className="ring-2 ring-surface" /> : null;
        })}
      </span>
    </button>
  );
}

export function DesignReviewsScreen() {
  const ws = useSession((s) => s.workspaceId);
  const directory = useDirectory();
  const [filter, setFilter] = useState('all');
  const [creating, setCreating] = useState(false);
  const query = filter === 'mine' ? { mine: true } : filter === 'all' ? {} : { status: filter };
  const { data, loading, error, refetch } = useQuery(ws && `designReviews:${ws}:${filter}`, () => api().designReviews(ws, query), { staleMs: 20_000 });

  useEffect(
    () =>
      on('socket', ({ event }) => {
        if (event === 'design-review:created' || event === 'design-review:updated' || event === 'design-review:deleted') invalidate('designReviews');
      }),
    [],
  );

  return (
    <Screen>
      <Header title="Design reviews" subtitle="Mockups, pinned comments and approvals" actions={<IconButton icon={Plus} label="New review" onClick={() => setCreating(true)} />}>
        <Chips className="pb-2" options={FILTERS} value={filter} onChange={setFilter} />
      </Header>
      <Body onRefresh={() => invalidate('designReviews')}>
        {loading && !data ? (
          <SkeletonRows count={5} />
        ) : error && !data ? (
          <EmptyState icon={PenTool} title="Couldn't load reviews" body={error.message} action={<Button variant="secondary" onClick={refetch}>Try again</Button>} />
        ) : !data?.length ? (
          <EmptyState
            icon={PenTool}
            title={filter === 'all' ? 'No design reviews yet' : 'Nothing here'}
            body="Share an image, PDF or video from Files, ask people to review it and collect pinned comments and approvals."
            action={filter === 'all' ? <Button icon={Plus} onClick={() => setCreating(true)}>New review</Button> : null}
          />
        ) : (
          <Section>
            <RowGroup>
              {data.map((r) => (
                <ReviewRow key={r.id} review={r} directory={directory} />
              ))}
            </RowGroup>
          </Section>
        )}
      </Body>
      <NewReviewSheet open={creating} onClose={() => setCreating(false)} />
    </Screen>
  );
}

// ---------------------------------------------------------------- new review

function NewReviewSheet({ open, onClose }) {
  const ws = useSession((s) => s.workspaceId);
  const directory = useDirectory();
  const { data: files, loading } = useQuery(open && ws && `reviewFiles:${ws}`, () => api().reviewableFiles(ws), { staleMs: 30_000 });
  const [file, setFile] = useState(null);
  const [q, setQ] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reviewers, setReviewers] = useState([]);
  const [due, setDue] = useState('');
  const [picking, setPicking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef(null);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setQ('');
    setTitle('');
    setDescription('');
    setReviewers([]);
    setDue('');
  }, [open]);

  const choose = (f) => {
    setFile(f);
    setTitle((t) => t || f.name.replace(/\.[^.]+$/, ''));
  };
  const upload = async (e) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    const problem = validateUpload(picked);
    if (problem) return toast(problem, 'warning');
    setUploading(true);
    try {
      const f = await api().uploadReviewFile(ws, picked);
      invalidate('reviewFiles', 'files');
      if (!f.kind) toast('Only images, PDFs and videos can be reviewed.', 'warning');
      else choose(f);
    } catch (err) {
      toast(err.message || "Couldn't upload the file", 'danger');
    } finally {
      setUploading(false);
    }
    return undefined;
  };
  const create = async () => {
    setBusy(true);
    try {
      const review = await api().createDesignReview({ fileId: file.id, title: title.trim(), description: description.trim(), reviewers, dueDate: due || undefined });
      invalidate('designReviews');
      toast(reviewers.length ? 'Review requested' : 'Review created', 'success');
      onClose();
      nav.push('designReview', { id: review.id });
    } catch (err) {
      toast(err.message || "Couldn't start the review", 'danger');
    } finally {
      setBusy(false);
    }
  };

  const list = (files || []).filter((f) => !q || f.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={file ? 'New design review' : 'Pick a design'}
      full
      footer={file ? <Button block loading={busy} disabled={!title.trim()} onClick={create}>{reviewers.length ? 'Request review' : 'Start review'}</Button> : null}
    >
      <input ref={input} type="file" accept="image/*,application/pdf,video/*" className="hidden" onChange={upload} />
      {!file ? (
        <div className="pb-4">
          <div className="px-4">
            <Button block variant="secondary" icon={Upload} loading={uploading} onClick={() => input.current?.click()}>
              Upload a photo or file
            </Button>
          </div>
          <SearchField value={q} onChange={setQ} placeholder="Search images, PDFs and videos" className="mx-4 mt-3" />
          <div className="mt-2 px-2">
            {loading && <SkeletonRows count={4} />}
            {!loading && !list.length && <p className="px-3 py-8 text-center text-sm text-text-2">No images, PDFs or videos in Files yet.</p>}
            {list.map((f) => (
              <button key={f.id} type="button" onClick={() => choose(f)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left active:bg-surface-2">
                <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-surface-3 text-text-2">
                  <Icon as={KIND_ICON[f.kind] || FileIcon} size="sm" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px]">{f.name}</span>
                  <span className="block text-[12px] text-text-2">Version {f.version}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4 px-5 pb-4">
          <button type="button" onClick={() => setFile(null)} className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left">
            <Icon as={KIND_ICON[file.kind] || FileIcon} size="sm" className="text-accent-ink" />
            <span className="min-w-0 flex-1 truncate text-[15px]">{file.name}</span>
            <span className="text-[13px] text-accent-ink">Change</span>
          </button>
          <Field label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Home screen v2" />
          <Field label="What should reviewers look at?" multiline value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
          <button type="button" onClick={() => setPicking(true)} className="flex w-full items-center gap-3 rounded-xl border border-line bg-input px-3.5 py-3 text-left">
            <Icon as={Users} size="sm" className="text-text-3" />
            <span className="min-w-0 flex-1 truncate text-[15px]">{reviewers.length ? reviewers.map((id) => directory[id]?.name || 'Someone').join(', ') : 'Add reviewers'}</span>
          </button>
          <Field label="Due" type="date" value={due} min={toDateInput(new Date().toISOString())} onChange={(e) => setDue(e.target.value)} />
        </div>
      )}
      <PeoplePicker open={picking} onClose={() => setPicking(false)} value={reviewers} onChange={setReviewers} title="Reviewers" />
    </Sheet>
  );
}

// ---------------------------------------------------------------- the design with pins

function Pin({ n, annotation, active, onOpen }) {
  return (
    <button
      type="button"
      aria-label={`Comment ${n}${annotation.resolved ? ', resolved' : ''}: ${annotation.body}`}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(annotation);
      }}
      className={cx(
        'absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 text-[12px] font-bold shadow-md transition-transform',
        annotation.resolved ? 'border-surface bg-surface-3 text-text-2' : 'border-surface bg-gold text-on-accent',
        active && 'scale-125',
      )}
      style={pinPosition(annotation)}
    >
      {annotation.resolved ? <Icon as={Check} size={13} /> : n}
    </button>
  );
}

function DraftPin({ draft }) {
  if (!draft) return null;
  return <span className="pointer-events-none absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full border-2 border-accent bg-accent/30" style={pinPosition(draft)} aria-hidden />;
}

function ImageStage({ src, alt, pins, numbers, draft, activeId, onPlace, onOpen }) {
  const ref = useRef(null);
  return (
    <div className="flex justify-center">
      <div
        className="relative inline-block cursor-crosshair select-none"
        onClick={(e) => {
          const at = pinFromPoint(ref.current?.getBoundingClientRect(), e.clientX, e.clientY);
          if (at) onPlace(at);
        }}
      >
        <img ref={ref} src={src} alt={alt} draggable={false} className="block max-h-[70vh] max-w-full rounded-lg bg-surface-2 object-contain" />
        {pins.map((a) => (
          <Pin key={a.id} n={numbers.get(a.id)} annotation={a} active={a.id === activeId} onOpen={onOpen} />
        ))}
        <DraftPin draft={draft} />
      </div>
    </div>
  );
}

function VideoStage({ src, pins, numbers, draft, activeId, onPlace, onOpen, onTime }) {
  const video = useRef(null);
  const [placing, setPlacing] = useState(false);
  return (
    <div>
      <div className="relative">
        <video
          ref={video}
          src={src}
          controls
          playsInline
          className="block max-h-[65vh] w-full rounded-lg bg-black"
          onTimeUpdate={(e) => onTime(Math.round(e.currentTarget.currentTime * 1000))}
          onSeeked={(e) => onTime(Math.round(e.currentTarget.currentTime * 1000))}
        />
        <div
          className={cx('absolute inset-0', placing ? 'cursor-crosshair bg-black/10' : 'pointer-events-none')}
          onClick={(e) => {
            if (!placing) return;
            const at = pinFromPoint(video.current?.getBoundingClientRect(), e.clientX, e.clientY);
            if (at) {
              setPlacing(false);
              onPlace({ ...at, timeMs: Math.round((video.current?.currentTime || 0) * 1000) });
            }
          }}
        >
          {pins.map((a) => (
            <span key={a.id} className="pointer-events-auto">
              <Pin n={numbers.get(a.id)} annotation={a} active={a.id === activeId} onOpen={onOpen} />
            </span>
          ))}
          <DraftPin draft={draft} />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[12px] text-text-2">{placing ? 'Tap the frame where your comment goes.' : 'Pins near the playhead show on the frame.'}</p>
        <Button
          size="sm"
          variant={placing ? 'ghost' : 'secondary'}
          icon={placing ? X : MessageSquare}
          onClick={() => {
            video.current?.pause();
            setPlacing((v) => !v);
          }}
        >
          {placing ? 'Cancel' : 'Comment here'}
        </Button>
      </div>
    </div>
  );
}

function PdfStage({ review, file, page, setPage, annotations, onPlace }) {
  const pages = pagesWithPins(annotations);
  const maxPage = Math.max(page, ...pages.map((p) => p.page), 1);
  return (
    <div className="rounded-card border border-line-soft bg-surface p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-accent/15 text-accent-ink">
          <Icon as={FileText} size="sm" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium">{review.file?.name || 'PDF'}</p>
          <p className="text-[12px] text-text-2">Version {review.versionNumber}</p>
        </div>
        <Button size="sm" variant="secondary" icon={ExternalLink} onClick={() => openFile(file)}>
          Open
        </Button>
      </div>
      <p className="mt-3 text-[13px] text-text-2">Pins on PDFs are placed on the web or desktop app. Here you can read and answer them by page, and comment on a page.</p>
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
        {Array.from({ length: maxPage + 1 }, (_, i) => i + 1).map((p) => {
          const info = pages.find((x) => x.page === p);
          return (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              className={cx('pressable h-8 shrink-0 rounded-full border px-3 text-[13px] font-medium', p === page ? 'border-accent bg-accent/15 text-accent-ink' : 'border-line bg-surface text-text-2')}
            >
              {`Page ${p}`}
              {info?.open ? ` · ${info.open}` : ''}
            </button>
          );
        })}
      </div>
      <Button className="mt-3" block variant="secondary" icon={MessageSquare} onClick={() => onPlace({ x: 0.5, y: 0.5 })}>
        Comment on page {page}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------- threads

function CommentSheet({ open, draft, onClose, onPost, kind, page }) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setBody('');
  }, [open]);
  const post = async () => {
    setBusy(true);
    try {
      await onPost(body.trim());
      onClose();
    } finally {
      setBusy(false);
    }
  };
  const where = kind === 'pdf' ? `On page ${page}` : kind === 'video' && draft?.timeMs != null ? `At ${formatTime(draft.timeMs)}` : 'Pinned where you tapped';
  return (
    <Sheet open={open} onClose={onClose} title="New comment" footer={<Button block icon={Send} loading={busy} disabled={!body.trim()} onClick={post}>Comment</Button>}>
      <div className="px-5 pb-4">
        <p className="mb-2 text-[13px] text-text-2">{where}</p>
        <Field multiline autoFocus value={body} maxLength={5000} onChange={(e) => setBody(e.target.value)} placeholder="What should change here?" />
      </div>
    </Sheet>
  );
}

function ThreadSheet({ annotation, n, review, me, directory, onClose, onChange }) {
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(null);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => setReply(''), [annotation?.id]);
  if (!annotation) return null;
  const author = userOf(directory, annotation.author);
  const run = async (what, fn) => {
    setBusy(what);
    try {
      const next = await fn();
      if (next) onChange(next);
      return true;
    } catch (err) {
      toast(err.message || 'Something went wrong', 'danger');
      return false;
    } finally {
      setBusy(null);
    }
  };
  const send = async () => {
    const text = reply.trim();
    if (!text) return;
    if (await run('reply', () => api().replyAnnotation(review.id, annotation.id, text))) setReply('');
  };
  const remove = async () => {
    if (await run('delete', () => api().deleteAnnotation(review.id, annotation.id))) {
      onChange({ id: annotation.id, deleted: true });
      setConfirm(false);
      onClose();
    }
  };
  return (
    <Sheet
      open={Boolean(annotation)}
      onClose={onClose}
      title={`Comment ${n || ''}`.trim()}
      footer={
        <div className="flex items-end gap-2">
          <Field className="min-w-0 flex-1" value={reply} maxLength={5000} onChange={(e) => setReply(e.target.value)} placeholder="Reply" onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())} />
          <IconButton icon={Send} label="Send reply" onClick={send} disabled={!reply.trim() || busy === 'reply'} />
        </div>
      }
    >
      <div className="px-5 pb-3">
        <div className="flex gap-3">
          <Avatar name={author?.name || 'Someone'} src={author?.avatarUrl} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px]">
              <span className="font-semibold">{author?.name || 'Someone'}</span> <span className="text-text-3">{shortAgo(annotation.at)}</span>
              {annotation.timeMs != null && <span className="text-text-3"> · {formatTime(annotation.timeMs)}</span>}
            </p>
            <p className="mt-0.5 whitespace-pre-wrap text-[15px] leading-relaxed">{annotation.body}</p>
          </div>
        </div>
        {annotation.replies.map((r) => {
          const u = userOf(directory, r.author);
          return (
            <div key={r.id} className="mt-3 flex gap-3 pl-6">
              <Avatar name={u?.name || 'Someone'} src={u?.avatarUrl} size="xs" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px]">
                  <span className="font-semibold">{u?.name || 'Someone'}</span> <span className="text-text-3">{shortAgo(r.at)}</span>
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-[14px] leading-relaxed">{r.body}</p>
              </div>
            </div>
          );
        })}
        <div className="mt-4 flex gap-2">
          {canResolve(annotation, review, me) && (
            <Button
              size="sm"
              variant="secondary"
              icon={annotation.resolved ? RotateCcw : CheckCircle2}
              loading={busy === 'resolve'}
              onClick={() => run('resolve', () => api().resolveAnnotation(review.id, annotation.id, !annotation.resolved))}
            >
              {annotation.resolved ? 'Reopen' : 'Resolve'}
            </Button>
          )}
          {canDeleteAnnotation(annotation, review, me) && (
            <Button size="sm" variant="danger" icon={Trash2} onClick={() => setConfirm(true)}>
              Delete
            </Button>
          )}
        </div>
        {annotation.resolved && <p className="mt-2 text-[12px] text-text-2">Resolved{annotation.resolvedBy ? ` by ${userOf(directory, annotation.resolvedBy)?.name}` : ''}</p>}
      </div>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Delete this comment?" body="Its replies are deleted too." confirmLabel="Delete" danger busy={busy === 'delete'} onConfirm={remove} />
    </Sheet>
  );
}

function CommentList({ list, numbers, directory, onOpen, showResolved, setShowResolved }) {
  const open = list.filter((a) => !a.resolved).length;
  return (
    <Section
      title={`Comments · ${open} open`}
      action={
        <button type="button" className="text-[13px] font-medium text-accent-ink" onClick={() => setShowResolved((v) => !v)}>
          {showResolved ? 'Hide resolved' : 'Show resolved'}
        </button>
      }
    >
      {!list.length ? (
        <p className="mx-5 text-[13px] text-text-2">No comments yet. Tap the design to pin one.</p>
      ) : (
        <RowGroup>
          {list
            .slice()
            .sort((a, b) => numbers.get(a.id) - numbers.get(b.id))
            .map((a) => {
              const u = userOf(directory, a.author);
              return (
                <button key={a.id} type="button" onClick={() => onOpen(a)} className={cx('flex w-full gap-3 px-4 py-3 text-left active:bg-surface-2', a.resolved && 'opacity-60')}>
                  <span className={cx('grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold', a.resolved ? 'bg-surface-3 text-text-2' : 'bg-gold text-on-accent')}>
                    {a.resolved ? <Icon as={Check} size={12} /> : numbers.get(a.id)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] text-text-2">
                      {u?.name || 'Someone'} · {shortAgo(a.at)}
                      {a.timeMs != null ? ` · ${formatTime(a.timeMs)}` : ''}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[15px]">{a.body}</span>
                    {a.replies.length > 0 && <span className="mt-1 block text-[12px] text-accent-ink">{a.replies.length} repl{a.replies.length === 1 ? 'y' : 'ies'}</span>}
                  </span>
                </button>
              );
            })}
        </RowGroup>
      )}
    </Section>
  );
}

function Decision({ review, me, directory, onChange }) {
  const mine = myReviewer(review, me);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(null);
  const decide = async (decision, text) => {
    setBusy(decision);
    try {
      onChange(await api().decideDesignReview(review.id, decision, text));
      toast(decision === 'approved' ? 'Approved' : decision === 'changes_requested' ? 'Changes requested' : 'Decision withdrawn', 'success');
      setAsking(false);
      setNote('');
    } catch (err) {
      toast(err.message || "Couldn't save your decision", 'danger');
    } finally {
      setBusy(null);
    }
  };
  return (
    <Section title="Reviewers">
      <RowGroup>
        {!review.reviewers.length && <p className="px-4 py-3 text-[13px] text-text-2">No reviewers yet.</p>}
        {review.reviewers.map((r) => {
          const u = userOf(directory, r.user);
          return (
            <div key={r.user?.id} className="flex items-center gap-3 px-4 py-2.5">
              <Avatar name={u?.name || 'Someone'} src={u?.avatarUrl} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px]">{u?.name || 'Someone'}{r.user?.id === me ? ' (you)' : ''}</span>
                {r.note && <span className="block truncate text-[12px] text-text-2">“{r.note}”</span>}
              </span>
              <span className={cx('text-[12px] font-medium', r.decision === 'approved' ? 'text-success' : r.decision === 'changes_requested' ? 'text-warning' : 'text-text-3')}>{DECISION_LABEL[r.decision]}</span>
            </div>
          );
        })}
      </RowGroup>
      {review.permissions.canDecide && mine && (
        <div className="mx-4 mt-3 flex gap-2">
          {mine.decision === 'pending' ? (
            <>
              <Button className="flex-1" icon={Check} loading={busy === 'approved'} onClick={() => decide('approved')}>
                Approve
              </Button>
              <Button className="flex-1" variant="secondary" loading={busy === 'changes_requested'} onClick={() => setAsking(true)}>
                Request changes
              </Button>
            </>
          ) : (
            <Button block variant="secondary" icon={RotateCcw} loading={busy === 'pending'} onClick={() => decide('pending')}>
              Change my decision
            </Button>
          )}
        </div>
      )}
      <Dialog open={asking} onClose={() => setAsking(false)} title="Request changes" confirmLabel="Request changes" busy={busy === 'changes_requested'} onConfirm={() => decide('changes_requested', note.trim())}>
        <Field className="mt-3" multiline value={note} onChange={(e) => setNote(e.target.value)} placeholder="What needs to change? (optional)" />
      </Dialog>
    </Section>
  );
}

// ---------------------------------------------------------------- review screen

export function DesignReviewScreen({ id }) {
  const me = useSession((s) => s.user?.id);
  const directory = useDirectory();
  const wide = useWide();
  const key = `designReview:${id}`;
  const { data, loading, error, refetch } = useQuery(key, () => api().designReview(id), { staleMs: 10_000 });
  const review = data?.review;
  const annotations = useMemo(() => data?.annotations || [], [data]);
  const [viewers, setViewers] = useState([]);
  const [page, setPage] = useState(1);
  const [timeMs, setTimeMs] = useState(null);
  const [draft, setDraft] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [showResolved, setShowResolved] = useState(true);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const kind = review?.file?.kind || (review?.version?.mimeType ? (review.version.mimeType.startsWith('video/') ? 'video' : review.version.mimeType === 'application/pdf' ? 'pdf' : 'image') : 'image');
  const versionFile = useMemo(() => (review?.version?.url ? { url: review.version.url, name: review.file?.name || review.title, mimeType: review.version.mimeType } : null), [review?.version?.url, review?.file?.name, review?.title, review?.version?.mimeType]);
  const media = useMediaUrl(versionFile);

  // Live room: join on open (and after a reconnect), leave on close.
  useEffect(() => {
    let alive = true;
    const join = () => api().joinDesignReview?.(id).then((v) => alive && v && setViewers(v.filter((x) => x !== me)));
    join();
    const offRt = on('realtime', ({ connected }) => connected && join());
    const offSocket = on('socket', ({ event, payload }) => {
      if (!event.startsWith('design-review:') || String(payload?.reviewId) !== String(id)) return;
      if (event === 'design-review:annotation') {
        setQueryData(key, (cur) => (cur ? { ...cur, annotations: applyAnnotationEvent(cur.annotations, payload, api().mapAnnotation) } : cur));
      } else if (event === 'design-review:updated') {
        const cur = getQueryData(key);
        const next = payload.review && api().mapReview(payload.review);
        if (!cur || !next || next.versionNumber !== cur.review.versionNumber) invalidate(key);
        else setQueryData(key, { ...cur, review: { ...cur.review, ...next, file: cur.review.file, version: cur.review.version, permissions: cur.review.permissions } });
        invalidate('designReviews');
      } else if (event === 'design-review:deleted') {
        toast('This review was deleted', 'warning');
        invalidate('designReviews');
        nav.pop();
      } else if (event === 'design-review:presence') {
        setViewers((v) => applyPresence(v, payload, me));
      }
    });
    return () => {
      alive = false;
      offRt();
      offSocket();
      api().leaveDesignReview?.(id);
    };
  }, [id, key, me]);

  if (!review) {
    return (
      <Screen>
        <Header title="Design review" />
        <Body>
          {loading ? <SkeletonRows count={4} /> : <EmptyState icon={PenTool} title="Couldn't open this review" body={error?.message || 'It may have been deleted.'} action={<Button variant="secondary" onClick={refetch}>Try again</Button>} />}
        </Body>
      </Screen>
    );
  }

  const ofVersion = annotations.filter((a) => a.versionNumber == null || a.versionNumber === review.versionNumber);
  const numbers = numberAnnotations(ofVersion);
  const pins = visibleAnnotations(ofVersion, { kind, page, timeMs, showResolved });
  const listed = visibleAnnotations(ofVersion, { kind: kind === 'pdf' ? 'pdf' : 'image', page, showResolved });
  const active = annotations.find((a) => a.id === openId) || null;

  const patchAnnotation = (next) =>
    setQueryData(key, (cur) => {
      if (!cur) return cur;
      if (next.deleted) return { ...cur, annotations: cur.annotations.filter((a) => a.id !== next.id) };
      const at = cur.annotations.findIndex((a) => a.id === next.id);
      const list = cur.annotations.slice();
      if (at < 0) list.push(next);
      else list[at] = next;
      return { ...cur, annotations: list };
    });
  const setReview = (next) => {
    setQueryData(key, (cur) => (cur ? { ...cur, review: { ...cur.review, ...next, file: cur.review.file, version: cur.review.version, permissions: cur.review.permissions } } : cur));
    invalidate('designReviews');
  };
  const post = async (body) => {
    try {
      const a = await api().addAnnotation(id, { ...draft, ...(kind === 'pdf' ? { page } : {}), body });
      patchAnnotation(a);
      invalidate('designReviews');
      setDraft(null);
    } catch (err) {
      toast(err.message || "Couldn't add the comment", 'danger');
      throw err;
    }
  };

  const fileForOpen = versionFile ? { ...versionFile, kind } : null;
  const canNewRound = review.permissions.canManage && review.file && review.file.currentVersion > review.versionNumber;
  const runMenu = async (what) => {
    setBusy(true);
    try {
      if (what === 'round') {
        await api().newDesignRound(id);
        invalidate(key, 'designReviews');
        toast(`Review moved to version ${review.file.currentVersion}`, 'success');
      } else if (what === 'delete') {
        await api().deleteDesignReview(id);
        invalidate('designReviews');
        toast('Review deleted', 'success');
        nav.pop();
      }
      setConfirm(null);
    } catch (err) {
      toast(err.message || 'Something went wrong', 'danger');
    } finally {
      setBusy(false);
    }
  };

  const stage =
    kind === 'pdf' ? (
      <PdfStage review={review} file={fileForOpen} page={page} setPage={setPage} annotations={ofVersion} onPlace={setDraft} />
    ) : !media.url ? (
      <div className="grid h-64 place-items-center rounded-card border border-line-soft bg-surface">
        {media.error ? <Button variant="secondary" onClick={media.retry}>Couldn't load the design. Try again</Button> : <Spinner className="text-text-2" />}
      </div>
    ) : kind === 'video' ? (
      <VideoStage src={media.url} pins={pins} numbers={numbers} draft={draft} activeId={openId} onPlace={setDraft} onOpen={(a) => setOpenId(a.id)} onTime={setTimeMs} />
    ) : (
      <ImageStage src={media.url} alt={review.title} pins={pins} numbers={numbers} draft={draft} activeId={openId} onPlace={setDraft} onOpen={(a) => setOpenId(a.id)} />
    );

  const side = (
    <>
      <div className="mx-4 mt-3 flex flex-wrap items-center gap-2">
        <StatusPill status={review.status} />
        {review.due && <span className="text-[12px] text-text-2">Due {new Date(review.due).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>}
        {review.rounds.length > 1 && <span className="text-[12px] text-text-2">Round {review.rounds.length}</span>}
      </div>
      {review.description && <p className="mx-4 mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-text-2">{review.description}</p>}
      <Decision review={review} me={me} directory={directory} onChange={setReview} />
      <CommentList list={listed} numbers={numbers} directory={directory} onOpen={(a) => setOpenId(a.id)} showResolved={showResolved} setShowResolved={setShowResolved} />
    </>
  );

  const viewerAvatars = viewers.length ? (
    <span className="mr-1 flex -space-x-2" aria-label={`${viewers.length} other${viewers.length === 1 ? '' : 's'} viewing`}>
      {viewers.slice(0, 3).map((v) => (
        <Avatar key={v} name={directory[v]?.name || 'Someone'} src={directory[v]?.avatarUrl} size="xs" presence="online" className="ring-2 ring-bg" />
      ))}
    </span>
  ) : null;

  return (
    <Screen>
      <Header
        title={review.title}
        subtitle={`Version ${review.versionNumber}${review.file?.name ? ` · ${review.file.name}` : ''}`}
        actions={
          <>
            {viewerAvatars}
            <IconButton icon={MoreHorizontal} label="More" onClick={() => setMenu(true)} />
          </>
        }
      />
      <Body fluid={wide} onRefresh={() => invalidate(key)}>
        {wide ? (
          <div className="flex min-h-full pt-3">
            <div className="min-w-0 flex-1 pl-4">{stage}</div>
            <div className="w-[360px] shrink-0">{side}</div>
          </div>
        ) : (
          <>
            <div className="px-4 pt-3">{stage}</div>
            {kind === 'image' && <p className="mx-4 mt-2 text-[12px] text-text-3">Tap the design to pin a comment.</p>}
            {side}
          </>
        )}
      </Body>

      <CommentSheet open={Boolean(draft)} draft={draft} kind={kind} page={page} onClose={() => setDraft(null)} onPost={post} />
      <ThreadSheet annotation={active} n={active ? numbers.get(active.id) : null} review={review} me={me} directory={directory} onClose={() => setOpenId(null)} onChange={patchAnnotation} />
      <ActionSheet
        open={menu}
        onClose={() => setMenu(false)}
        actions={[
          fileForOpen && { label: kind === 'pdf' ? 'Open the PDF' : 'Open full screen', icon: ExternalLink, onSelect: () => openFile(fileForOpen) },
          review.fileId && { label: 'Open in Files', icon: FileIcon, onSelect: () => nav.push('file', { id: review.fileId }) },
          canNewRound && { label: `Start a new round on version ${review.file.currentVersion}`, icon: RotateCcw, hint: 'Decisions reset to waiting', onSelect: () => setConfirm('round') },
          review.permissions.canManage && { label: 'Delete review', icon: Trash2, danger: true, onSelect: () => setConfirm('delete') },
        ]}
      />
      <Dialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm === 'delete' ? 'Delete this review?' : 'Start a new round?'}
        body={confirm === 'delete' ? 'Its comments and decisions are deleted. The file stays in Files.' : 'Reviewers are asked to look again at the newest version. Earlier comments stay on their version.'}
        confirmLabel={confirm === 'delete' ? 'Delete' : 'Start round'}
        danger={confirm === 'delete'}
        busy={busy}
        onConfirm={() => runMenu(confirm)}
      />
    </Screen>
  );
}
