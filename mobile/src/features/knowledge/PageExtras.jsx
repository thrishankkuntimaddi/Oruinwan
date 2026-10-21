// Under a knowledge page: its category, an AI summary, the pages it links to and the pages
// that link back to it.
import { useMemo, useState } from 'react';
import { ArrowLeftRight, FolderTree, Link2, Plus, Sparkles, X } from 'lucide-react';
import { nav } from '../../app/nav.js';
import { api, useSession } from '../../data/session.js';
import { useKnowledge } from '../../data/hooks.js';
import { invalidate, setQueryData, useQuery } from '../../data/query.js';
import { useFlag } from '../../config/flags.js';
import { toast } from '../../lib/bus.js';
import { Button, IconButton } from '../../ui/Button.jsx';
import { Field, SearchField } from '../../ui/Controls.jsx';
import { Sheet } from '../../ui/Overlay.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Markdown } from '../../ui/Markdown.jsx';
import { cx } from '../../ui/cx.js';

function Heading({ children, action }) {
  return (
    <div className="mt-8 mb-2 flex items-end justify-between">
      <p className="text-[12px] font-semibold tracking-wider text-text-3 uppercase">{children}</p>
      {action}
    </div>
  );
}

function PageList({ pages, onRemove, empty }) {
  if (!pages.length) return <p className="rounded-card border border-dashed border-line px-4 py-3 text-sm text-text-2">{empty}</p>;
  return (
    <div className="overflow-hidden rounded-card border border-line-soft bg-surface divide-y divide-line-soft">
      {pages.map((p) => (
        <div key={p.id} className="flex items-center pr-1">
          <button type="button" onClick={() => nav.push('page', { id: p.id })} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left active:bg-surface-2">
            <span className="text-lg" aria-hidden>
              {p.icon}
            </span>
            <span className="min-w-0 flex-1 truncate text-[15px]">{p.title}</span>
          </button>
          {onRemove && <IconButton icon={X} size="sm" label={`Remove link to ${p.title}`} onClick={() => onRemove(p)} />}
        </div>
      ))}
    </div>
  );
}

function LinkPicker({ open, onClose, pageId, exclude, onPick }) {
  const { data: pages } = useKnowledge();
  const [query, setQuery] = useState('');
  const list = (pages || []).filter((p) => p.id !== pageId && !exclude.has(p.id) && (!query || p.title.toLowerCase().includes(query.toLowerCase()))).slice(0, 50);
  return (
    <Sheet open={open} onClose={onClose} title="Link to a page" full>
      <div className="px-4 pb-3">
        <SearchField value={query} onChange={setQuery} placeholder="Find a page" />
      </div>
      <div className="px-2 pb-3">
        {list.map((p) => (
          <button key={p.id} type="button" onClick={() => onPick(p)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left active:bg-surface-2">
            <span className="text-lg" aria-hidden>
              {p.icon}
            </span>
            <span className="min-w-0 flex-1 truncate text-[15px]">{p.title}</span>
          </button>
        ))}
        {!list.length && <p className="px-3 py-6 text-center text-sm text-text-2">No other pages to link.</p>}
      </div>
    </Sheet>
  );
}

function CategoryPicker({ open, onClose, value, onPick }) {
  const ws = useSession((s) => s.workspaceId);
  const { data: cats } = useQuery(ws && `kcategories:${ws}`, () => api().knowledgeCategories(ws), { staleMs: 60_000 });
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const create = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const c = await api().createKnowledgeCategory(ws, { name: name.trim() });
      setQueryData(`kcategories:${ws}`, (list) => [...(list || []), c]);
      setName('');
      onPick(c);
    } catch (err) {
      toast(err.message || "Couldn't create the category", 'danger');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Category">
      <div className="px-2 pb-2">
        {[{ id: null, name: 'No category' }, ...(cats || [])].map((c) => (
          <button key={c.id || 'none'} type="button" onClick={() => onPick(c)} className={cx('flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left active:bg-surface-2', (value || null) === c.id && 'text-accent-ink')}>
            <Icon as={FolderTree} size="sm" className="text-text-2" />
            <span className="flex-1 text-[15px]">{c.name}</span>
            {(value || null) === c.id && <span className="text-sm">✓</span>}
          </button>
        ))}
      </div>
      <form onSubmit={create} className="flex items-end gap-2 px-5 pb-4">
        <Field className="flex-1" label="New category" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Engineering" />
        <Button type="submit" icon={Plus} loading={busy} disabled={!name.trim()}>
          Add
        </Button>
      </form>
    </Sheet>
  );
}

export function PageExtras({ page }) {
  const ws = useSession((s) => s.workspaceId);
  const aiOn = useFlag('ai');
  const id = page.id;
  const meta = useQuery(`pagemeta:${id}`, () => api().pageMeta(id));
  const { data: cats } = useQuery(ws && `kcategories:${ws}`, () => api().knowledgeCategories(ws), { staleMs: 60_000 });
  const back = useQuery(`backlinks:${id}`, () => api().backlinks(id));
  const out = useQuery(ws && `pagelinks:${ws}:${id}`, () => api().outgoingLinks(ws, id));
  const [linking, setLinking] = useState(false);
  const [category, setCategory] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const linked = useMemo(() => new Set((out.data || []).map((p) => p.id)), [out.data]);
  const catName = (cats || []).find((c) => c.id === meta.data?.categoryId)?.name;

  const summarize = async () => {
    setSummarizing(true);
    try {
      const { summary } = await api().summarizePage(id);
      setQueryData(`pagemeta:${id}`, (m) => ({ ...(m || {}), summary }));
    } catch (err) {
      toast(err.message || "Oruinwan AI couldn't summarize this page", 'danger');
    } finally {
      setSummarizing(false);
    }
  };
  const link = async (p) => {
    setLinking(false);
    setQueryData(`pagelinks:${ws}:${id}`, (list) => [...(list || []), p]);
    try {
      await api().linkPage(ws, id, p.id);
      invalidate(`backlinks:${p.id}`);
    } catch (err) {
      toast(err.message || "Couldn't link the page", 'danger');
      invalidate(`pagelinks:${ws}:${id}`);
    }
  };
  const unlink = async (p) => {
    setQueryData(`pagelinks:${ws}:${id}`, (list) => (list || []).filter((x) => x.id !== p.id));
    try {
      await api().unlinkPage(id, p.id);
      invalidate(`backlinks:${p.id}`);
    } catch (err) {
      toast(err.message || "Couldn't remove the link", 'danger');
      invalidate(`pagelinks:${ws}:${id}`);
    }
  };
  const pickCategory = async (c) => {
    setCategory(false);
    setQueryData(`pagemeta:${id}`, (m) => ({ ...(m || {}), categoryId: c.id }));
    try {
      await api().setPageCategory(id, c.id);
      invalidate('knowledge');
    } catch (err) {
      toast(err.message || "Couldn't change the category", 'danger');
      invalidate(`pagemeta:${id}`);
    }
  };

  return (
    <>
      <button type="button" onClick={() => setCategory(true)} className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[13px] text-text-2">
        <Icon as={FolderTree} size={14} />
        {catName || 'Add a category'}
      </button>

      {aiOn && page.content?.trim() && (
        <>
          <Heading>Summary</Heading>
          {meta.data?.summary ? (
            <div className="rounded-card border border-line-soft bg-surface p-4">
              <Markdown text={meta.data.summary} className="text-sm" />
            </div>
          ) : null}
          <Button variant="secondary" size="sm" icon={Sparkles} className="mt-3" loading={summarizing} onClick={summarize}>
            {meta.data?.summary ? 'Summarize again' : 'Summarize with AI'}
          </Button>
        </>
      )}

      <Heading
        action={
          <button type="button" className="text-[13px] font-medium text-accent-ink" onClick={() => setLinking(true)}>
            <Icon as={Link2} size={14} className="mr-1 inline" />
            Link a page
          </button>
        }
      >
        Links
      </Heading>
      <PageList pages={out.data || []} onRemove={unlink} empty="This page doesn't link to others yet." />

      <Heading>
        <Icon as={ArrowLeftRight} size={12} className="mr-1 inline" />
        Linked from
      </Heading>
      <PageList pages={back.data || []} empty="No pages link here yet." />

      {linking && <LinkPicker open onClose={() => setLinking(false)} pageId={id} exclude={linked} onPick={link} />}
      {category && <CategoryPicker open onClose={() => setCategory(false)} value={meta.data?.categoryId} onPick={pickCategory} />}
    </>
  );
}
