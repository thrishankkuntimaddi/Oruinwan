import { useMemo, useState } from 'react';
import {
  LayoutGrid, List, Plus, SquareCheckBig, ArrowUpDown, Trash2, CalendarDays, Flag, UserRound, FolderKanban, Hash, Clock, Sparkles, Pencil, ListChecks,
} from 'lucide-react';
import { TabHeader } from '../../app/TabHeader.jsx';
import { nav } from '../../app/nav.js';
import { api, useSession } from '../../data/session.js';
import { useChannels, useDirectory, useTasks } from '../../data/hooks.js';
import { invalidate, setQueryData, useQuery } from '../../data/query.js';
import { PRIORITY_META, STATUS_META, TASK_PRIORITIES, TASK_TRANSITIONS } from '../../data/constants.js';
import { prefs } from '../../native/storage.js';
import { Body, Header, Screen } from '../../ui/Screen.jsx';
import { Button, IconButton } from '../../ui/Button.jsx';
import { Chips, Field } from '../../ui/Controls.jsx';
import { ActionSheet, Dialog, Sheet } from '../../ui/Overlay.jsx';
import { EmptyState, SkeletonRows } from '../../ui/Feedback.jsx';
import { Row, RowGroup, Section } from '../../ui/List.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Markdown } from '../../ui/Markdown.jsx';
import { cx } from '../../ui/cx.js';
import { dueLabel, shortAgo } from '../../lib/time.js';
import { toast } from '../../lib/bus.js';
import { useFlag } from '../../config/flags.js';
import { TaskRow, StatusIcon } from './TaskRow.jsx';
import { TaskEditorSheet, PeoplePicker, toDateInput, fromDateInput } from './TaskEditorSheet.jsx';
import { askAiAbout } from '../ai/aiUi.js';

const VIEWS = [
  { value: 'mine', label: 'My tasks' },
  { value: 'incoming', label: 'Incoming' },
  { value: 'given', label: 'Given' },
  { value: 'all', label: 'All' },
  { value: 'done', label: 'Completed' },
];

const OPEN_ORDER = ['in_progress', 'review', 'blocked', 'todo', 'backlog'];
const SORTS = {
  due: { label: 'Due date', fn: (a, b) => (a.due || '9').localeCompare(b.due || '9') },
  priority: { label: 'Priority', fn: (a, b) => TASK_PRIORITIES.indexOf(b.priority) - TASK_PRIORITIES.indexOf(a.priority) },
  newest: { label: 'Recently updated', fn: (a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '') },
  title: { label: 'A–Z', fn: (a, b) => a.title.localeCompare(b.title) },
};

function filterView(tasks, view, me) {
  const open = (t) => !['done', 'cancelled'].includes(t.status);
  switch (view) {
    case 'mine':
      return tasks.filter((t) => open(t) && t.assigneeIds.includes(me));
    case 'incoming':
      return tasks.filter((t) => open(t) && t.assigneeIds.includes(me) && t.createdBy !== me);
    case 'given':
      return tasks.filter((t) => open(t) && t.createdBy === me && t.assigneeIds.some((id) => id !== me));
    case 'done':
      return tasks.filter((t) => !open(t));
    default:
      return tasks.filter(open);
  }
}

function Board({ tasks, directory }) {
  const columns = OPEN_ORDER.map((s) => ({ status: s, items: tasks.filter((t) => t.status === s) }));
  return (
    <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pt-2 pb-4">
      {columns.map((col) => (
        <section key={col.status} className="flex w-[82%] max-w-80 shrink-0 snap-center flex-col rounded-card border border-line-soft bg-surface">
          <header className="flex items-center gap-2 border-b border-line-soft px-3.5 py-3">
            <StatusIcon status={col.status} size={16} />
            <h3 className="flex-1 text-[14px] font-semibold">{STATUS_META[col.status].label}</h3>
            <span className="text-xs text-text-3 tabular-nums">{col.items.length}</span>
          </header>
          <div className="divide-y divide-line-soft">
            {col.items.length ? (
              col.items.map((t) => <TaskRow key={t.id} task={t} directory={directory} compact />)
            ) : (
              <p className="px-4 py-6 text-center text-xs text-text-3">Nothing here</p>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

export function TasksScreen() {
  const me = useSession((s) => s.user?.id);
  const { data, loading } = useTasks();
  const directory = useDirectory();
  const [view, setView] = useState(() => prefs.get('tasks.view', 'mine'));
  const [layout, setLayout] = useState(() => prefs.get('tasks.layout', 'list'));
  const [sort, setSort] = useState(() => prefs.get('tasks.sort', 'due'));
  const [sortSheet, setSortSheet] = useState(false);
  const [create, setCreate] = useState(false);

  const tasks = useMemo(() => filterView(data || [], view, me).sort(SORTS[sort].fn), [data, view, me, sort]);
  const groups = useMemo(() => {
    const order = view === 'done' ? ['done', 'cancelled'] : OPEN_ORDER;
    return order.map((s) => ({ status: s, items: tasks.filter((t) => t.status === s) })).filter((g) => g.items.length);
  }, [tasks, view]);

  const pick = (key, value, setter) => {
    prefs.set(key, value);
    setter(value);
  };

  return (
    <Screen>
      <TabHeader
        title="Tasks"
        actions={
          <>
            <IconButton icon={ArrowUpDown} label={`Sort: ${SORTS[sort].label}`} onClick={() => setSortSheet(true)} />
            <IconButton
              icon={layout === 'list' ? LayoutGrid : List}
              label={layout === 'list' ? 'Show board' : 'Show list'}
              onClick={() => pick('tasks.layout', layout === 'list' ? 'board' : 'list', setLayout)}
            />
          </>
        }
      >
        <Chips options={VIEWS} value={view} onChange={(v) => pick('tasks.view', v, setView)} className="pb-3" />
      </TabHeader>
      <Body tab="tasks" onRefresh={() => invalidate('tasks')}>
        {loading ? (
          <SkeletonRows count={7} avatar={false} />
        ) : !tasks.length ? (
          <EmptyState
            icon={SquareCheckBig}
            title={view === 'done' ? 'Nothing completed yet' : 'No tasks here'}
            body={view === 'given' ? 'Tasks you assign to others show up here.' : 'Create a task to start tracking work.'}
            action={view !== 'done' ? { label: 'New task', icon: Plus, onClick: () => setCreate(true) } : null}
          />
        ) : layout === 'board' && view !== 'done' ? (
          <Board tasks={tasks} directory={directory} />
        ) : (
          groups.map((g) => (
            <section key={g.status} className="mt-3">
              <h2 className="flex items-center gap-2 px-4 pb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-text-2">
                <StatusIcon status={g.status} size={14} />
                {STATUS_META[g.status].label}
                <span className="font-normal text-text-3">{g.items.length}</span>
              </h2>
              <div className="mx-4 overflow-hidden rounded-card border border-line-soft bg-surface divide-y divide-line-soft">
                {g.items.map((t) => (
                  <TaskRow key={t.id} task={t} directory={directory} />
                ))}
              </div>
            </section>
          ))
        )}
      </Body>
      <button
        type="button"
        aria-label="New task"
        onClick={() => setCreate(true)}
        className="pressable absolute right-4 z-10 grid h-14 w-14 place-items-center rounded-2xl bg-gold text-on-accent"
        style={{ bottom: 'calc(var(--sab) + 76px)' }}
      >
        <Icon as={Plus} size="lg" />
      </button>
      <ActionSheet
        open={sortSheet}
        onClose={() => setSortSheet(false)}
        title="Sort by"
        actions={Object.entries(SORTS).map(([k, s]) => ({
          label: `${s.label}${k === sort ? '  ✓' : ''}`,
          onSelect: () => pick('tasks.sort', k, setSort),
        }))}
      />
      <TaskEditorSheet open={create} onClose={() => setCreate(false)} />
    </Screen>
  );
}

function BlockedReasonDialog({ open, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="What's blocking it?"
      body="Blocked tasks need a reason so the team knows what to unblock."
      confirmLabel="Mark blocked"
      onConfirm={() => reason.trim() && onConfirm(reason.trim())}
    >
      <Field className="mt-4" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Waiting on design review" autoFocus />
    </Dialog>
  );
}

function EditTextSheet({ open, onClose, title, value, multiline, onSave }) {
  const [text, setText] = useState(value);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <Button
          block
          onClick={() => {
            onSave(text);
            onClose();
          }}
        >
          Save
        </Button>
      }
    >
      <div className="px-5 pb-4">
        <Field multiline={multiline} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
      </div>
    </Sheet>
  );
}

export function TaskScreen({ id }) {
  const ws = useSession((s) => s.workspaceId);
  const directory = useDirectory();
  const { data: channels } = useChannels();
  const aiOn = useFlag('ai');
  const cached = (useTasks().data || []).find((t) => t.id === id);
  const { data: fetched, loading } = useQuery(`task:${id}`, () => api().task(id));
  const task = fetched || cached;
  const [blockedAsk, setBlockedAsk] = useState(false);
  const [prioritySheet, setPrioritySheet] = useState(false);
  const [people, setPeople] = useState(false);
  const [editTitle, setEditTitle] = useState(false);
  const [editDesc, setEditDesc] = useState(false);
  const [trash, setTrash] = useState(false);

  if (!task) {
    return (
      <Screen>
        <Header title="Task" />
        {loading ? <SkeletonRows count={5} avatar={false} /> : <EmptyState icon={SquareCheckBig} title="Task not found" body="It may have been deleted." />}
      </Screen>
    );
  }

  const update = async (patch, message) => {
    const optimistic = { ...task, ...patch };
    setQueryData(`task:${id}`, optimistic);
    setQueryData(`tasks:${ws}`, (list) => list?.map((t) => (t.id === id ? optimistic : t)));
    try {
      const saved = await api().updateTask(id, patch);
      setQueryData(`task:${id}`, saved);
      invalidate('tasks');
      if (message) toast(message, 'success');
    } catch (err) {
      toast(err.message || 'Could not update the task', 'danger');
      invalidate('tasks', `task:${id}`);
    }
  };

  const move = (status) => {
    if (status === 'blocked') return setBlockedAsk(true);
    update({ status, blockedReason: null }, `Moved to ${STATUS_META[status].label}`);
  };

  const due = dueLabel(task.due);
  const assignees = task.assigneeIds.map((a) => directory[a]).filter(Boolean);
  const channel = (channels || []).find((c) => c.id === task.channelId);
  const reporter = directory[task.createdBy];

  return (
    <Screen>
      <Header title="" actions={<IconButton icon={Trash2} label="Move to trash" onClick={() => setTrash(true)} />} />
      <Body>
        <div className="px-4">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
            style={{ borderColor: `${STATUS_META[task.status].color}55`, color: STATUS_META[task.status].color }}
          >
            <StatusIcon status={task.status} size={13} />
            {STATUS_META[task.status].label}
          </span>
          <button type="button" onClick={() => setEditTitle(true)} className="mt-2 block w-full text-left">
            <h1 className="text-[22px] font-bold leading-snug tracking-tight">{task.title}</h1>
          </button>
          {task.status === 'blocked' && task.blockedReason && (
            <p className="mt-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">Blocked: {task.blockedReason}</p>
          )}
        </div>

        <Section title="Move to">
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4">
            {(TASK_TRANSITIONS[task.status] || []).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => move(s)}
                className="pressable flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-[13px] font-medium"
              >
                <StatusIcon status={s} size={15} />
                {STATUS_META[s].label}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Details">
          <RowGroup>
            <Row
              icon={Flag}
              title="Priority"
              trailing={
                <span className="flex items-center gap-1.5 text-sm">
                  <span className="h-2 w-2 rounded-full" style={{ background: PRIORITY_META[task.priority]?.color }} />
                  {PRIORITY_META[task.priority]?.label}
                </span>
              }
              onClick={() => setPrioritySheet(true)}
            />
            <Row
              icon={UserRound}
              title="Assignees"
              trailing={
                <span className="flex -space-x-2">
                  {assignees.length ? (
                    assignees.slice(0, 4).map((u) => (
                      <span key={u.id} className="rounded-full ring-2 ring-surface">
                        <Avatar name={u.name} src={u.avatarUrl} size="xs" />
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-text-2">Unassigned</span>
                  )}
                </span>
              }
              onClick={() => setPeople(true)}
            />
            <label className="relative flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 active:bg-surface-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-surface-3 text-text-2">
                <Icon as={CalendarDays} size="sm" />
              </span>
              <span className="flex-1 text-[15px]">Due date</span>
              <span className={cx('text-sm', due?.tone === 'overdue' ? 'text-danger' : 'text-text-2')}>{due ? due.text : 'None'}</span>
              <input
                type="date"
                aria-label="Due date"
                value={toDateInput(task.due)}
                onChange={(e) => update({ due: fromDateInput(e.target.value) }, 'Due date updated')}
                className="absolute inset-0 h-full w-full opacity-0"
              />
            </label>
            {task.project && <Row icon={FolderKanban} title="Project" value={task.project} />}
            {channel && <Row icon={Hash} title="Channel" value={`#${channel.name}`} />}
            {reporter && <Row icon={Pencil} title="Reporter" value={reporter.name} />}
            {task.updatedAt && <Row icon={Clock} title="Updated" value={shortAgo(task.updatedAt)} />}
          </RowGroup>
        </Section>

        {task.subtasks && (
          <Section title="Child issues">
            <div className="mx-4 rounded-card border border-line-soft bg-surface p-4">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Icon as={ListChecks} size="sm" className="text-text-2" />
                  {task.subtasks.done} of {task.subtasks.total} done
                </span>
                <span className="text-text-2">{Math.round((task.subtasks.done / task.subtasks.total) * 100)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full bg-accent" style={{ width: `${(task.subtasks.done / task.subtasks.total) * 100}%` }} />
              </div>
            </div>
          </Section>
        )}

        <Section
          title="Description"
          action={
            <button type="button" className="text-[13px] font-medium text-accent-ink" onClick={() => setEditDesc(true)}>
              Edit
            </button>
          }
        >
          <div className="mx-4 rounded-card border border-line-soft bg-surface p-4">
            {task.description ? <Markdown text={task.description} className="text-sm" /> : <p className="text-sm text-text-3">No description yet.</p>}
          </div>
          {aiOn && (
            <Button
              variant="secondary"
              size="sm"
              icon={Sparkles}
              className="mx-4 mt-3"
              onClick={() => askAiAbout(`Help me with this task: "${task.title}". ${task.description ? `Details: ${task.description}. ` : ''}Suggest subtasks and acceptance criteria.`)}
            >
              Break it down with AI
            </Button>
          )}
        </Section>
      </Body>

      <ActionSheet
        open={prioritySheet}
        onClose={() => setPrioritySheet(false)}
        title="Priority"
        actions={[...TASK_PRIORITIES].reverse().map((p) => ({
          label: `${PRIORITY_META[p].label}${p === task.priority ? '  ✓' : ''}`,
          onSelect: () => update({ priority: p }),
        }))}
      />
      <PeoplePicker open={people} onClose={() => setPeople(false)} value={task.assigneeIds} onChange={(ids) => update({ assigneeIds: ids })} />
      <BlockedReasonDialog
        open={blockedAsk}
        onClose={() => setBlockedAsk(false)}
        onConfirm={(reason) => {
          setBlockedAsk(false);
          update({ status: 'blocked', blockedReason: reason }, 'Marked as blocked');
        }}
      />
      {editTitle && <EditTextSheet open title="Title" value={task.title} onClose={() => setEditTitle(false)} onSave={(t) => t.trim() && update({ title: t.trim() })} />}
      {editDesc && <EditTextSheet open multiline title="Description" value={task.description} onClose={() => setEditDesc(false)} onSave={(d) => update({ description: d })} />}
      <Dialog
        open={trash}
        onClose={() => setTrash(false)}
        title="Move this task to trash?"
        body="You can restore it later from Trash in the web app."
        confirmLabel="Move to trash"
        danger
        onConfirm={async () => {
          setTrash(false);
          try {
            await api().trashTask(id);
            invalidate('tasks');
            nav.pop();
            toast('Task moved to trash');
          } catch (err) {
            toast(err.message || 'Could not move the task', 'danger');
          }
        }}
      />
    </Screen>
  );
}

