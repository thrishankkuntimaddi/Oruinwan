// Knowledge: the workspace's pages (handbooks, how-tos), written in Markdown like on the web.
// Members can read, create, edit and delete pages; edits save as you type (the server keeps
// earlier versions).
import { useEffect, useRef, useState } from 'react';
import { PageExtras } from './PageExtras.jsx';
import { BookOpen, ChevronDown, ChevronRight, Ellipsis, FilePlus2, FileText, GraduationCap, Link2, Pencil, Plus, RefreshCw, Trash2, TriangleAlert, Upload, Users, Workflow } from 'lucide-react';
import { IMPORT_ACCEPT, readImportFiles } from './importPages.js';
import { nav } from '../../app/nav.js';
import { api, useSession } from '../../data/session.js';
import { useKnowledge } from '../../data/hooks.js';
import { invalidate, setQueryData, useQuery } from '../../data/query.js';
import { Body, Header, Screen } from '../../ui/Screen.jsx';
import { Button, IconButton } from '../../ui/Button.jsx';
import { SearchField, Segmented } from '../../ui/Controls.jsx';
import { ActionSheet, Dialog, Sheet } from '../../ui/Overlay.jsx';
import { EmptyState, SkeletonRows, Spinner } from '../../ui/Feedback.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Markdown } from '../../ui/Markdown.jsx';
import { cx } from '../../ui/cx.js';
import { shortAgo } from '../../lib/time.js';
import { toast } from '../../lib/bus.js';
import { useLiveDocument } from '../../lib/collab/useCollab.js';
import { useTextareaBinding } from '../../lib/collab/useEditorBinding.js';
import { collabView } from '../../lib/collab/state.js';
import { CollabBanner, PresenceAvatars } from '../../lib/collab/CollabUi.jsx';

// The same starter pages as the web (client/src/pages/SidebarComp/KnowledgePage.jsx).
export const PAGE_TEMPLATES = [
  { icon: FileText, emoji: '📄', title: 'Blank page', text: 'Start from nothing.', content: '' },
  {
    icon: Users,
    emoji: '📘',
    title: 'Team handbook',
    text: 'Who does what, how to reach each other and the tools you use.',
    content:
      '# Team handbook\n\n## Who we are\nOne paragraph on what this team does and why.\n\n## People and roles\n- Name: role, what to ask them about\n\n## How to reach us\n- Urgent: \n- Everything else: \n\n## Tools we use\n- ',
  },
  {
    icon: Workflow,
    emoji: '🧭',
    title: 'How we work',
    text: 'Your process for planning, reviews and shipping, in one place.',
    content:
      '# How we work\n\n## Planning\nWhen we plan and who joins.\n\n## Doing the work\n- How tasks are picked up\n- Where updates go\n\n## Reviews\nWhat a good review looks like.\n\n## Shipping\n1. Checklist step\n2. Checklist step',
  },
  {
    icon: GraduationCap,
    emoji: '👋',
    title: 'Onboarding guide',
    text: 'Everything a new teammate needs in their first week.',
    content:
      '# Onboarding guide\n\n> Welcome! Start here on your first day.\n\n## Day one\n- Get access to: \n- Meet: \n\n## First week\n- Read: \n- Ship a small change\n\n## Who to ask\n- ',
  },
];

const PAGE_ICONS = ['📄', '📘', '🧭', '👋', '🚀', '🔍', '🔐', '💡', '🛠️', '📣', '✅', '📊', '🗂️', '🎯', '🧪', '📅'];

function NewPageSheet({ open, onClose, parentId = null }) {
  const ws = useSession((s) => s.workspaceId);
  const [busy, setBusy] = useState(null);
  const create = async (t) => {
    setBusy(t.title);
    try {
      const page = await api().createPage(ws, {
        title: t.content ? t.title : '',
        content: t.content,
        icon: t.emoji,
        parentId,
      });
      invalidate('knowledge');
      onClose();
      nav.push('page', { id: page.id, edit: true, fresh: !t.content });
    } catch (err) {
      toast(err.message || "Couldn't create the page", 'danger');
    } finally {
      setBusy(null);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title={parentId ? 'New sub-page' : 'New page'}>
      <div className="px-2 pb-3">
        {PAGE_TEMPLATES.map((t) => (
          <button
            key={t.title}
            type="button"
            disabled={Boolean(busy)}
            onClick={() => create(t)}
            className="flex w-full items-center gap-3.5 rounded-xl px-3 py-3 text-left active:bg-surface-2 disabled:opacity-60"
            data-testid="page-template"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/12 text-accent-ink">
              {busy === t.title ? <Spinner /> : <Icon as={t.icon} size="sm" />}
            </span>
            <span className="min-w-0">
              <span className="block text-[15px]">{t.title}</span>
              <span className="block text-[13px] text-text-2">{t.text}</span>
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function PageRow({ page, depth, open, toggle, kidsOf }) {
  const kids = kidsOf(page.id);
  return (
    <>
      <div className="flex items-center" style={{ paddingLeft: depth * 20 }}>
        <button type="button" onClick={() => nav.push('page', { id: page.id })} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left active:bg-surface-2">
          <span className="text-xl" aria-hidden>
            {page.icon || '📄'}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px]">{page.title}</span>
            {page.excerpt && <span className="block truncate text-[13px] text-text-2">{page.excerpt}</span>}
          </span>
        </button>
        {kids.length > 0 && (
          <IconButton
            icon={open[page.id] ? ChevronDown : ChevronRight}
            label={open[page.id] ? 'Collapse' : `Show ${kids.length} sub-pages`}
            size="sm"
            className="mr-2 text-text-2"
            onClick={() => toggle(page.id)}
          />
        )}
      </div>
      {open[page.id] && kids.map((k) => <PageRow key={k.id} page={k} depth={depth + 1} open={open} toggle={toggle} kidsOf={kidsOf} />)}
    </>
  );
}

/** First visit: what Knowledge is for, with ways to start (write, a template, import). */
function KnowledgeWelcome({ onWrite, onImport, importing }) {
  const steps = [
    { icon: FileText, title: 'Pages', text: 'Written in Markdown and saved as you type.' },
    { icon: FilePlus2, title: 'Sub-pages', text: 'Nest pages to build a handbook or a how-to guide.' },
    { icon: Link2, title: 'Links', text: 'Link related pages so readers can move between them.' },
  ];
  return (
    <div className="px-4 pt-2 pb-6" data-testid="knowledge-welcome">
      <div className="rounded-card border border-line-soft bg-surface px-5 py-6 text-center">
        <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-line bg-surface-2 text-accent-ink">
          <Icon as={BookOpen} size="lg" />
        </span>
        <h3 className="text-base font-semibold">Start your team’s knowledge base</h3>
        <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-text-2">
          How you work, decisions you made, onboarding and the handbook, written once and easy to find.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Button icon={Plus} block onClick={() => onWrite()}>
            Write a page
          </Button>
          <Button variant="secondary" icon={Upload} block loading={importing} onClick={onImport}>
            Import Markdown or text
          </Button>
        </div>
      </div>
      <p className="mt-6 mb-2 px-1 text-[12px] font-semibold tracking-wider text-text-3 uppercase">Start from a template</p>
      <div className="overflow-hidden rounded-card border border-line-soft bg-surface divide-y divide-line-soft">
        {PAGE_TEMPLATES.filter((t) => t.content).map((t) => (
          <button key={t.title} type="button" onClick={() => onWrite(t)} className="flex w-full items-center gap-3.5 px-4 py-3 text-left active:bg-surface-2" data-testid="welcome-template">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/12 text-accent-ink">
              <Icon as={t.icon} size="sm" />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px]">{t.title}</span>
              <span className="block text-[13px] text-text-2">{t.text}</span>
            </span>
          </button>
        ))}
      </div>
      <ul className="mt-6 space-y-3 px-1">
        {steps.map((st) => (
          <li key={st.title} className="flex items-start gap-3 text-[13px] leading-relaxed text-text-2">
            <Icon as={st.icon} size={14} className="mt-0.5 shrink-0 text-accent-ink" />
            <span>
              <span className="font-semibold text-text">{st.title}</span> {st.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Creates a page straight from a template (used by the welcome screen). */
async function createFromTemplate(ws, t) {
  const page = await api().createPage(ws, { title: t.title, content: t.content, icon: t.emoji });
  invalidate('knowledge');
  nav.push('page', { id: page.id, edit: true });
}

export function KnowledgeScreen() {
  const ws = useSession((s) => s.workspaceId);
  const { data, loading, error, refetch } = useKnowledge();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState({});
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const importRef = useRef(null);
  const write = async (t) => {
    if (!t) return setCreating(true);
    try {
      await createFromTemplate(ws, t);
    } catch (err) {
      toast(err.message || "Couldn't create the page", 'danger');
    }
  };
  const importFiles = async (fileList) => {
    const files = [...(fileList || [])];
    if (!files.length) return;
    setImporting(true);
    try {
      const { pages: drafts, problems } = await readImportFiles(files);
      problems.forEach((p) => toast(p, 'danger'));
      let last = null;
      let count = 0;
      for (const d of drafts) {
        try {
          last = await api().createPage(ws, d);
          count += 1;
        } catch (err) {
          toast(err.message || `Couldn't import “${d.title}”`, 'danger');
        }
      }
      if (count) {
        invalidate('knowledge');
        toast(count === 1 ? `Imported “${last.title}”` : `Imported ${count} pages`);
        if (count === 1 && last?.id) nav.push('page', { id: last.id });
      }
    } finally {
      setImporting(false);
    }
  };
  const pages = data || [];
  const ids = new Set(pages.map((p) => p.id));
  // A page whose parent was deleted shows at the top level instead of disappearing.
  const roots = pages.filter((p) => !p.parentId || !ids.has(p.parentId));
  const kidsOf = (id) => pages.filter((p) => p.parentId === id);
  const toggle = (id) => setOpen((o) => ({ ...o, [id]: !o[id] }));
  const q = query.trim().toLowerCase();
  const matches = q ? pages.filter((p) => p.title.toLowerCase().includes(q) || p.excerpt?.toLowerCase().includes(q)) : null;

  return (
    <Screen>
      <Header
        title="Knowledge"
        actions={
          <>
            <IconButton icon={Upload} label="Import Markdown or text" onClick={() => importRef.current?.click()} />
            <IconButton icon={Plus} label="New page" onClick={() => setCreating(true)} />
          </>
        }
      >
        <div className="px-4 pb-3">
          <SearchField value={query} onChange={setQuery} placeholder="Find a page" />
        </div>
      </Header>
      <Body onRefresh={() => invalidate('knowledge')}>
        {loading ? (
          <SkeletonRows avatar={false} />
        ) : !pages.length && error ? (
          <EmptyState
            icon={TriangleAlert}
            title="Couldn’t load the knowledge base"
            body={error.message || 'Check your connection and try again.'}
            action={{ icon: RefreshCw, label: 'Try again', onClick: () => refetch() }}
          />
        ) : !pages.length ? (
          <KnowledgeWelcome onWrite={write} onImport={() => importRef.current?.click()} importing={importing} />
        ) : (
          <div className="mx-4 mt-1 overflow-hidden rounded-card border border-line-soft bg-surface divide-y divide-line-soft">
            {(matches || roots).map((p) => (
              <PageRow key={p.id} page={p} depth={0} open={matches ? {} : open} toggle={toggle} kidsOf={matches ? () => [] : kidsOf} />
            ))}
            {matches && !matches.length && <p className="px-4 py-6 text-center text-sm text-text-2">No pages match.</p>}
          </div>
        )}
      </Body>
      <NewPageSheet open={creating} onClose={() => setCreating(false)} />
      <input
        ref={importRef}
        type="file"
        accept={IMPORT_ACCEPT}
        multiple
        hidden
        data-testid="knowledge-import"
        onChange={(e) => {
          importFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </Screen>
  );
}

/** Grows a textarea with its content, so the page scrolls as one. */
function useAutoHeight(ref, value) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.max(el.scrollHeight, 240)}px`;
  }, [ref, value]);
}

const PAGE_PLACEHOLDER = 'Start writing. Markdown works: # heading, **bold**, *italic*, - list, > quote';
const TEXTAREA_CLASS =
  'selectable mt-4 block w-full resize-none bg-transparent font-mono text-[14px] leading-6 outline-none placeholder:font-sans placeholder:text-text-3';

function PageEditor({ page, fresh, onDone }) {
  const ws = useSession((s) => s.workspaceId);
  const [title, setTitle] = useState(fresh ? '' : page.title);
  const [content, setContent] = useState(page.content || '');
  const [icon, setIcon] = useState(page.icon || '📄');
  const [tab, setTab] = useState('write');
  const [status, setStatus] = useState('saved'); // saved | saving | error
  const [iconSheet, setIconSheet] = useState(false);
  const textRef = useRef(null);
  const latest = useRef({ title, content, icon });
  latest.current = { title, content, icon };
  const timer = useRef(null);
  const dirty = useRef(false);
  useAutoHeight(textRef, `${tab}:${content}`);
  // Live co-editing (docs/api/collab.md): the Markdown lives in the shared document and the
  // server saves it; title and icon still save over REST. 'rest' = older server, REST only.
  const { state: collab, doc, peers } = useLiveDocument('knowledge', page.id);
  const live = collab.mode !== 'rest';
  const liveRef = useRef(live);
  liveRef.current = live;
  const view = collabView(collab, { kind: 'page' });
  const bound = live && collab.everSynced;
  const binding = useTextareaBinding(doc, bound && tab === 'write', textRef, !view.editable, setContent);
  // Someone else's edits while the preview is showing.
  useEffect(() => {
    if (!doc || !bound) return undefined;
    const ytext = doc.getText('content');
    const sync = () => setContent(ytext.toString());
    sync();
    ytext.observe(sync);
    return () => ytext.unobserve(sync);
  }, [doc, bound]);
  const fields = ({ title: t, content: c, icon: i }) =>
    liveRef.current ? { title: t.trim() || 'Untitled page', icon: i } : { title: t.trim() || 'Untitled page', content: c, icon: i };

  const save = async () => {
    clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current) return true;
    dirty.current = false;
    setStatus('saving');
    try {
      const saved = await api().updatePage(page.id, fields(latest.current));
      setQueryData(`page:${page.id}`, (p) => ({ ...p, ...saved }));
      setQueryData(`knowledge:${ws}`, (list) => list?.map((p) => (p.id === page.id ? { ...p, title: saved.title, icon: saved.icon, updatedAt: saved.updatedAt } : p)));
      setStatus('saved');
      return true;
    } catch (err) {
      dirty.current = true;
      setStatus('error');
      toast(err.message || "Couldn't save. Your changes are still here.", 'danger');
      return false;
    }
  };

  const change = (patch) => {
    Object.assign(latest.current, patch);
    dirty.current = true;
    setStatus('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(save, 900);
  };

  // Leaving the screen saves what's pending.
  useEffect(
    () => () => {
      if (timer.current && dirty.current) {
        clearTimeout(timer.current);
        api()
          .updatePage(page.id, fields(latest.current))
          .then(() => invalidate('knowledge', `page:${page.id}`))
          .catch(() => toast("Your last edit to the page couldn't be saved.", 'danger'));
      }
    },
    [page.id],
  );

  const done = async () => {
    // The server saves the live document when we leave it; show the latest text right away.
    if (bound && doc) setQueryData(`page:${page.id}`, (p) => (p ? { ...p, content: doc.getText('content').toString() } : p));
    if (await save()) {
      invalidate('knowledge');
      onDone();
    }
  };

  return (
    <Screen>
      <Header
        title=""
        subtitle={status === 'saving' ? 'Saving…' : status === 'error' ? 'Not saved' : live ? view.subtitle : 'All changes saved'}
        actions={
          <>
            <PresenceAvatars peers={peers} />
            <Button size="sm" className="mr-2" onClick={done} data-testid="page-done">
              Done
            </Button>
          </>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIconSheet(true)}
            aria-label="Change the page's icon"
            className="pressable grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-line bg-surface text-[26px]"
          >
            {icon}
          </button>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              change({ title: e.target.value });
            }}
            placeholder="Untitled page"
            autoFocus={fresh}
            aria-label="Page title"
            className="min-w-0 flex-1 bg-transparent text-[24px] font-bold leading-tight tracking-tight outline-none placeholder:text-text-3"
          />
        </div>
        <CollabBanner text={view.banner} tone={collab.mode === 'closed' ? 'locked' : 'offline'} />
        {collab.message && <CollabBanner text={collab.message} tone="locked" />}
        <Segmented
          className="mt-4"
          size="sm"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'write', label: 'Write' },
            { value: 'preview', label: 'Preview' },
          ]}
        />
        {tab === 'write' ? (
          <>
            {bound ? (
              <textarea
                key="live"
                ref={textRef}
                defaultValue={content}
                readOnly={!view.editable}
                onInput={() => binding.current?.input()}
                onCompositionStart={() => binding.current?.compositionStart()}
                onCompositionEnd={() => binding.current?.compositionEnd()}
                aria-label="Page content"
                placeholder={PAGE_PLACEHOLDER}
                className={TEXTAREA_CLASS}
              />
            ) : (
              <textarea
                key="rest"
                ref={textRef}
                value={content}
                readOnly={live}
                onChange={(e) => {
                  setContent(e.target.value);
                  change({ content: e.target.value });
                }}
                aria-label="Page content"
                placeholder={PAGE_PLACEHOLDER}
                className={TEXTAREA_CLASS}
              />
            )}
            <p className="mt-2 text-xs text-text-3"># Heading · **bold** · *italic* · `code` · &gt; quote · - list · 1. steps</p>
          </>
        ) : content.trim() ? (
          <Markdown text={content} className="mt-4" />
        ) : (
          <p className="mt-6 text-sm text-text-2">Nothing to preview yet. Switch to Write to add content.</p>
        )}
      </div>
      <Sheet open={iconSheet} onClose={() => setIconSheet(false)} title="Page icon">
        <div className="grid grid-cols-8 gap-1.5 px-4 pb-4">
          {PAGE_ICONS.map((e) => (
            <button
              key={e}
              type="button"
              aria-label={`Icon ${e}`}
              aria-pressed={e === icon}
              onClick={() => {
                setIcon(e);
                change({ icon: e });
                setIconSheet(false);
              }}
              className={cx('pressable grid aspect-square place-items-center rounded-xl text-[22px]', e === icon ? 'bg-accent/15 ring-1 ring-accent/60' : 'bg-surface-2')}
            >
              {e}
            </button>
          ))}
        </div>
      </Sheet>
    </Screen>
  );
}

export function PageScreen({ id, edit = false, fresh = false }) {
  const { data: page, loading } = useQuery(`page:${id}`, () => api().page(id), { staleMs: 0 });
  const { data: pages } = useKnowledge();
  const [editing, setEditing] = useState(edit);
  const [menu, setMenu] = useState(false);
  const [subPage, setSubPage] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!page) {
    return (
      <Screen>
        <Header title="" />
        {loading ? <SkeletonRows count={4} avatar={false} /> : <EmptyState icon={BookOpen} title="Page not found" body="It may have been deleted." />}
      </Screen>
    );
  }

  if (editing) return <PageEditor page={page} fresh={fresh} onDone={() => setEditing(false)} />;

  const kids = (pages || []).filter((p) => p.parentId === id);
  const remove = async () => {
    setDeleting(true);
    try {
      await api().deletePage(id);
      invalidate('knowledge');
      setConfirm(false);
      nav.pop();
      toast('Page deleted');
    } catch (err) {
      toast(err.message || "Couldn't delete the page", 'danger');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Screen>
      <Header
        title={page.title}
        actions={
          <>
            <IconButton icon={Pencil} label="Edit page" onClick={() => setEditing(true)} />
            <IconButton icon={Ellipsis} label="More" onClick={() => setMenu(true)} />
          </>
        }
      />
      <Body>
        <article className="px-5">
          <span className="text-4xl" aria-hidden>
            {page.icon || '📄'}
          </span>
          <h1 className="mt-2 text-[26px] font-bold leading-tight tracking-tight">{page.title}</h1>
          <p className="mt-1 text-xs text-text-3">Updated {shortAgo(page.updatedAt)}</p>
          {page.content?.trim() ? (
            <Markdown text={page.content} className="mt-4" />
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="mt-6 flex items-center gap-2 text-sm text-text-2">
              <Icon as={Pencil} size={14} /> This page is empty. Tap to write.
            </button>
          )}
          {kids.length > 0 && (
            <div className="mt-8">
              <p className="mb-2 text-[12px] font-semibold tracking-wider text-text-3 uppercase">Sub-pages</p>
              <div className="overflow-hidden rounded-card border border-line-soft bg-surface divide-y divide-line-soft">
                {kids.map((k) => (
                  <button key={k.id} type="button" onClick={() => nav.push('page', { id: k.id })} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2">
                    <span className="text-lg" aria-hidden>
                      {k.icon || '📄'}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[15px]">{k.title}</span>
                    <Icon as={ChevronRight} size="sm" className="text-text-3" />
                  </button>
                ))}
              </div>
            </div>
          )}
          <PageExtras page={page} />
        </article>
      </Body>
      <ActionSheet
        open={menu}
        onClose={() => setMenu(false)}
        title={page.title}
        actions={[
          { icon: Pencil, label: 'Edit page', onSelect: () => setEditing(true) },
          { icon: FilePlus2, label: 'Add a sub-page', onSelect: () => setSubPage(true) },
          { icon: Trash2, label: 'Delete page', danger: true, onSelect: () => setConfirm(true) },
        ]}
      />
      <NewPageSheet open={subPage} onClose={() => setSubPage(false)} parentId={id} />
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Delete this page?"
        body={`“${page.title}” will be removed for everyone in this workspace.${kids.length ? ' Its sub-pages move to the top level.' : ''}`}
        confirmLabel="Delete"
        danger
        busy={deleting}
        onConfirm={remove}
      />
    </Screen>
  );
}
