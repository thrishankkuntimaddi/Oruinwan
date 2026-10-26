import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText, Plus, Star, Users, EllipsisVertical, SquareCheckBig, Archive, ArchiveRestore, BellRing, Copy, Link2, ListTodo, MessageSquareText, SpellCheck, Trash2, Heading2, Bold, Italic, List, ListOrdered, ListChecks, Code, Check, Lock, Globe, Sparkles, Undo2,
} from 'lucide-react';
import { TabHeader } from '../../app/TabHeader.jsx';
import { nav, useIsOpen } from '../../app/nav.js';
import { api, useSession } from '../../data/session.js';
import { useDirectory, useMembers, useNotes } from '../../data/hooks.js';
import { invalidate, setQueryData, useQuery } from '../../data/query.js';
import { NOTE_TYPES, NOTE_TYPE_OPTIONS } from '../../data/constants.js';
import { Body, Header, Screen } from '../../ui/Screen.jsx';
import { IconButton, Button, Fab } from '../../ui/Button.jsx';
import { Chips, Segmented } from '../../ui/Controls.jsx';
import { ActionSheet, Dialog, Sheet } from '../../ui/Overlay.jsx';
import { actionItemsBlock, summaryBlock } from './noteAi.js';
import { NotePages } from './NotePages.jsx';
import { ScheduleSheet } from '../chats/ScheduleSheet.jsx';
import { useWebUrl } from '../../data/live/webUrl.js';
import { copyText } from '../../native/index.js';
import { EmptyState, SkeletonRows } from '../../ui/Feedback.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { cx } from '../../ui/cx.js';
import { shortAgo } from '../../lib/time.js';
import { toast } from '../../lib/bus.js';
import { htmlToText, sanitizeHtml } from '../../ui/sanitize.js';
import { useFlag } from '../../config/flags.js';
import { useKeyboard } from '../../native/keyboard.js';
import { askAiAbout } from '../ai/aiUi.js';
import { TEMPLATES } from './templates.js';
import { TaskEditorSheet } from '../tasks/TaskEditorSheet.jsx';
import { noteTaskInitial, sourceTaskAction } from '../tasks/sourceTask.js';
import { usePlan } from '../plan/plan.js';
import { isPlanLimit, templateKey, templateUsage } from '../plan/planText.js';
import { prefs } from '../../native/storage.js';
import { RoadmapScreen } from '../roadmap/screens.jsx';
import { useLiveDocument } from '../../lib/collab/useCollab.js';
import { useNoteBinding } from '../../lib/collab/useEditorBinding.js';
import { collabView } from '../../lib/collab/state.js';
import { CollabBanner, PresenceAvatars } from '../../lib/collab/CollabUi.jsx';

// Same words as the web's Notes panel (All · Starred chips, the Archived section).
export const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'favorites', label: 'Starred' },
  { value: 'mine', label: 'Mine' },
  { value: 'shared', label: 'Shared with me' },
  { value: 'archived', label: 'Archived' },
];

/** The Notes tab's two sections, like the web's Notes panel tabs. */
export const NOTES_SECTIONS = [
  { value: 'notes', label: 'Notes' },
  { value: 'roadmap', label: 'Roadmap' },
];

/** Notes tab root: a Notes · Roadmap control on top; roadmap items open in this tab's stack. */
export function NotesScreen() {
  const [section, setSection] = useState(() => (prefs.get('notes.section', 'notes') === 'roadmap' ? 'roadmap' : 'notes'));
  const pick = (v) => {
    prefs.set('notes.section', v);
    setSection(v);
  };
  const control = (
    <div className="px-4">
      <Segmented size="sm" options={NOTES_SECTIONS} value={section} onChange={pick} />
    </div>
  );
  return section === 'roadmap' ? <RoadmapScreen section={control} /> : <NotesList section={control} />;
}

function NoteRow({ note, directory }) {
  const shared = (note.sharedWith || []).map((id) => directory[id]).filter(Boolean);
  const selected = useIsOpen('note', note.id);
  return (
    <button
      type="button"
      onClick={() => nav.push('note', { id: note.id })}
      aria-current={selected ? 'true' : undefined}
      className={cx('flex w-full flex-col gap-1 px-4 py-3.5 text-left active:bg-surface-2', selected && 'bg-surface-2')}
    >
      <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-accent-ink">
        {NOTE_TYPES[note.type] || 'Document'}
        {note.pinned && <Icon as={Star} size={12} className="fill-current" aria-label="Starred" />}
      </span>
      <span className="truncate text-[16px] font-semibold">{note.title || 'Untitled'}</span>
      <span className="line-clamp-2 text-[13px] leading-relaxed text-text-2">{htmlToText(note.content, 160) || 'Empty note'}</span>
      <span className="mt-1 flex items-center gap-2 text-[11px] text-text-3">
        {shortAgo(note.updatedAt)}
        {shared.length > 0 && (
          <span className="flex items-center gap-1">
            · <Icon as={Users} size={11} /> {shared.length}
          </span>
        )}
      </span>
    </button>
  );
}

function NotesList({ section }) {
  const me = useSession((s) => s.user?.id);
  const ws = useSession((s) => s.workspaceId);
  const { data, loading } = useNotes();
  const directory = useDirectory();
  const query = '';
  const [filter, setFilter] = useState('all');
  const [templates, setTemplates] = useState(false);

  const notes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data || []).filter((n) => {
      if (filter === 'archived' ? !n.archived : n.archived) return false;
      if (filter === 'favorites' && !n.pinned) return false;
      if (filter === 'mine' && n.ownerId !== me) return false;
      if (filter === 'shared' && n.ownerId === me) return false;
      return !q || n.title.toLowerCase().includes(q) || htmlToText(n.content, 2000).toLowerCase().includes(q);
    });
  }, [data, filter, query, me]);

  // The free plan counts notes per template (blank notes are unlimited).
  const { data: plan } = usePlan(ws);

  const create = async (tpl) => {
    setTemplates(false);
    try {
      const templateId = templateKey(tpl);
      const note = await api().createNote(ws, {
        title: tpl.id === 'blank' ? '' : tpl.title,
        type: tpl.type,
        content: tpl.content,
        ...(templateId ? { templateId } : {}),
      });
      invalidate('notes');
      if (templateId) invalidate('plan:');
      nav.push('note', { id: note.id, fresh: true });
    } catch (err) {
      if (!isPlanLimit(err)) toast(err.message || 'Could not create the note', 'danger');
    }
  };

  return (
    <Screen>
      <TabHeader title="Notes">
        <div className="space-y-2.5 pb-3">
          {section}
          {/* Searching is the header's search, which lists notes first on this tab. */}
          <Chips options={FILTERS} value={filter} onChange={setFilter} />
        </div>
      </TabHeader>
      <Body tab="notes" onRefresh={() => invalidate('notes')}>
        {loading ? (
          <SkeletonRows count={6} avatar={false} />
        ) : notes.length ? (
          <div className="mx-4 mt-1 overflow-hidden rounded-card border border-line-soft bg-surface divide-y divide-line-soft">
            {notes.map((n) => (
              <NoteRow key={n.id} note={n} directory={directory} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={FileText}
            title={query ? 'No notes match' : filter === 'archived' ? 'No archived notes' : 'No notes yet'}
            body={query ? 'Try a different word.' : filter === 'archived' ? 'Notes you archive are kept here.' : 'Meeting notes, specs, ideas — keep them with your team.'}
            action={!query && filter !== 'archived' ? { label: 'New note', icon: Plus, onClick: () => setTemplates(true) } : null}
          />
        )}
      </Body>
      <Fab compact icon={Plus} label="New note" onClick={() => setTemplates(true)} />
      <Sheet open={templates} onClose={() => setTemplates(false)} title="New note">
        <div className="grid grid-cols-2 gap-2.5 px-4 pb-4">
          {TEMPLATES.map((t) => {
            const usage = templateUsage(plan, templateKey(t));
            const full = Boolean(usage?.atLimit);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => create(t)}
                disabled={full}
                data-testid={`note-template-${t.id}`}
                className="pressable flex flex-col items-start rounded-card border border-line bg-surface-2 p-3.5 text-left disabled:opacity-55 disabled:active:scale-100"
              >
                <span className="text-xl" aria-hidden>
                  {t.emoji}
                </span>
                <span className="mt-2 text-[14px] font-medium">{t.label}</span>
                <span className={cx('text-xs', full ? 'text-warning' : 'text-text-2')}>
                  {full ? `${usage.used} of ${usage.max} used on the free plan` : t.hint}
                </span>
              </button>
            );
          })}
        </div>
      </Sheet>
    </Screen>
  );
}

const TOOLS = [
  { icon: Heading2, label: 'Heading', run: () => document.execCommand('formatBlock', false, 'h2') },
  { icon: Bold, label: 'Bold', run: () => document.execCommand('bold') },
  { icon: Italic, label: 'Italic', run: () => document.execCommand('italic') },
  { icon: List, label: 'Bulleted list', run: () => document.execCommand('insertUnorderedList') },
  { icon: ListOrdered, label: 'Numbered list', run: () => document.execCommand('insertOrderedList') },
  {
    icon: ListChecks,
    label: 'Checklist',
    run: () => {
      document.execCommand('insertUnorderedList');
      const node = window.getSelection()?.anchorNode;
      const ul = (node?.nodeType === 1 ? node : node?.parentElement)?.closest('ul');
      if (ul) {
        ul.setAttribute('data-type', 'checklist');
        ul.querySelectorAll('li').forEach((li) => li.hasAttribute('data-checked') || li.setAttribute('data-checked', 'false'));
      }
    },
  },
  { icon: Code, label: 'Code block', run: () => document.execCommand('formatBlock', false, 'pre') },
  { icon: Undo2, label: 'Undo', run: () => document.execCommand('undo') },
];

function ShareSheet({ open, onClose, note, onSave }) {
  const { data: members } = useMembers();
  const me = useSession((s) => s.user?.id);
  const [visibility, setVisibility] = useState(note.visibility === 'workspace' ? 'workspace' : 'private');
  const [people, setPeople] = useState(note.sharedWith || []);
  const toggle = (id) => setPeople((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Share note"
      footer={
        <Button
          block
          onClick={() => {
            onSave({ visibility, sharedWith: people });
            onClose();
          }}
        >
          Save sharing
        </Button>
      }
    >
      <div className="px-5 pb-2">
        <Segmented
          value={visibility}
          onChange={setVisibility}
          options={[
            { value: 'private', label: 'Only people I pick' },
            { value: 'workspace', label: 'Whole workspace' },
          ]}
        />
        <p className="mt-2 flex items-center gap-1.5 text-xs text-text-2">
          <Icon as={visibility === 'workspace' ? Globe : Lock} size={13} />
          {visibility === 'workspace' ? 'Every member of this workspace can view it.' : 'Only you and the people below can open it.'}
        </p>
      </div>
      <div className="px-2 pb-3">
        {(members || [])
          .filter((u) => u.id !== me)
          .map((u) => (
            <button key={u.id} type="button" onClick={() => toggle(u.id)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left active:bg-surface-2">
              <Avatar name={u.name} src={u.avatarUrl} size="sm" />
              <span className="flex-1 text-[15px]">{u.name}</span>
              <span className={cx('grid h-6 w-6 place-items-center rounded-md border', people.includes(u.id) ? 'border-accent bg-accent text-on-accent' : 'border-line-strong')}>
                {people.includes(u.id) && <Icon as={Check} size={14} />}
              </span>
            </button>
          ))}
      </div>
    </Sheet>
  );
}

export function NoteScreen({ id, fresh }) {
  const ws = useSession((s) => s.workspaceId);
  const me = useSession((s) => s.user?.id);
  const keyboardOpen = useKeyboard((s) => s.open);
  const aiOn = useFlag('ai');
  const { data: note, loading } = useQuery(`note:${id}`, () => api().note(id), { staleMs: 0 });
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('saved'); // saved | saving | error
  const [menu, setMenu] = useState(false);
  const [share, setShare] = useState(false);
  const [typeSheet, setTypeSheet] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [makingTask, setMakingTask] = useState(false);
  const [aiBusy, setAiBusy] = useState(null);
  const openLinkedTask = (taskId) => nav.push('task', { id: taskId }, { tab: 'tasks' });
  const linkTask = (taskId) => setQueryData(`note:${id}`, (n) => (n ? { ...n, linkedTaskId: taskId } : n));
  const server = useSession((s) => s.server);
  const webBase = useWebUrl(server);
  const editorRef = useRef(null);
  const titleRef = useRef('');
  const loadedRef = useRef(false);
  const timer = useRef(null);
  // Live co-editing (docs/api/collab.md). The note's content then lives in the shared document
  // and the server saves it; only the title and settings still go over REST. 'rest' mode is an
  // older server without live editing: everything saves over REST as before.
  const { state: collab, doc, peers } = useLiveDocument('note', id);
  const live = collab.mode !== 'rest';
  const liveRef = useRef(live);
  liveRef.current = live;
  const view = collabView(collab, { kind: 'note' });
  const binding = useNoteBinding(doc, live && collab.everSynced && Boolean(note), editorRef);

  // Load content into the editor once; afterwards the editor owns it.
  useEffect(() => {
    if (!note || loadedRef.current) return;
    loadedRef.current = true;
    titleRef.current = note.title === 'Untitled' && fresh ? '' : note.title;
    setTitle(titleRef.current);
    // Already showing the live document: don't put the REST copy over it.
    if (editorRef.current && !binding.current) editorRef.current.innerHTML = sanitizeHtml(note.content);
  }, [note, fresh, binding]);

  const canEdit = note && (note.ownerId === me || (note.sharedWith || []).includes(me) || note.visibility === 'workspace');

  const save = async (patch) => {
    setStatus('saving');
    try {
      const saved = await api().updateNote(id, patch);
      setQueryData(`notes:${ws}`, (list) => list?.map((n) => (n.id === id ? { ...n, ...saved } : n)));
      setStatus('saved');
    } catch (err) {
      setStatus('error');
      toast(err.message || "Couldn't save. Your changes are still here.", 'danger');
    }
  };

  const scheduleSave = () => {
    setStatus('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      const title = titleRef.current.trim() || 'Untitled';
      save(liveRef.current ? { title } : { title, content: sanitizeHtml(editorRef.current?.innerHTML || '') });
    }, 800);
  };

  /** The editor changed: into the shared document when live, else a REST save. */
  const edited = () => {
    if (binding.current) binding.current.input();
    else if (!liveRef.current) scheduleSave();
  };

  // Flush a pending save when leaving the screen.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        if (editorRef.current && loadedRef.current) {
          const title = titleRef.current.trim() || 'Untitled';
          api()
            .updateNote(id, liveRef.current ? { title } : { title, content: sanitizeHtml(editorRef.current.innerHTML) })
            .then(() => invalidate('notes'))
            .catch(() => {});
        }
      }
    },
    [id],
  );

  const onEditorClick = (e) => {
    // Tapping the box of a checklist item toggles it.
    const li = e.target.closest?.('ul[data-type="checklist"] > li');
    if (!li) return;
    const rect = li.getBoundingClientRect();
    if (e.clientX - rect.left < 28) {
      li.setAttribute('data-checked', li.getAttribute('data-checked') === 'true' ? 'false' : 'true');
      edited();
    }
  };

  /** AI help written into the note: a summary on top, action items at the end, or a proofread. */
  const runAi = async (action) => {
    const el = editorRef.current;
    const text = htmlToText(el?.innerHTML || note?.content || '', 40_000);
    if (!text.trim()) {
      toast('Write something first, then ask AI to help.');
      return;
    }
    setAiBusy(action === 'summarize' ? 'Summarizing…' : action === 'extract' ? 'Finding action items…' : 'Checking spelling and grammar…');
    try {
      const md = await api().noteAssist(action, text, { title: titleRef.current || note?.title });
      if (!el || !md.trim()) throw new Error('No answer came back.');
      if (action === 'summarize') el.innerHTML = sanitizeHtml(summaryBlock(md)) + el.innerHTML;
      else if (action === 'extract') el.innerHTML = el.innerHTML + sanitizeHtml(actionItemsBlock(md));
      else el.innerHTML = sanitizeHtml(md.split(/\n{2,}/).map((p) => `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>`).join(''));
      edited();
      toast(action === 'summarize' ? 'Summary added at the top' : action === 'extract' ? 'Action items added at the end' : 'Corrected', 'success');
    } catch (err) {
      toast(err.message || 'Oruinwan AI could not help with that', 'danger');
    } finally {
      setAiBusy(null);
    }
  };

  const duplicate = async () => {
    try {
      const copy = await api().createNote(ws, { title: `${titleRef.current || note.title} (copy)`, type: note.type, content: sanitizeHtml(editorRef.current?.innerHTML || note.content) });
      invalidate('notes');
      nav.replace('note', { id: copy.id });
      toast('Duplicated');
    } catch (err) {
      toast(err.message || 'Could not duplicate', 'danger');
    }
  };

  if (!note) {
    return (
      <Screen>
        <Header title="Note" />
        {loading ? <SkeletonRows count={4} avatar={false} /> : <EmptyState icon={FileText} title="Note not found" />}
      </Screen>
    );
  }

  const statusText = status === 'saving' ? 'Saving…' : status === 'error' ? 'Not saved' : `Saved · ${shortAgo(note.updatedAt)}`;
  // Live: the server decides who may write (readOnly); the content waits for the first sync.
  const contentEditable = (live ? view.editable : canEdit) && !note.archived;
  const titleEditable = canEdit && (!live || view.editable || collab.mode === 'connecting');
  const subtitle = !canEdit ? 'View only' : live ? (status === 'saving' ? 'Saving…' : view.subtitle) : statusText;

  return (
    <Screen>
      <Header
        title=""
        subtitle={subtitle}
        actions={
          <>
            <PresenceAvatars peers={peers} />
            <IconButton
              icon={Star}
              label={note.pinned ? 'Remove from favorites' : 'Add to favorites'}
              active={note.pinned}
              onClick={async () => {
                const pinned = !note.pinned;
                setQueryData(`note:${id}`, { ...note, pinned });
                await save({ pinned });
                invalidate('notes');
              }}
            />
            {note.ownerId === me && <IconButton icon={Users} label="Share" onClick={() => setShare(true)} />}
            <IconButton icon={EllipsisVertical} label="More" onClick={() => setMenu(true)} />
          </>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-10">
        <button type="button" onClick={() => canEdit && setTypeSheet(true)} className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-accent-ink">
          {NOTE_TYPES[note.type] || 'Document'}
        </button>
        <input
          value={title}
          readOnly={!titleEditable}
          onChange={(e) => {
            titleRef.current = e.target.value;
            setTitle(e.target.value);
            scheduleSave();
          }}
          placeholder="Untitled"
          autoFocus={fresh}
          className="w-full bg-transparent text-[26px] font-bold leading-tight tracking-tight outline-none placeholder:text-text-3"
        />
        <NotePages note={note} canEdit={canEdit && !note.archived} />
        <CollabBanner text={view.banner} tone={collab.mode === 'closed' ? 'locked' : 'offline'} />
        {collab.message && <CollabBanner text={collab.message} tone="locked" />}
        {note.archived && (
          <p className="mt-3 rounded-xl border border-line bg-surface px-3 py-2 text-[13px] text-text-2">This note is archived. Restore it from the menu to edit.</p>
        )}
        <div
          ref={editorRef}
          contentEditable={contentEditable}
          suppressContentEditableWarning
          onInput={edited}
          onCompositionStart={() => binding.current?.compositionStart()}
          onCompositionEnd={() => binding.current?.compositionEnd()}
          onClick={onEditorClick}
          data-placeholder="Start writing…"
          className="prose-oru editor-empty selectable mt-4 min-h-[50vh] outline-none"
        />
      </div>
      {contentEditable && keyboardOpen && (
        <div className="no-scrollbar flex shrink-0 gap-1 overflow-x-auto border-t border-line-soft bg-surface px-2 py-1.5">
          {TOOLS.map((t) => (
            <button
              key={t.label}
              type="button"
              aria-label={t.label}
              onPointerDown={(e) => {
                e.preventDefault();
                t.run();
                edited();
              }}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-text-2 active:bg-surface-3"
            >
              <Icon as={t.icon} size="sm" />
            </button>
          ))}
        </div>
      )}
      {aiBusy && (
        <div className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4" style={{ top: 'calc(var(--sat) + 64px)' }} role="status">
          <span className="glass flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] text-text-2">
            <Icon as={Sparkles} size={14} className="text-accent-ink" /> {aiBusy}
          </span>
        </div>
      )}
      <ActionSheet
        open={menu}
        onClose={() => setMenu(false)}
        title={note.title}
        actions={[
          aiOn && contentEditable && api().noteAssist && { label: 'Summarize into this note', hint: 'A short summary goes on top', icon: Sparkles, onSelect: () => runAi('summarize') },
          aiOn && contentEditable && api().noteAssist && { label: 'Pull out action items', hint: 'Added as a checklist at the end', icon: ListTodo, onSelect: () => runAi('extract') },
          aiOn && contentEditable && api().noteAssist && { label: 'Fix spelling and grammar', icon: SpellCheck, onSelect: () => runAi('proofread') },
          aiOn && { label: 'Discuss with AI', hint: 'Ask questions about this note', icon: MessageSquareText, onSelect: () => askAiAbout(`About my note "${note.title}":\n\n${htmlToText(editorRef.current?.innerHTML || note.content, 3000)}\n\n`) },
          api().remindNote && { label: 'Remind me', hint: 'Get a notification about this note later', icon: BellRing, onSelect: () => setTimeout(() => setReminding(true), 220) },
          api().makeTaskFrom && {
            label: sourceTaskAction(note.linkedTaskId),
            hint: note.linkedTaskId ? 'The task made from this note' : 'The task links back to this note',
            icon: SquareCheckBig,
            onSelect: () => (note.linkedTaskId ? openLinkedTask(note.linkedTaskId) : setTimeout(() => setMakingTask(true), 220)),
          },
          note.ownerId === me && { label: 'Share…', hint: note.visibility === 'workspace' ? 'Shared with the whole workspace' : (note.sharedWith || []).length ? `Shared with ${(note.sharedWith || []).length}` : 'Only you', icon: Users, onSelect: () => setTimeout(() => setShare(true), 220) },
          webBase && { label: 'Copy link', icon: Link2, onSelect: async () => ((await copyText(`${webBase}/workspace/${ws}/notes/${id}`)) ? toast('Link copied') : toast("Couldn't copy", 'danger')) },
          { label: 'Duplicate', icon: Copy, onSelect: duplicate },
          note.archived
            ? { label: 'Restore note', icon: ArchiveRestore, onSelect: async () => { await api().archiveNote(id, false); invalidate('notes', `note:${id}`); toast('Note restored'); } }
            : note.ownerId === me && { label: 'Archive note', icon: Archive, onSelect: () => setConfirmArchive(true) },
          note.ownerId === me && api().deleteNote && { label: note.parentId ? 'Delete this page' : 'Delete note', icon: Trash2, danger: true, onSelect: () => setConfirmDelete(true) },
        ]}
      />
      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={note.parentId ? 'Delete this page?' : 'Delete this note?'}
        body={note.parentId ? "The page is deleted for everyone. The note's other pages stay." : `It's deleted for everyone it was shared with${(note.pages || []).length > 1 ? ', with all its pages' : ''}. This can't be undone. Archive it instead to keep it out of the way.`}
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          setConfirmDelete(false);
          try {
            await api().deleteNote(id);
            setQueryData(`notes:${ws}`, (l) => l?.filter((n) => n.id !== id));
            invalidate('notes', note.parentId ? `note:${note.parentId}` : 'note:');
            if (note.parentId) nav.replace('note', { id: note.parentId });
            else nav.pop();
            toast(note.parentId ? 'Page deleted' : 'Note deleted');
          } catch (err) {
            toast(err.message || 'Could not delete', 'danger');
          }
        }}
      />
      <TaskEditorSheet
        open={makingTask}
        onClose={() => setMakingTask(false)}
        source={{ kind: 'note', id }}
        initial={makingTask ? noteTaskInitial({ ...note, title: titleRef.current || note.title }, editorRef.current?.innerHTML ?? note.content) : null}
        onCreated={(task) => linkTask(task.id)}
        onExisting={(taskId) => { linkTask(taskId); openLinkedTask(taskId); }}
      />
      <ScheduleSheet
        open={reminding}
        onClose={() => setReminding(false)}
        title="Remind me about this note"
        verb="Remind me"
        preview={titleRef.current || note.title}
        footnote="You'll get a notification (and a phone alert) at that time. It also shows in Activity → Calendar."
        onPick={async (when) => {
          setReminding(false);
          try {
            await api().remindNote(id, when);
            invalidate('noteReminders:');
            toast(`I'll remind you ${when.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`, 'success');
          } catch (err) {
            toast(err.message || 'Could not set the reminder', 'danger');
          }
        }}
      />
      <ActionSheet
        open={typeSheet}
        onClose={() => setTypeSheet(false)}
        title="Note type"
        actions={NOTE_TYPE_OPTIONS.map(([value, label]) => ({
          label: `${label}${value === (note.type === 'documentation' ? 'note' : note.type) ? '  ✓' : ''}`,
          onSelect: async () => {
            setQueryData(`note:${id}`, { ...note, type: value });
            await save({ type: value });
          },
        }))}
      />
      {share && (
        <ShareSheet
          open
          note={note}
          onClose={() => setShare(false)}
          onSave={async (patch) => {
            setQueryData(`note:${id}`, { ...note, ...patch });
            await save(patch);
            toast('Sharing updated', 'success');
          }}
        />
      )}
      <Dialog
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        title="Archive this note?"
        body="It moves to Archived, where you can restore it at any time."
        confirmLabel="Archive"
        danger
        onConfirm={async () => {
          setConfirmArchive(false);
          try {
            await api().archiveNote(id, true);
            invalidate('notes');
            nav.pop();
            toast('Note archived');
          } catch (err) {
            toast(err.message || 'Could not archive', 'danger');
          }
        }}
      />
    </Screen>
  );
}
