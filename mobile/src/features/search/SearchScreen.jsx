// Search across the workspace. Messages are end-to-end encrypted, so they're searched on the
// phone (lib/searchQuery.js matchMessage over the messages decrypted here); pages and files
// come from the server's /api/search with the date filters it supports; channels, people,
// tasks and notes are filtered from the lists already loaded.
// Query syntax: from:@name in:#channel before:/after:/on:YYYY-MM-DD has:file|link|image
// is:pinned|thread type:task|note|file|page|message "exact phrase".
import { useEffect, useMemo, useState } from 'react';
import { AtSign, BookOpen, CalendarDays, File, FileText, Hash, Paperclip, Search, SlidersHorizontal, X } from 'lucide-react';
import { nav } from '../../app/nav.js';
import { api, useSession } from '../../data/session.js';
import { useChannels, useDirectory, useMembers, useNotes, useTasks } from '../../data/hooks.js';
import { useQuery } from '../../data/query.js';
import { useE2ee } from '../../data/e2ee.js';
import { Body, Header, Screen } from '../../ui/Screen.jsx';
import { Chips, Field, SearchField } from '../../ui/Controls.jsx';
import { EmptyState, SkeletonRows } from '../../ui/Feedback.jsx';
import { Row, RowGroup, Section } from '../../ui/List.jsx';
import { Sheet } from '../../ui/Overlay.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Button } from '../../ui/Button.jsx';
import { plainPreview } from '../../ui/Markdown.jsx';
import { cx } from '../../ui/cx.js';
import { shortAgo } from '../../lib/time.js';
import { htmlToText } from '../../ui/sanitize.js';
import { fileIconKind, formatBytes } from '../../lib/files.js';
import {
  dateRange, filterValue, freeText, isEmptyQuery, matchMessage, parseSearchQuery, serverParams, setFilter, wantsKind,
} from '../../lib/searchQuery.js';
import { openFile } from '../media/media.js';
import { FILE_ICONS } from '../media/Attachments.jsx';
import { TaskRow } from '../tasks/TaskRow.jsx';
import { openConversation } from '../chats/chatsUi.js';

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'messages', label: 'Messages' },
  { value: 'channels', label: 'Channels' },
  { value: 'people', label: 'People' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'notes', label: 'Notes' },
  { value: 'pages', label: 'Pages' },
  { value: 'files', label: 'Files' },
];

// Result kind → the type: filter that asks for it.
const TYPE_OF = { messages: 'message', tasks: 'task', notes: 'note', pages: 'page', files: 'file' };

const TIPS = [
  ['from:@ana', 'messages from a person'],
  ['in:#general', 'messages in a channel'],
  ['after:2026-01-01', 'also before: and on:'],
  ['has:link', 'or has:file, has:image'],
  ['is:pinned', 'or is:thread'],
  ['type:page', 'task, note, file, page or message'],
  ['"exact words"', 'a phrase'],
];

const dayInput = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dayInput(d);
};

function inRange(at, range) {
  if (!range.from && !range.to) return true;
  const t = new Date(at).getTime();
  if (!Number.isFinite(t)) return false;
  return (!range.from || t >= new Date(range.from).getTime()) && (!range.to || t <= new Date(range.to).getTime());
}

/** One filter chip: shows its value when set, × clears it. */
function FilterChip({ icon, label, value, onOpen, onClear }) {
  return (
    <span
      className={cx(
        'inline-flex h-8 shrink-0 items-center rounded-full border text-[13px] font-medium',
        value ? 'border-accent bg-accent/15 text-accent-ink' : 'border-line bg-surface text-text-2',
      )}
    >
      <button type="button" onClick={onOpen} className="flex h-full items-center gap-1.5 pr-1 pl-3">
        <Icon as={icon} size={13} />
        {value || label}
      </button>
      {value ? (
        <button type="button" aria-label={`Clear ${label}`} onClick={onClear} className="grid h-full w-7 place-items-center">
          <Icon as={X} size={13} />
        </button>
      ) : (
        <span className="w-2" />
      )}
    </span>
  );
}

function PickerSheet({ open, onClose, title, options, onPick, searchable }) {
  const [q, setQ] = useState('');
  useEffect(() => {
    if (open) setQ('');
  }, [open]);
  const list = searchable && q ? options.filter((o) => `${o.label} ${o.hint || ''}`.toLowerCase().includes(q.toLowerCase())) : options;
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {searchable && (
        <div className="px-4 pb-2">
          <SearchField value={q} onChange={setQ} placeholder="Filter" />
        </div>
      )}
      <div className="px-2 pb-3">
        {list.slice(0, 60).map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => {
              onPick(o.value);
              onClose();
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left active:bg-surface-2"
          >
            {o.leading || (o.icon && <Icon as={o.icon} className="text-text-2" />)}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px]">{o.label}</span>
              {o.hint && <span className="block truncate text-[13px] text-text-2">{o.hint}</span>}
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function DateSheet({ open, onClose, query, setQuery }) {
  const [after, setAfter] = useState('');
  const [before, setBefore] = useState('');
  useEffect(() => {
    if (!open) return;
    setAfter(filterValue(query, 'after'));
    setBefore(filterValue(query, 'before'));
  }, [open, query]);
  const apply = (patch) => {
    let next = query;
    for (const k of ['on', 'after', 'before']) next = setFilter(next, k, patch[k] || '');
    setQuery(next);
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Date">
      <div className="px-2">
        {[
          { label: 'Today', patch: { on: dayInput(new Date()) } },
          { label: 'Past 7 days', patch: { after: daysAgo(8) } },
          { label: 'Past 30 days', patch: { after: daysAgo(31) } },
          { label: 'Any time', patch: {} },
        ].map((o) => (
          <button key={o.label} type="button" onClick={() => apply(o.patch)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left active:bg-surface-2">
            <Icon as={CalendarDays} className="text-text-2" />
            <span className="text-[15px]">{o.label}</span>
          </button>
        ))}
      </div>
      <div className="space-y-3 px-5 pt-2 pb-4">
        <div className="flex gap-2.5">
          <Field className="flex-1" label="After" type="date" value={after} onChange={(e) => setAfter(e.target.value)} />
          <Field className="flex-1" label="Before" type="date" value={before} onChange={(e) => setBefore(e.target.value)} />
        </div>
        <Button block variant="secondary" disabled={!after && !before} onClick={() => apply({ after, before })}>
          Use these dates
        </Button>
      </div>
    </Sheet>
  );
}

export function SearchScreen({ q: initialQuery = '' }) {
  const ws = useSession((s) => s.workspaceId);
  const e2ee = useE2ee((s) => s.status);
  const [query, setQuery] = useState(initialQuery);
  const [debounced, setDebounced] = useState(initialQuery.trim());
  const [tab, setTab] = useState('all');
  const [picker, setPicker] = useState(null); // 'type' | 'from' | 'in' | 'date' | 'has'
  const { data: channels } = useChannels();
  const { data: members } = useMembers();
  const { data: tasks } = useTasks();
  const { data: notes } = useNotes();
  const directory = useDirectory();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const parsed = useMemo(() => parseSearchQuery(debounced), [debounced]);
  const text = freeText(parsed);
  const t = text.toLowerCase();
  const empty = isEmptyQuery(parsed);
  const range = useMemo(() => dateRange(parsed), [parsed]);
  // from:, in:, has: and is: only make sense for messages.
  const messageOnly = parsed.from.length || parsed.in.length || parsed.has.length || parsed.is.length;
  const show = (kind) => (tab === 'all' || tab === kind) && (!TYPE_OF[kind] ? !parsed.type : wantsKind(parsed, TYPE_OF[kind])) && (kind === 'messages' || !messageOnly);

  // Messages: decrypted on this phone, matched here.
  const wantMessages = !empty && show('messages') && e2ee === 'ready';
  const messages = useQuery(wantMessages && `search:${ws}:${debounced.toLowerCase()}`, () => {
    const ctx = { usernameOf: (id) => directory[id]?.username, nameOf: (id) => directory[id]?.name };
    return api().searchMessages?.(ws, (m, conv) => matchMessage(m, conv, parsed, ctx)) ?? [];
  });
  // Pages and files: the server, with the date range.
  const wantPages = Boolean(t) && show('pages') && api().searchServer;
  const wantFiles = Boolean(t) && show('files') && api().searchServer;
  const pages = useQuery(wantPages && `search-pages:${ws}:${debounced.toLowerCase()}`, () => api().searchServer(ws, serverParams(parsed, 'knowledge')).then((r) => r.knowledge));
  const files = useQuery(wantFiles && `search-files:${ws}:${debounced.toLowerCase()}`, () => api().searchServer(ws, serverParams(parsed, 'file')).then((r) => r.files));

  const results = useMemo(() => {
    if (empty) return null;
    const textMatch = (s) => !t || String(s || '').toLowerCase().includes(t);
    return {
      messages: wantMessages ? messages.data || [] : [],
      channels: show('channels') && t ? (channels || []).filter((c) => c.name.includes(t) || c.topic?.toLowerCase().includes(t)) : [],
      people: show('people') && t ? (members || []).filter((u) => u.name.toLowerCase().includes(t) || u.email?.toLowerCase().includes(t) || u.username?.toLowerCase().includes(t)) : [],
      tasks: show('tasks') ? (tasks || []).filter((x) => textMatch(x.title) && inRange(x.updatedAt, range)) : [],
      notes: show('notes') ? (notes || []).filter((n) => !n.archived && (textMatch(n.title) || textMatch(htmlToText(n.content, 3000))) && inRange(n.updatedAt, range)) : [],
      pages: wantPages ? pages.data || [] : [],
      files: wantFiles ? files.data || [] : [],
    };
  }, [empty, t, range, wantMessages, wantPages, wantFiles, messages.data, pages.data, files.data, channels, members, tasks, notes, tab, parsed]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadingAny = messages.loading || pages.loading || files.loading;
  const limit = tab === 'all' ? 3 : 50;
  const total = results ? Object.values(results).reduce((a, l) => a + l.length, 0) : 0;
  const moreIn = (kind, list) =>
    tab === 'all' && list.length > limit ? (
      <button type="button" onClick={() => setTab(kind)} className="text-xs font-medium text-accent-ink">
        See all {list.length}
      </button>
    ) : null;

  const typeValue = filterValue(query, 'type');
  const fromValue = filterValue(query, 'from');
  const inValue = filterValue(query, 'in');
  const hasValue = filterValue(query, 'has');
  const dateValue = ['on', 'after', 'before'].map((k) => filterValue(query, k) && `${k} ${filterValue(query, k)}`).filter(Boolean).join(', ');
  const clear = (...keys) => setQuery(keys.reduce((q, k) => setFilter(q, k, ''), query));

  return (
    <Screen>
      <Header title="Search">
        <div className="space-y-2.5 pb-3">
          <div className="px-4">
            <SearchField value={query} onChange={setQuery} placeholder="Search, or try from:@name in:#channel" autoFocus />
          </div>
          <Chips options={TABS} value={tab} onChange={setTab} />
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4" aria-label="Filters">
            <FilterChip icon={SlidersHorizontal} label="Type" value={typeValue} onOpen={() => setPicker('type')} onClear={() => clear('type')} />
            <FilterChip icon={AtSign} label="Person" value={fromValue} onOpen={() => setPicker('from')} onClear={() => clear('from')} />
            <FilterChip icon={Hash} label="Channel" value={inValue} onOpen={() => setPicker('in')} onClear={() => clear('in')} />
            <FilterChip icon={CalendarDays} label="Date" value={dateValue} onOpen={() => setPicker('date')} onClear={() => clear('on', 'after', 'before')} />
            <FilterChip icon={Paperclip} label="Has" value={hasValue} onOpen={() => setPicker('has')} onClear={() => clear('has')} />
          </div>
        </div>
      </Header>
      <Body>
        {parsed.errors.length > 0 && <p className="mx-4 mt-2 rounded-xl border border-warning/30 bg-warning/10 px-3.5 py-2.5 text-[13px] text-text">{parsed.errors.join(' · ')}</p>}
        {!results ? (
          <>
            <EmptyState icon={Search} title="Search your workspace" body="Messages, channels, people, tasks, notes, pages and files." />
            <Section title="Search tips">
              <RowGroup>
                {TIPS.map(([syntax, hint]) => (
                  <Row key={syntax} title={<code className="font-mono text-[14px] text-accent-ink">{syntax}</code>} subtitle={hint} onClick={() => setQuery(`${query.trim() ? `${query.trim()} ` : ''}${syntax.replace(/"exact words"/, '""')} `)} chevron={false} />
                ))}
              </RowGroup>
            </Section>
          </>
        ) : total === 0 && !loadingAny ? (
          <EmptyState
            icon={Search}
            title="No results"
            body={show('messages') && e2ee !== 'ready' ? 'Unlock your messages to search them on this device.' : `Nothing matches “${debounced}”.`}
          />
        ) : (
          <>
            {show('messages') && (results.messages.length > 0 || messages.loading) && (
              <Section title="Messages" action={moreIn('messages', results.messages)}>
                <RowGroup>
                  {messages.loading && !results.messages.length ? (
                    <SkeletonRows count={2} />
                  ) : (
                    results.messages.slice(0, limit).map((m) => (
                      <Row
                        key={m.id}
                        leading={<Avatar name={directory[m.authorId]?.name} src={directory[m.authorId]?.avatarUrl} size="sm" />}
                        title={plainPreview(m.text, 140) || (m.attachments?.length ? 'Attachment' : 'Message')}
                        subtitle={`${directory[m.authorId]?.name || 'Someone'} in ${m.convName} · ${shortAgo(m.at)}`}
                        multiline
                        onClick={() =>
                          m.parentId
                            ? nav.push('thread', { kind: m.convKind, convId: m.convId, messageId: m.parentId }, { tab: 'chats' })
                            : openConversation(m.convKind, m.convId, { highlight: m.id })
                        }
                      />
                    ))
                  )}
                </RowGroup>
              </Section>
            )}
            {results.channels.length > 0 && (
              <Section title="Channels" action={moreIn('channels', results.channels)}>
                <RowGroup>
                  {results.channels.slice(0, limit).map((c) => (
                    <Row key={c.id} icon={Hash} title={c.name} subtitle={c.topic} onClick={() => openConversation('channel', c.id)} />
                  ))}
                </RowGroup>
              </Section>
            )}
            {results.people.length > 0 && (
              <Section title="People" action={moreIn('people', results.people)}>
                <RowGroup>
                  {results.people.slice(0, limit).map((u) => (
                    <Row
                      key={u.id}
                      leading={<Avatar name={u.name} src={u.avatarUrl} size="sm" presence={u.presence} />}
                      title={u.name}
                      subtitle={u.title || (u.username ? `@${u.username}` : u.email)}
                      onClick={() => nav.push('profile', { userId: u.id })}
                    />
                  ))}
                </RowGroup>
              </Section>
            )}
            {results.tasks.length > 0 && (
              <Section title="Tasks" action={moreIn('tasks', results.tasks)}>
                <div className="mx-4 overflow-hidden rounded-card border border-line-soft bg-surface divide-y divide-line-soft">
                  {results.tasks.slice(0, limit).map((x) => (
                    <TaskRow key={x.id} task={x} directory={directory} compact />
                  ))}
                </div>
              </Section>
            )}
            {results.notes.length > 0 && (
              <Section title="Notes" action={moreIn('notes', results.notes)}>
                <RowGroup>
                  {results.notes.slice(0, limit).map((n) => (
                    <Row key={n.id} icon={FileText} title={n.title} subtitle={htmlToText(n.content, 90)} onClick={() => nav.push('note', { id: n.id })} />
                  ))}
                </RowGroup>
              </Section>
            )}
            {show('pages') && (results.pages.length > 0 || pages.loading) && (
              <Section title="Pages" action={moreIn('pages', results.pages)}>
                <RowGroup>
                  {pages.loading && !results.pages.length ? (
                    <SkeletonRows count={2} avatar={false} />
                  ) : (
                    results.pages.slice(0, limit).map((p) => (
                      <Row
                        key={p.id}
                        leading={<span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-surface-3 text-[17px]">{p.icon || <Icon as={BookOpen} size="sm" />}</span>}
                        title={p.title}
                        subtitle={p.snippet}
                        onClick={() => nav.push('page', { id: p.id })}
                      />
                    ))
                  )}
                </RowGroup>
              </Section>
            )}
            {show('files') && (results.files.length > 0 || files.loading) && (
              <Section title="Files" action={moreIn('files', results.files)}>
                <RowGroup>
                  {files.loading && !results.files.length ? (
                    <SkeletonRows count={2} avatar={false} />
                  ) : (
                    results.files.slice(0, limit).map((f) => (
                      <Row
                        key={f.id}
                        icon={FILE_ICONS[fileIconKind(f)] || File}
                        tile="accent"
                        title={f.name}
                        subtitle={[formatBytes(f.size), f.owner, f.at && shortAgo(f.at)].filter(Boolean).join(' · ')}
                        onClick={() => openFile(f)}
                      />
                    ))
                  )}
                </RowGroup>
              </Section>
            )}
          </>
        )}
      </Body>
      <PickerSheet
        open={picker === 'type'}
        onClose={() => setPicker(null)}
        title="Type"
        onPick={(v) => setQuery(setFilter(query, 'type', v))}
        options={[
          { value: 'message', label: 'Messages', icon: Search },
          { value: 'task', label: 'Tasks', icon: SlidersHorizontal },
          { value: 'note', label: 'Notes', icon: FileText },
          { value: 'page', label: 'Pages', icon: BookOpen },
          { value: 'file', label: 'Files', icon: File },
        ]}
      />
      <PickerSheet
        open={picker === 'from'}
        onClose={() => setPicker(null)}
        title="From a person"
        searchable
        onPick={(v) => setQuery(setFilter(query, 'from', `@${v}`))}
        options={(members || [])
          .filter((u) => u.username)
          .map((u) => ({ value: u.username, label: u.name, hint: `@${u.username}`, leading: <Avatar name={u.name} src={u.avatarUrl} size="sm" /> }))}
      />
      <PickerSheet
        open={picker === 'in'}
        onClose={() => setPicker(null)}
        title="In a channel"
        searchable
        onPick={(v) => setQuery(setFilter(query, 'in', `#${v}`))}
        options={(channels || []).filter((c) => c.isMember).map((c) => ({ value: c.name, label: `#${c.name}`, hint: c.topic, icon: Hash }))}
      />
      <PickerSheet
        open={picker === 'has'}
        onClose={() => setPicker(null)}
        title="Messages that have"
        onPick={(v) => setQuery(setFilter(query, 'has', v))}
        options={[
          { value: 'link', label: 'A link', icon: Hash },
          { value: 'file', label: 'A file', icon: Paperclip },
          { value: 'image', label: 'An image', icon: File },
        ]}
      />
      <DateSheet open={picker === 'date'} onClose={() => setPicker(null)} query={query} setQuery={setQuery} />
    </Screen>
  );
}
