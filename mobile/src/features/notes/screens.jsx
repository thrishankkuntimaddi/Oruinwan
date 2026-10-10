import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText, Plus, Star, Users, EllipsisVertical, Archive, ArchiveRestore, Heading2, Bold, Italic, List, ListOrdered, ListChecks, Code, Check, Lock, Globe, Sparkles, Undo2,
} from 'lucide-react';
import { TabHeader } from '../../app/TabHeader.jsx';
import { nav } from '../../app/nav.js';
import { api, useSession } from '../../data/session.js';
import { useDirectory, useMembers, useNotes } from '../../data/hooks.js';
import { invalidate, setQueryData, useQuery } from '../../data/query.js';
import { NOTE_TYPES } from '../../data/constants.js';
import { Body, Header, Screen } from '../../ui/Screen.jsx';
import { IconButton, Button } from '../../ui/Button.jsx';
import { Chips, SearchField, Segmented } from '../../ui/Controls.jsx';
import { ActionSheet, Dialog, Sheet } from '../../ui/Overlay.jsx';
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

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'favorites', label: 'Favorites' },
  { value: 'mine', label: 'Mine' },
  { value: 'shared', label: 'Shared with me' },
  { value: 'archived', label: 'Archived' },
];

function NoteRow({ note, directory }) {
  const shared = (note.sharedWith || []).map((id) => directory[id]).filter(Boolean);
  return (
    <button
      type="button"
      onClick={() => nav.push('note', { id: note.id })}
      className="flex w-full flex-col gap-1 px-4 py-3.5 text-left active:bg-surface-2"
    >
      <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-accent-ink">
        {NOTE_TYPES[note.type] || 'Note'}
        {note.pinned && <Icon as={Star} size={12} className="fill-current" aria-label="Favorite" />}
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

export function NotesScreen() {
  const me = useSession((s) => s.user?.id);
  const ws = useSession((s) => s.workspaceId);
  const { data, loading } = useNotes();
  const directory = useDirectory();
  const [query, setQuery] = useState('');
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

  const create = async (tpl) => {
    setTemplates(false);
    try {
      const note = await api().createNote(ws, { title: tpl.id === 'blank' ? '' : tpl.title, type: tpl.type, content: tpl.content });
      invalidate('notes');
      nav.push('note', { id: note.id, fresh: true });
    } catch (err) {
      toast(err.message || 'Could not create the note', 'danger');
    }
  };

  return (
    <Screen>
      <TabHeader title="Notes">
        <div className="space-y-2.5 pb-3">
          <div className="px-4">
            <SearchField value={query} onChange={setQuery} placeholder="Search notes" />
          </div>
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
            body={query ? 'Try a different word.' : 'Meeting notes, specs, ideas — keep them with your team.'}
            action={!query && filter !== 'archived' ? { label: 'New note', icon: Plus, onClick: () => setTemplates(true) } : null}
          />
        )}
      </Body>
      <button
        type="button"
        aria-label="New note"
        onClick={() => setTemplates(true)}
        className="pressable absolute right-4 z-10 grid h-14 w-14 place-items-center rounded-2xl bg-gold text-on-accent"
        style={{ bottom: 'calc(var(--sab) + 76px)' }}
      >
        <Icon as={Plus} size="lg" />
      </button>
      <Sheet open={templates} onClose={() => setTemplates(false)} title="New note">
        <div className="grid grid-cols-2 gap-2.5 px-4 pb-4">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => create(t)}
              className="pressable flex flex-col items-start rounded-card border border-line bg-surface-2 p-3.5 text-left"
            >
              <span className="text-xl" aria-hidden>
                {t.emoji}
              </span>
              <span className="mt-2 text-[14px] font-medium">{t.label}</span>
              <span className="text-xs text-text-2">{t.hint}</span>
            </button>
          ))}
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
  const editorRef = useRef(null);
  const titleRef = useRef('');
  const loadedRef = useRef(false);
  const timer = useRef(null);

  // Load content into the editor once; afterwards the editor owns it.
  useEffect(() => {
    if (!note || loadedRef.current) return;
    loadedRef.current = true;
    titleRef.current = note.title === 'Untitled' && fresh ? '' : note.title;
    setTitle(titleRef.current);
    if (editorRef.current) editorRef.current.innerHTML = sanitizeHtml(note.content);
  }, [note, fresh]);

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
      save({ title: titleRef.current.trim() || 'Untitled', content: sanitizeHtml(editorRef.current?.innerHTML || '') });
    }, 800);
  };

  // Flush a pending save when leaving the screen.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        if (editorRef.current && loadedRef.current) {
          api()
            .updateNote(id, { title: titleRef.current.trim() || 'Untitled', content: sanitizeHtml(editorRef.current.innerHTML) })
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
      scheduleSave();
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

  return (
    <Screen>
      <Header
        title=""
        subtitle={canEdit ? statusText : 'View only'}
        actions={
          <>
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
          {NOTE_TYPES[note.type] || 'Note'}
        </button>
        <input
          value={title}
          readOnly={!canEdit}
          onChange={(e) => {
            titleRef.current = e.target.value;
            setTitle(e.target.value);
            scheduleSave();
          }}
          placeholder="Untitled"
          autoFocus={fresh}
          className="w-full bg-transparent text-[26px] font-bold leading-tight tracking-tight outline-none placeholder:text-text-3"
        />
        {note.archived && (
          <p className="mt-3 rounded-xl border border-line bg-surface px-3 py-2 text-[13px] text-text-2">This note is archived. Restore it from the menu to edit.</p>
        )}
        <div
          ref={editorRef}
          contentEditable={canEdit && !note.archived}
          suppressContentEditableWarning
          onInput={scheduleSave}
          onClick={onEditorClick}
          data-placeholder="Start writing…"
          className="prose-oru editor-empty selectable mt-4 min-h-[50vh] outline-none"
        />
      </div>
      {canEdit && !note.archived && keyboardOpen && (
        <div className="no-scrollbar flex shrink-0 gap-1 overflow-x-auto border-t border-line-soft bg-surface px-2 py-1.5">
          {TOOLS.map((t) => (
            <button
              key={t.label}
              type="button"
              aria-label={t.label}
              onPointerDown={(e) => {
                e.preventDefault();
                t.run();
                scheduleSave();
              }}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-text-2 active:bg-surface-3"
            >
              <Icon as={t.icon} size="sm" />
            </button>
          ))}
        </div>
      )}
      <ActionSheet
        open={menu}
        onClose={() => setMenu(false)}
        actions={[
          aiOn && {
            label: 'Summarize with AI',
            icon: Sparkles,
            onSelect: () => askAiAbout(`Summarize my note "${note.title}" and list its action items:\n\n${htmlToText(editorRef.current?.innerHTML || note.content, 3000)}`),
          },
          note.archived
            ? { label: 'Restore note', icon: ArchiveRestore, onSelect: async () => { await api().archiveNote(id, false); invalidate('notes', `note:${id}`); toast('Note restored'); } }
            : note.ownerId === me && { label: 'Archive note', icon: Archive, danger: true, onSelect: () => setConfirmArchive(true) },
        ]}
      />
      <ActionSheet
        open={typeSheet}
        onClose={() => setTypeSheet(false)}
        title="Note type"
        actions={Object.entries(NOTE_TYPES).map(([value, label]) => ({
          label: `${label}${value === note.type ? '  ✓' : ''}`,
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
