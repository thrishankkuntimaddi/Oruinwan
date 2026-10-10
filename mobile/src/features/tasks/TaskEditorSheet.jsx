import { useEffect, useState } from 'react';
import { CalendarDays, Check, UserRound } from 'lucide-react';
import { api, useSession } from '../../data/session.js';
import { useMembers } from '../../data/hooks.js';
import { invalidate } from '../../data/query.js';
import { PRIORITY_META, TASK_PRIORITIES } from '../../data/constants.js';
import { Sheet } from '../../ui/Overlay.jsx';
import { Button } from '../../ui/Button.jsx';
import { Field } from '../../ui/Controls.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { cx } from '../../ui/cx.js';
import { toast } from '../../lib/bus.js';

export function toDateInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fromDateInput(value) {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 17, 0, 0).toISOString();
}

export function PriorityPicker({ value, onChange }) {
  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label="Priority">
      {TASK_PRIORITIES.map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={value === p}
          onClick={() => onChange(p)}
          className={cx(
            'flex h-9 flex-1 items-center justify-center gap-1 rounded-lg border text-[12px] font-medium',
            value === p ? 'border-accent bg-accent/12 text-text' : 'border-line bg-input text-text-2',
          )}
        >
          <span className="h-2 w-2 rounded-full" style={{ background: PRIORITY_META[p].color }} />
          {PRIORITY_META[p].label}
        </button>
      ))}
    </div>
  );
}

export function PeoplePicker({ open, onClose, value, onChange, title = 'Assignees' }) {
  const { data: members } = useMembers();
  const me = useSession((s) => s.user);
  const list = [...(members || [])].sort((a, b) => (a.id === me?.id ? -1 : b.id === me?.id ? 1 : a.name.localeCompare(b.name)));
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <Sheet open={open} onClose={onClose} title={title} footer={<Button block onClick={onClose}>Done</Button>}>
      <div className="px-2 pb-2">
        {list.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => toggle(u.id)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left active:bg-surface-2"
          >
            <Avatar name={u.name} src={u.avatarUrl} size="sm" />
            <span className="flex-1 text-[15px]">
              {u.name}
              {u.id === me?.id && <span className="text-text-2"> (you)</span>}
            </span>
            <span
              className={cx(
                'grid h-6 w-6 place-items-center rounded-md border',
                value.includes(u.id) ? 'border-accent bg-accent text-on-accent' : 'border-line-strong',
              )}
            >
              {value.includes(u.id) && <Icon as={Check} size={14} />}
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/** Create a task. `initial` pre-fills it (e.g. from a message). */
export function TaskEditorSheet({ open, onClose, initial, onCreated }) {
  const ws = useSession((s) => s.workspaceId);
  const me = useSession((s) => s.user);
  const { data: members } = useMembers();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [due, setDue] = useState('');
  const [assignees, setAssignees] = useState([]);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title || '');
    setDescription(initial?.description || '');
    setPriority(initial?.priority || 'medium');
    setDue(toDateInput(initial?.due));
    setAssignees(initial?.assigneeIds || (me ? [me.id] : []));
  }, [open, initial, me]);

  const names = assignees.map((id) => (id === me?.id ? 'You' : members?.find((m) => m.id === id)?.name?.split(' ')[0])).filter(Boolean);

  const submit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const task = await api().createTask(ws, {
        title: title.trim(),
        description: description.trim(),
        priority,
        due: fromDateInput(due),
        assigneeIds: assignees,
        channelId: initial?.channelId || null,
      });
      invalidate('tasks');
      toast('Task created', 'success');
      onClose();
      onCreated?.(task);
    } catch (err) {
      toast(err.message || 'Could not create the task', 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title="New task"
        footer={
          <Button block onClick={submit} loading={busy} disabled={!title.trim()}>
            Create task
          </Button>
        }
      >
        <div className="space-y-4 px-5 pb-4">
          <Field label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to be done?" autoFocus={!initial?.title} />
          <Field label="Description" multiline value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add details (optional)" />
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-text-2">Priority</span>
            <PriorityPicker value={priority} onChange={setPriority} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setPicker(true)} className="flex h-12 items-center gap-2.5 rounded-xl border border-line bg-input px-3.5 text-left">
              <Icon as={UserRound} size="sm" className="text-text-3" />
              <span className="truncate text-[14px]">{names.length ? names.join(', ') : 'Assign'}</span>
            </button>
            <label className="relative flex h-12 items-center gap-2.5 rounded-xl border border-line bg-input px-3.5">
              <Icon as={CalendarDays} size="sm" className="text-text-3" />
              <span className={cx('truncate text-[14px]', !due && 'text-text-3')}>
                {due ? new Date(fromDateInput(due)).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : 'Due date'}
              </span>
              {/* The native date picker sits invisibly over the whole field. */}
              <input
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                aria-label="Due date"
                className="absolute inset-0 h-full w-full opacity-0"
              />
            </label>
          </div>
        </div>
      </Sheet>
      <PeoplePicker open={picker} onClose={() => setPicker(false)} value={assignees} onChange={setAssignees} />
    </>
  );
}
