// Roadmap: what the workspace plans, by quarter. Phones and split windows show a list grouped by
// quarter; wide windows show a horizontal timeline (with the list a tap away). An item's page
// has its progress (tasks and milestones), dates, owner and linked work; managers, the owner and
// the creator can edit it (docs/api/roadmap.md).
import { useEffect, useMemo, useState } from 'react';
import { Check, Flag, GanttChart, List as ListIcon, Map as MapIcon, MoreHorizontal, Pencil, Plus, SquareCheckBig, Trash2, User } from 'lucide-react';
import { nav, useIsOpen } from '../../app/nav.js';
import { useSplit, useWide } from '../../app/layout.js';
import { TabHeader } from '../../app/TabHeader.jsx';
import { api, useSession } from '../../data/session.js';
import { useDirectory, useMembers, useTasks } from '../../data/hooks.js';
import { invalidate, setQueryData, useQuery } from '../../data/query.js';
import { on, toast } from '../../lib/bus.js';
import { Body, Header, Screen } from '../../ui/Screen.jsx';
import { Button, IconButton } from '../../ui/Button.jsx';
import { Chips, Field, SearchField, Segmented } from '../../ui/Controls.jsx';
import { ActionSheet, Dialog, Sheet } from '../../ui/Overlay.jsx';
import { EmptyState, SkeletonRows } from '../../ui/Feedback.jsx';
import { Row, RowGroup, Section } from '../../ui/List.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { cx } from '../../ui/cx.js';
import { TaskRow } from '../tasks/TaskRow.jsx';
import {
  COLOR_LABEL, COLOR_VAR, STATUS_META, colorOf, groupByQuarter, itemQuarter, quarterLabel, quarterOptions, roadmapPermissions, timelineLayout,
} from './roadmapUi.js';

const STATUS_OPTIONS = Object.entries(STATUS_META).map(([value, m]) => ({ value, label: m.label }));

function fmtDay(d) {
  if (!d) return '';
  const date = new Date(`${String(d).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
export function datesLabel(item) {
  if (item.start && item.end) return `${fmtDay(item.start)} – ${fmtDay(item.end)}`;
  if (item.start) return `From ${fmtDay(item.start)}`;
  if (item.end) return `Until ${fmtDay(item.end)}`;
  return '';
}

/** Refetch whenever the server says the workspace's roadmap changed. */
function useRoadmapLive() {
  useEffect(
    () =>
      on('socket', ({ event }) => {
        if (event === 'roadmap:updated' || event === 'milestone:updated') invalidate('roadmap');
      }),
    [],
  );
}

function useRoadmap() {
  const ws = useSession((s) => s.workspaceId);
  return useQuery(ws && `roadmap:${ws}`, () => api().roadmap(ws), { staleMs: 30_000 });
}

function StatusChip({ status }) {
  const m = STATUS_META[status] || STATUS_META.planned;
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-[12px] font-medium', m.tone)}>
      <span className={cx('h-1.5 w-1.5 rounded-full', m.dot)} aria-hidden />
      {m.label}
    </span>
  );
}

function ProgressBar({ percent, color, className }) {
  return (
    <div className={cx('h-1.5 overflow-hidden rounded-full bg-surface-3', className)} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-[width]" style={{ width: `${percent}%`, background: color }} />
    </div>
  );
}

function ItemRow({ item, directory }) {
  const selected = useIsOpen('roadmapItem', item.id);
  const owner = item.owner?.id ? directory[item.owner.id] || item.owner : null;
  return (
    <button
      type="button"
      onClick={() => nav.push('roadmapItem', { id: item.id })}
      className={cx('flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-surface-2', selected && 'bg-accent/8')}
    >
      <span className="h-10 w-1 shrink-0 rounded-full" style={{ background: colorOf(item.color) }} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{item.title}</span>
        <span className="mt-0.5 flex items-center gap-2 text-[12px] text-text-2">
          <StatusChip status={item.status} />
          {datesLabel(item) && <span className="truncate">{datesLabel(item)}</span>}
        </span>
        <ProgressBar percent={item.progress.percent} color={colorOf(item.color)} className="mt-2" />
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-[13px] font-semibold tabular-nums">{item.progress.percent}%</span>
        {owner && <Avatar name={owner.name || 'Owner'} src={owner.avatarUrl} size="xs" />}
      </span>
    </button>
  );
}

function QuarterList({ items, directory }) {
  const groups = useMemo(() => groupByQuarter(items), [items]);
  return groups.map((g) => (
    <Section key={g.quarter || 'none'} title={`${g.label} · ${g.items.length}`}>
      <RowGroup>
        {g.items.map((it) => (
          <ItemRow key={it.id} item={it} directory={directory} />
        ))}
      </RowGroup>
    </Section>
  ));
}

function Timeline({ items }) {
  const { quarters, rows, unscheduled, today } = useMemo(() => timelineLayout(items), [items]);
  const width = Math.max(quarters.length * 260, 640);
  return (
    <>
      <div className="mx-4 mt-2 overflow-hidden rounded-card border border-line-soft bg-surface">
        <div className="flex">
          <div className="w-60 shrink-0 border-r border-line-soft">
            <div className="h-10 border-b border-line-soft" />
            {rows.map((r) => (
              <button key={r.item.id} type="button" onClick={() => nav.push('roadmapItem', { id: r.item.id })} className="flex h-12 w-full items-center gap-2 border-b border-line-soft px-3 text-left last:border-0 active:bg-surface-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorOf(r.item.color) }} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-[13px]">{r.item.title}</span>
                <span className="text-[11px] tabular-nums text-text-3">{r.item.progress.percent}%</span>
              </button>
            ))}
          </div>
          <div className="min-w-0 flex-1 overflow-x-auto">
            <div className="relative" style={{ width }}>
              <div className="flex h-10 border-b border-line-soft">
                {quarters.map((q) => (
                  <span key={q.key} className="shrink-0 border-r border-line-soft/60 px-2 pt-3 text-[12px] font-medium text-text-2" style={{ width: `${q.width}%` }}>
                    {q.label}
                  </span>
                ))}
              </div>
              {today != null && <span className="absolute top-10 bottom-0 w-px bg-accent/70" style={{ left: `${today}%` }} aria-hidden />}
              {rows.map((r) => (
                <div key={r.item.id} className="relative h-12 border-b border-line-soft last:border-0">
                  <button
                    type="button"
                    aria-label={`${r.item.title}, ${STATUS_META[r.item.status]?.label}, ${r.item.progress.percent}% done`}
                    onClick={() => nav.push('roadmapItem', { id: r.item.id })}
                    className="absolute top-2.5 h-7 overflow-hidden rounded-lg border text-left"
                    style={{ left: `${r.left}%`, width: `${r.width}%`, borderColor: colorOf(r.item.color), background: 'var(--color-surface-2)' }}
                  >
                    <span className="absolute inset-y-0 left-0 opacity-35" style={{ width: `${r.item.progress.percent}%`, background: colorOf(r.item.color) }} aria-hidden />
                    <span className="relative block truncate px-2 text-[12px] leading-7 font-medium">{r.item.title}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {unscheduled.length > 0 && (
        <Section title={`No dates · ${unscheduled.length}`}>
          <RowGroup>
            {unscheduled.map((it) => (
              <ItemRow key={it.id} item={it} directory={{}} />
            ))}
          </RowGroup>
        </Section>
      )}
    </>
  );
}

/**
 * The roadmap. As its own screen (pushed in the Notes tab) wide windows get the timeline; as the
 * Notes tab's "Roadmap" section (`section` = the Notes · Roadmap control) it is the list by
 * quarter, with the timeline a tap away on split and wide windows.
 */
export function RoadmapScreen({ section }) {
  useRoadmapLive();
  const wide = useWide();
  const split = useSplit();
  const directory = useDirectory();
  const { data, loading, error, refetch } = useRoadmap();
  const [status, setStatus] = useState('all');
  const [view, setView] = useState(null);
  const [creating, setCreating] = useState(false);
  const embedded = Boolean(section);
  const shown = embedded ? 'list' : view || (wide ? 'timeline' : 'list');
  const items = useMemo(() => (data?.items || []).filter((i) => status === 'all' || i.status === status), [data, status]);
  const add = data?.canCreate ? <IconButton icon={Plus} label="New roadmap item" onClick={() => setCreating(true)} /> : null;
  const filters = <Chips className="min-w-0 flex-1" options={[{ value: 'all', label: 'All' }, ...STATUS_OPTIONS]} value={status} onChange={setStatus} />;

  return (
    <Screen>
      {embedded ? (
        <TabHeader
          title="Notes"
          actions={
            <>
              {split && <IconButton icon={GanttChart} label="Open the timeline" onClick={() => nav.push('roadmap')} />}
              {add}
            </>
          }
        >
          <div className="space-y-2.5 pb-3">
            {section}
            {filters}
          </div>
        </TabHeader>
      ) : (
        <Header title="Roadmap" subtitle="What's planned, by quarter" actions={add}>
          <div className="flex items-center gap-2 pb-2">
            {filters}
            {wide && (
              <div className="mr-4 flex shrink-0 gap-1">
                <IconButton icon={GanttChart} label="Timeline" active={shown === 'timeline'} onClick={() => setView('timeline')} />
                <IconButton icon={ListIcon} label="List by quarter" active={shown === 'list'} onClick={() => setView('list')} />
              </div>
            )}
          </div>
        </Header>
      )}
      <Body tab={embedded ? 'notes' : undefined} fluid={shown === 'timeline'} onRefresh={() => invalidate('roadmap')}>
        {loading && !data ? (
          <SkeletonRows count={5} avatar={false} />
        ) : error && !data ? (
          <EmptyState icon={MapIcon} title="Couldn't load the roadmap" body={error.message} action={<Button variant="secondary" onClick={refetch}>Try again</Button>} />
        ) : !items.length ? (
          <EmptyState
            icon={MapIcon}
            title={status === 'all' ? 'No roadmap yet' : `Nothing ${STATUS_META[status].label.toLowerCase()}`}
            body={data?.canCreate ? 'Add the big pieces of work your team is planning, then link tasks and milestones to track progress.' : "Workspace admins plan the roadmap. It'll show up here."}
            action={data?.canCreate && status === 'all' ? <Button icon={Plus} onClick={() => setCreating(true)}>New item</Button> : null}
          />
        ) : shown === 'timeline' ? (
          <Timeline items={items} />
        ) : (
          <QuarterList items={items} directory={directory} />
        )}
      </Body>
      <RoadmapEditorSheet open={creating} onClose={() => setCreating(false)} manager={Boolean(data?.canCreate)} />
    </Screen>
  );
}

// ---------------------------------------------------------------- editor

function Picker({ open, onClose, title, options, value, onChange, multi = true, searchable = false, empty }) {
  const [q, setQ] = useState('');
  const list = options.filter((o) => !q || o.label.toLowerCase().includes(q.toLowerCase()));
  const toggle = (id) => (multi ? onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]) : (onChange(id), onClose()));
  return (
    <Sheet open={open} onClose={onClose} title={title} full={searchable} footer={multi ? <Button block onClick={onClose}>Done</Button> : null}>
      {searchable && <SearchField value={q} onChange={setQ} className="mx-4 mb-2" placeholder="Search" />}
      <div className="px-2 pb-2">
        {!list.length && <p className="px-3 py-6 text-center text-sm text-text-2">{empty}</p>}
        {list.map((o) => {
          const on = multi ? value.includes(o.id) : value === o.id;
          return (
            <button key={o.id} type="button" onClick={() => toggle(o.id)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left active:bg-surface-2">
              {o.leading}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px]">{o.label}</span>
                {o.detail && <span className="block truncate text-[12px] text-text-2">{o.detail}</span>}
              </span>
              <span className={cx('grid h-6 w-6 place-items-center rounded-full border', on ? 'border-accent bg-accent text-on-accent' : 'border-line')}>
                {on && <Icon as={Check} size={14} />}
              </span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

function PickButton({ icon, label, value, onClick }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl border border-line bg-input px-3.5 py-3 text-left">
      <Icon as={icon} size="sm" className="text-text-3" />
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] text-text-2">{label}</span>
        <span className="block truncate text-[15px]">{value}</span>
      </span>
    </button>
  );
}

export function RoadmapEditorSheet({ open, onClose, item = null, manager = false }) {
  const ws = useSession((s) => s.workspaceId);
  const me = useSession((s) => s.user?.id);
  const { data: members } = useMembers();
  const { data: tasks } = useTasks();
  const { data: milestones } = useQuery(open && ws && `milestones:${ws}`, () => api().milestones(ws));
  const blank = { title: '', description: '', status: 'planned', start: '', end: '', quarter: '', color: 'accent', ownerId: me, milestoneIds: [], taskIds: [] };
  const [form, setForm] = useState(blank);
  const [picking, setPicking] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setForm(item ? { ...blank, ...item, start: item.start || '', end: item.end || '', quarter: item.quarter || '' } : blank);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const perms = item ? roadmapPermissions(item, { manager, me }) : { changeOwner: manager };
  const quarters = useMemo(() => {
    const opts = quarterOptions();
    if (form.quarter && !opts.includes(form.quarter)) opts.unshift(form.quarter);
    return [{ value: '', label: 'None' }, ...opts.map((q) => ({ value: q, label: quarterLabel(q) }))];
  }, [form.quarter]);
  const memberName = (id) => (members || []).find((u) => u.id === id)?.name || (id === me ? 'You' : 'Someone');
  const badDates = form.start && form.end && form.start > form.end;

  const save = async () => {
    if (!form.title.trim() || badDates) return;
    setBusy(true);
    const fields = {
      title: form.title,
      description: form.description,
      status: form.status,
      start: form.start,
      end: form.end,
      quarter: form.quarter || null,
      color: form.color,
      milestoneIds: form.milestoneIds,
      taskIds: form.taskIds,
      ...(perms.changeOwner ? { ownerId: form.ownerId || null } : {}),
    };
    try {
      if (item) {
        const next = await api().updateRoadmapItem(item.id, fields);
        setQueryData(`roadmapItem:${item.id}`, next);
        toast('Saved', 'success');
      } else {
        const next = await api().createRoadmapItem(ws, fields);
        toast('Added to the roadmap', 'success');
        nav.push('roadmapItem', { id: next.id });
      }
      invalidate('roadmap');
      onClose();
    } catch (err) {
      toast(err.message || "Couldn't save the item", 'danger');
    } finally {
      setBusy(false);
    }
  };

  const taskOptions = (tasks || []).map((t) => ({ id: t.id, label: t.title, detail: t.status?.replace('_', ' ') }));
  const milestoneOptions = (milestones || []).map((m) => ({ id: m.id, label: m.name, detail: m.due ? `Due ${fmtDay(m.due)}` : null }));
  const memberOptions = (members || []).map((u) => ({ id: u.id, label: u.name, leading: <Avatar name={u.name} src={u.avatarUrl} size="sm" /> }));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={item ? 'Edit roadmap item' : 'New roadmap item'}
      full
      footer={<Button block loading={busy} disabled={!form.title.trim() || badDates} onClick={save}>{item ? 'Save' : 'Add to roadmap'}</Button>}
    >
      <div className="space-y-4 px-5 pb-4">
        <Field label="Title" value={form.title} maxLength={200} onChange={(e) => set({ title: e.target.value })} placeholder="Self-serve onboarding" autoFocus={!item} />
        <Field label="Description" multiline value={form.description} maxLength={10000} onChange={(e) => set({ description: e.target.value })} placeholder="What it is and why it matters" />
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-text-2">Status</p>
          <Segmented size="sm" options={STATUS_OPTIONS} value={form.status} onChange={(status) => set({ status })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start" type="date" value={form.start} onChange={(e) => set({ start: e.target.value })} />
          <Field label="End" type="date" value={form.end} onChange={(e) => set({ end: e.target.value })} error={badDates ? 'Ends before it starts' : null} />
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-text-2">Quarter</p>
          <Chips className="-mx-4" options={quarters} value={form.quarter} onChange={(quarter) => set({ quarter })} />
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-text-2">Colour</p>
          <div className="flex flex-wrap gap-2.5">
            {Object.keys(COLOR_VAR).map((c) => (
              <button
                key={c}
                type="button"
                aria-label={COLOR_LABEL[c]}
                aria-pressed={form.color === c}
                onClick={() => set({ color: c })}
                className={cx('h-9 w-9 rounded-full border-2 transition-transform', form.color === c ? 'scale-110 border-text' : 'border-transparent')}
                style={{ background: COLOR_VAR[c] }}
              />
            ))}
          </div>
        </div>
        {perms.changeOwner && <PickButton icon={User} label="Owner" value={form.ownerId ? memberName(form.ownerId) : 'No owner'} onClick={() => setPicking('owner')} />}
        <PickButton icon={Flag} label="Milestones" value={form.milestoneIds.length ? `${form.milestoneIds.length} linked` : 'None linked'} onClick={() => setPicking('milestones')} />
        <PickButton icon={SquareCheckBig} label="Tasks" value={form.taskIds.length ? `${form.taskIds.length} linked` : 'None linked'} onClick={() => setPicking('tasks')} />
      </div>
      <Picker open={picking === 'owner'} onClose={() => setPicking(null)} title="Owner" multi={false} searchable options={memberOptions} value={form.ownerId} onChange={(ownerId) => set({ ownerId })} empty="No one found" />
      <Picker open={picking === 'milestones'} onClose={() => setPicking(null)} title="Milestones" options={milestoneOptions} value={form.milestoneIds} onChange={(milestoneIds) => set({ milestoneIds })} empty="No milestones yet. Add them under Tasks → Planning." />
      <Picker open={picking === 'tasks'} onClose={() => setPicking(null)} title="Tasks" searchable options={taskOptions} value={form.taskIds} onChange={(taskIds) => set({ taskIds })} empty="No tasks found" />
    </Sheet>
  );
}

// ---------------------------------------------------------------- item

export function RoadmapItemScreen({ id }) {
  useRoadmapLive();
  const me = useSession((s) => s.user?.id);
  const directory = useDirectory();
  const { data: tasks } = useTasks();
  const { data: list } = useRoadmap();
  const { data: item, loading, error, refetch } = useQuery(`roadmapItem:${id}`, () => api().roadmapItem(id), { staleMs: 10_000 });
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  // A change from someone else: the list was invalidated; refresh this item too.
  useEffect(() => on('socket', ({ event, payload }) => {
    if (event === 'roadmap:updated' && (!payload?.itemId || String(payload.itemId) === String(id))) invalidate(`roadmapItem:${id}`);
  }), [id]);

  if (!item) {
    return (
      <Screen>
        <Header title="Roadmap item" />
        <Body>
          {loading ? <SkeletonRows count={4} avatar={false} /> : <EmptyState icon={MapIcon} title="Couldn't open this item" body={error?.message || 'It may have been removed.'} action={<Button variant="secondary" onClick={refetch}>Try again</Button>} />}
        </Body>
      </Screen>
    );
  }

  const manager = Boolean(list?.canCreate);
  const perms = roadmapPermissions(item, { manager, me });
  const owner = item.owner?.id ? directory[item.owner.id] || item.owner : null;
  const linked = (tasks || []).filter((t) => item.taskIds.includes(t.id));
  const p = item.progress;
  const color = colorOf(item.color);

  const setStatus = async (status) => {
    setQueryData(`roadmapItem:${id}`, (cur) => (cur ? { ...cur, status } : cur));
    try {
      setQueryData(`roadmapItem:${id}`, await api().updateRoadmapItem(id, { status }));
      invalidate('roadmap');
    } catch (err) {
      toast(err.message || "Couldn't change the status", 'danger');
      invalidate(`roadmapItem:${id}`);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await api().deleteRoadmapItem(id);
      invalidate('roadmap');
      toast('Removed from the roadmap', 'success');
      setConfirm(false);
      nav.pop();
    } catch (err) {
      toast(err.message || "Couldn't delete the item", 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header
        title={item.title}
        subtitle={quarterLabel(itemQuarter(item))}
        actions={
          <>
            {perms.edit && <IconButton icon={Pencil} label="Edit" onClick={() => setEditing(true)} />}
            {perms.remove && <IconButton icon={MoreHorizontal} label="More" onClick={() => setMenu(true)} />}
          </>
        }
      />
      <Body onRefresh={() => invalidate(`roadmapItem:${id}`, 'roadmap')}>
        <div className="mx-4 mt-3 rounded-card border border-line-soft bg-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <StatusChip status={item.status} />
            <span className="text-[13px] text-text-2">{datesLabel(item) || 'No dates yet'}</span>
          </div>
          <div className="mt-3 flex items-end gap-3">
            <span className="text-[32px] leading-none font-bold tabular-nums">{p.percent}%</span>
            <span className="pb-1 text-[13px] text-text-2">
              {p.tasks?.total ? `${p.tasks.done} of ${p.tasks.total} tasks done` : p.milestones?.total ? `${p.milestones.completed} of ${p.milestones.total} milestones complete` : 'No linked work yet'}
            </span>
          </div>
          <ProgressBar percent={p.percent} color={color} className="mt-3 h-2" />
          {p.tasks?.remainingHours > 0 && <p className="mt-2 text-[12px] text-text-2">About {Math.round(p.tasks.remainingHours)} h of estimated work left</p>}
        </div>

        {perms.edit && (
          <Section title="Status">
            <div className="px-4">
              <Segmented size="sm" options={STATUS_OPTIONS} value={item.status} onChange={setStatus} />
            </div>
          </Section>
        )}

        <Section title="Details">
          <RowGroup>
            <Row icon={User} title="Owner" value={owner?.name || 'No owner'} />
            <Row icon={MapIcon} title="Quarter" value={quarterLabel(itemQuarter(item))} />
          </RowGroup>
        </Section>

        {item.description && (
          <Section title="About">
            <p className="mx-4 whitespace-pre-wrap rounded-card border border-line-soft bg-surface p-4 text-[15px] leading-relaxed">{item.description}</p>
          </Section>
        )}

        <Section title="Milestones">
          {p.milestones?.items?.length ? (
            <RowGroup>
              {p.milestones.items.map((m) => (
                <div key={m.id} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Icon as={Flag} size="sm" className={m.status === 'completed' ? 'text-success' : 'text-text-3'} />
                    <span className="min-w-0 flex-1 truncate text-[15px]">{m.name}</span>
                    <span className="text-[13px] tabular-nums text-text-2">{m.percent}%</span>
                  </div>
                  <ProgressBar percent={m.percent} color={color} className="mt-2" />
                  {m.due && <p className="mt-1 text-[12px] text-text-3">Due {fmtDay(m.due)}</p>}
                </div>
              ))}
            </RowGroup>
          ) : (
            <p className="mx-5 text-[13px] text-text-2">No milestones linked.{perms.edit ? ' Edit the item to link some.' : ''}</p>
          )}
        </Section>

        <Section title={`Tasks${item.taskIds.length ? ` · ${item.taskIds.length}` : ''}`}>
          {linked.length ? (
            <RowGroup>
              {linked.map((t) => (
                <TaskRow key={t.id} task={t} directory={directory} compact />
              ))}
            </RowGroup>
          ) : (
            <p className="mx-5 text-[13px] text-text-2">
              {item.taskIds.length ? "Linked tasks aren't visible to you." : `No tasks linked directly.${perms.edit ? ' Edit the item to link some.' : ''}`}
            </p>
          )}
        </Section>
      </Body>

      <RoadmapEditorSheet open={editing} onClose={() => setEditing(false)} item={item} manager={manager} />
      <ActionSheet open={menu} onClose={() => setMenu(false)} actions={[{ label: 'Delete item', icon: Trash2, danger: true, onSelect: () => setConfirm(true) }]} />
      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Delete this item?" body="It's removed from the roadmap. Linked tasks and milestones stay." confirmLabel="Delete" danger busy={busy} onConfirm={remove} />
    </Screen>
  );
}

