// Help center: the same documentation as the web app's /docs, read inside the app (it ships
// with the app, so it works offline). Search, sections, and one page at a time.
import { useEffect, useMemo, useState } from 'react';
import {
  Bell, BookOpen, Building2, CheckSquare, ChevronRight, Code2, Headphones, Info, Lightbulb, LifeBuoy, MessageSquare,
  MonitorSmartphone, NotebookPen, Plug, Rocket, Settings, ShieldCheck, Sparkles, TriangleAlert,
} from 'lucide-react';
import { nav } from '../../app/nav.js';
import { useSession } from '../../data/session.js';
import { useWebUrl } from '../../data/live/webUrl.js';
import { openExternal } from '../../native/index.js';
import { Body, Header, Screen } from '../../ui/Screen.jsx';
import { Row, RowGroup, Section } from '../../ui/List.jsx';
import { SearchField } from '../../ui/Controls.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { CodeBlock } from '../../ui/CodeBlock.jsx';
import { SkeletonRows } from '../../ui/Feedback.jsx';
import { cx } from '../../ui/cx.js';

const SECTION_ICON = {
  Bell, Building2, CheckSquare, Code2, Headphones, MessageSquare, MonitorSmartphone, NotebookPen, Plug, Rocket, Settings, ShieldCheck, Sparkles,
};

// The docs are plain data in the web client; loaded on first use so they don't slow startup.
let docsPromise = null;
const loadDocs = () => (docsPromise ||= import('../../../../client/src/content/docs/index.js'));

function useDocs() {
  const [docs, setDocs] = useState(null);
  useEffect(() => {
    let alive = true;
    loadDocs().then((m) => alive && setDocs(m)).catch(() => alive && setDocs(false));
    return () => { alive = false; };
  }, []);
  return docs;
}

/** What a docs link opens: another help page, a web page, or an outside site. */
function useOpenLink() {
  const server = useSession((s) => s.server);
  const web = useWebUrl(server);
  return (href) => {
    const docs = href.match(/^\/docs\/([\w-]+)(?:\/([\w-]+))?(?:#([\w-]+))?/);
    if (docs) {
      nav.push('settings.help.page', { section: docs[1], page: docs[2] || null, anchor: docs[3] || null });
      return;
    }
    if (/^(https?:|mailto:)/.test(href)) openExternal(href);
    else if (href.startsWith('/') && web) openExternal(`${web}${href}`);
  };
}

const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\[\[[^\]]+\]\])|(\[[^\]\n]+\]\([^)\s]+\))/g;

/** Docs inline text: **bold**, `code`, [label](href) and [[Mod+K]] key chips. */
function Inline({ text, onLink }) {
  const out = [];
  let last = 0;
  for (const m of String(text).matchAll(INLINE)) {
    if (m.index > last) out.push(String(text).slice(last, m.index));
    const tok = m[0];
    const key = m.index;
    if (m[1]) out.push(<code key={key} className="rounded bg-surface-3 px-1 text-[0.9em]">{tok.slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={key}><Inline text={tok.slice(2, -2)} onLink={onLink} /></strong>);
    else if (m[3]) {
      const keys = tok.slice(2, -2).replace(/Mod/g, '⌘/Ctrl').split('+');
      out.push(<kbd key={key} className="rounded border border-line bg-surface-2 px-1 text-[0.85em]">{keys.join(' + ')}</kbd>);
    } else {
      const label = tok.slice(1, tok.indexOf(']('));
      const href = tok.slice(tok.indexOf('](') + 2, -1);
      out.push(
        <button key={key} type="button" className="font-medium text-accent-ink underline decoration-accent/40 underline-offset-2" onClick={() => onLink(href)}>
          {label}
        </button>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < String(text).length) out.push(String(text).slice(last));
  return out;
}

const CALLOUT = { tip: Lightbulb, note: Info, warning: TriangleAlert };

function Block({ b, onLink, slugify }) {
  if (typeof b === 'string') return <p className="leading-relaxed"><Inline text={b} onLink={onLink} /></p>;
  if (!b || typeof b !== 'object') return null;
  if (b.h) return <h2 id={slugify(b.h)} className="pt-3 text-[18px] font-semibold">{b.h}</h2>;
  if (b.h3) return <h3 id={slugify(b.h3)} className="pt-2 text-[15px] font-semibold">{b.h3}</h3>;
  if (b.list || b.steps) {
    const Tag = b.steps ? 'ol' : 'ul';
    return (
      <Tag className={cx('space-y-1.5 pl-5 leading-relaxed', b.steps ? 'list-decimal' : 'list-disc')}>
        {(b.list || b.steps).map((item, i) => <li key={i}><Inline text={item} onLink={onLink} /></li>)}
      </Tag>
    );
  }
  if (b.callout) {
    return (
      <div className={cx('flex gap-2.5 rounded-card border p-3.5 text-[14px]', b.callout === 'warning' ? 'border-warning/40 bg-warning/8' : 'border-line-soft bg-surface')}>
        <Icon as={CALLOUT[b.callout] || Info} size="sm" className={cx('mt-0.5 shrink-0', b.callout === 'warning' ? 'text-warning' : 'text-accent-ink')} />
        <div className="min-w-0 leading-relaxed">
          {b.title && <p className="font-semibold">{b.title}</p>}
          <p><Inline text={b.text} onLink={onLink} /></p>
        </div>
      </div>
    );
  }
  if (b.table) {
    // A phone can't show wide tables: one card per row, each cell labelled by its column.
    const head = b.table.head || [];
    return (
      <div className="space-y-2">
        {b.table.caption && <p className="text-xs font-medium uppercase tracking-wider text-text-3">{b.table.caption}</p>}
        {(b.table.rows || []).map((row, i) => (
          <div key={i} className="rounded-card border border-line-soft bg-surface p-3 text-[14px]">
            {row.map((cell, j) => (
              <p key={j} className={cx('leading-relaxed', j === 0 ? 'font-semibold' : 'mt-1 text-text-2')}>
                {j > 0 && head[j] ? <span className="text-text-3">{head[j]}: </span> : null}
                <Inline text={cell} onLink={onLink} />
              </p>
            ))}
          </div>
        ))}
      </div>
    );
  }
  if (b.code) return <CodeBlock code={b.code} lang={b.lang} />;
  if (b.codeTabs) return <>{b.codeTabs.map((t) => <div key={t.label}><p className="mb-1 text-xs text-text-3">{t.label}</p><CodeBlock code={t.code} lang={t.lang} /></div>)}</>;
  if (b.shortcuts) {
    return (
      <ul className="space-y-1 text-[14px]">
        {b.shortcuts.map((s) => (
          <li key={s.label} className="flex justify-between gap-3">
            <span>{s.label}</span>
            <kbd className="shrink-0 text-text-2">{s.keys.map((k) => k.join('+')).join(' / ')}</kbd>
          </li>
        ))}
      </ul>
    );
  }
  if (b.cards) {
    return (
      <div className="grid gap-2">
        {b.cards.map((c) => (
          <button key={c.to} type="button" onClick={() => onLink(c.to)} className="pressable rounded-card border border-line-soft bg-surface p-3.5 text-left">
            <span className="block text-[14px] font-semibold">{c.title}</span>
            {c.text && <span className="block text-[13px] text-text-2">{c.text}</span>}
          </button>
        ))}
      </div>
    );
  }
  // Animated figures are web-only; their caption still helps.
  if (b.figure && b.caption) return <p className="text-[13px] italic text-text-3">{b.caption}</p>;
  return null;
}

export function HelpCenterScreen() {
  const docs = useDocs();
  const [query, setQuery] = useState('');
  const results = useMemo(() => (docs && query.trim() ? docs.searchDocs(query, 20) : []), [docs, query]);

  return (
    <Screen>
      <Header title="Help center" />
      <Body>
        <div className="px-4 pt-2">
          <SearchField value={query} onChange={setQuery} placeholder="Search help" />
        </div>
        {docs === null && <SkeletonRows count={6} avatar={false} />}
        {docs === false && <p className="px-4 py-8 text-center text-sm text-text-2">Help couldn't be loaded. Restart the app and try again.</p>}
        {docs && query.trim() && (
          <Section title={results.length ? `${results.length} results` : 'No results'}>
            {results.length ? (
              <RowGroup>
                {results.map((r) => (
                  <Row
                    key={`${r.path}#${r.anchor || ''}`}
                    title={r.heading || r.page.title}
                    subtitle={`${r.section.title}${r.heading ? ` · ${r.page.title}` : ''}`}
                    onClick={() => nav.push('settings.help.page', { section: r.section.id, page: r.page.id, anchor: r.anchor })}
                  />
                ))}
              </RowGroup>
            ) : (
              <p className="px-4 text-sm text-text-2">Try other words, or ask the team from Contact support.</p>
            )}
          </Section>
        )}
        {docs && !query.trim() && (
          <>
            {docs.GROUPS.map((g) => (
              <Section key={g.title} title={g.title}>
                <RowGroup>
                  {g.sections.map(docs.getSection).filter(Boolean).map((s) => (
                    <Row
                      key={s.id}
                      icon={SECTION_ICON[s.icon] || BookOpen}
                      tile="accent"
                      title={s.title}
                      subtitle={s.blurb}
                      onClick={() => nav.push('settings.help.page', { section: s.id })}
                    />
                  ))}
                </RowGroup>
              </Section>
            ))}
            <Section title="Still need help?">
              <RowGroup>
                <Row icon={LifeBuoy} tile="accent" title="Contact support" subtitle="Ask the Oruinwan team" onClick={() => nav.push('settings.support')} />
              </RowGroup>
            </Section>
          </>
        )}
      </Body>
    </Screen>
  );
}

/** One section (its pages) or one page. */
export function HelpPageScreen({ section: sectionId, page: pageId, anchor }) {
  const docs = useDocs();
  const onLink = useOpenLink();
  const section = docs ? docs.getSection(sectionId) : null;
  const page = docs && pageId ? docs.getPage(sectionId, pageId) : null;

  // Jump to a heading once the page is on screen.
  useEffect(() => {
    if (!page || !anchor) return;
    const t = setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ block: 'start' }), 60);
    return () => clearTimeout(t);
  }, [page, anchor]);

  if (docs === null) return <Screen><Header title="Help" /><Body><SkeletonRows count={6} avatar={false} /></Body></Screen>;
  if (!section || (pageId && !page)) {
    return (
      <Screen>
        <Header title="Help" />
        <Body><p className="px-4 py-8 text-center text-sm text-text-2">That help page doesn't exist any more.</p></Body>
      </Screen>
    );
  }

  if (!page) {
    return (
      <Screen>
        <Header title={section.title} />
        <Body>
          <p className="px-4 pt-2 text-sm leading-relaxed text-text-2">{section.blurb}</p>
          <Section>
            <RowGroup>
              {section.pages.map((p) => (
                <Row key={p.id} title={p.title} subtitle={p.summary} onClick={() => nav.push('settings.help.page', { section: section.id, page: p.id })} />
              ))}
            </RowGroup>
          </Section>
        </Body>
      </Screen>
    );
  }

  const { next } = docs.neighbours(section.id, page.id);
  return (
    <Screen>
      <Header title={page.title} subtitle={section.title} />
      <Body>
        <article className="space-y-3 px-4 pt-2 pb-6 text-[15px]">
          {page.summary && <p className="text-[15px] leading-relaxed text-text-2">{page.summary}</p>}
          {page.blocks.map((b, i) => <Block key={i} b={b} onLink={onLink} slugify={docs.slugify} />)}
        </article>
        {next && (
          <button
            type="button"
            onClick={() => nav.replace('settings.help.page', { section: next.section.id, page: next.page.id })}
            className="pressable mx-4 mb-6 flex w-[calc(100%-2rem)] items-center gap-3 rounded-card border border-line-soft bg-surface px-3.5 py-3 text-left"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-text-3">Next</span>
              <span className="block truncate text-[14px] font-medium">{next.page.title}</span>
            </span>
            <Icon as={ChevronRight} size="sm" className="text-text-3" />
          </button>
        )}
      </Body>
    </Screen>
  );
}
