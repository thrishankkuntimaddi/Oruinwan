// Sheets opened from a conversation: polls, checklists, reminders, edit history, translation,
// message → task, AI summaries and thread participants. On wide windows each is a centred dialog.
import { useEffect, useMemo, useState } from 'react';
import { BellRing, CalendarClock, Copy, History, Languages, Plus, RotateCcw, Sparkles, Users, X } from 'lucide-react';
import { api, useSession } from '../../data/session.js';
import { invalidate } from '../../data/query.js';
import { PRIORITY_META, TASK_PRIORITIES } from '../../data/constants.js';
import { Sheet } from '../../ui/Overlay.jsx';
import { Button } from '../../ui/Button.jsx';
import { Field, Segmented, Toggle } from '../../ui/Controls.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Markdown } from '../../ui/Markdown.jsx';
import { EmptyState, Spinner } from '../../ui/Feedback.jsx';
import { cx } from '../../ui/cx.js';
import { toast } from '../../lib/bus.js';
import { shortAgo } from '../../lib/time.js';
import { wordDiff } from '../../lib/textDiff.js';
import { customReminder, reminderLabel, reminderPresets } from '../../lib/reminders.js';
import { nav } from '../../app/nav.js';
import { LANGUAGES, useTranslations } from './translate.js';

const todayInput = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function ToggleRow({ title, hint, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-input px-3.5 py-3">
      <span>
        <span className="block text-[15px]">{title}</span>
        {hint && <span className="block text-[13px] text-text-2">{hint}</span>}
      </span>
      <Toggle checked={checked} onChange={onChange} label={title} />
    </div>
  );
}

// ---------------------------------------------------------------- polls

export function PollComposerSheet({ open, onClose, onCreate }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multiple, setMultiple] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [ends, setEnds] = useState('');
  const [busy, setBusy] = useState(false);
  const clean = options.map((o) => o.trim()).filter(Boolean);
  const valid = question.trim() && clean.length >= 2;

  const reset = () => {
    setQuestion('');
    setOptions(['', '']);
    setMultiple(false);
    setAnonymous(false);
    setEnds('');
  };
  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      await onCreate({
        question: question.trim(),
        options: clean,
        allowMultiple: multiple,
        anonymous,
        endDate: ends ? new Date(`${ends}T23:59:00`).toISOString() : null,
      });
      reset();
      onClose();
    } catch (err) {
      toast(err.message || 'Could not create the poll.', 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="New poll"
      footer={
        <Button block onClick={submit} loading={busy} disabled={!valid}>
          Post poll
        </Button>
      }
    >
      <div className="space-y-4 px-5 pb-4">
        <Field label="Question" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What should we decide?" maxLength={300} />
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-text-2">Options</p>
          <div className="space-y-2">
            {options.map((o, i) => (
              <Field
                key={i}
                value={o}
                aria-label={`Option ${i + 1}`}
                placeholder={`Option ${i + 1}`}
                maxLength={200}
                onChange={(e) => setOptions((list) => list.map((x, j) => (j === i ? e.target.value : x)))}
                trailing={
                  options.length > 2 ? (
                    <button type="button" aria-label={`Remove option ${i + 1}`} onClick={() => setOptions((list) => list.filter((_, j) => j !== i))} className="text-text-3">
                      <Icon as={X} size="sm" />
                    </button>
                  ) : null
                }
              />
            ))}
          </div>
          {options.length < 10 && (
            <Button variant="ghost" size="sm" icon={Plus} className="mt-1.5" onClick={() => setOptions((list) => [...list, ''])}>
              Add option
            </Button>
          )}
        </div>
        <ToggleRow title="Allow more than one choice" checked={multiple} onChange={setMultiple} />
        <ToggleRow title="Anonymous" hint="Nobody sees who voted for what" checked={anonymous} onChange={setAnonymous} />
        <Field label="Ends (optional)" type="date" min={todayInput()} value={ends} onChange={(e) => setEnds(e.target.value)} />
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- checklists

export function ChecklistComposerSheet({ open, onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const items = text.split('\n').map((s) => s.trim()).filter(Boolean);
  const submit = async () => {
    if (!items.length || items.length > 50) return;
    setBusy(true);
    try {
      await onCreate({ title: title.trim(), items });
      setTitle('');
      setText('');
      onClose();
    } catch (err) {
      toast(err.message || 'Could not send the checklist.', 'danger');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="New checklist"
      footer={
        <Button block onClick={submit} loading={busy} disabled={!items.length || items.length > 50}>
          Send checklist
        </Button>
      }
    >
      <div className="space-y-4 px-5 pb-4">
        <Field label="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Launch checklist" maxLength={200} />
        <Field
          label="Items, one per line"
          multiline
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Write release notes\nUpdate the docs\nTell support'}
          hint={items.length > 50 ? 'A checklist can have up to 50 items.' : `${items.length} item${items.length === 1 ? '' : 's'} · everyone here can tick them off`}
        />
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- reminders

export function ReminderSheet({ message, conv, onClose }) {
  const open = Boolean(message);
  const [custom, setCustom] = useState(false);
  const [date, setDate] = useState(todayInput());
  const [time, setTime] = useState('09:00');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(null);
  // Fresh choices each time the sheet opens ("in 20 minutes" from now).
  const presets = useMemo(() => (open ? reminderPresets() : []), [open]);
  useEffect(() => {
    if (open) {
      setCustom(false);
      setNote('');
    }
  }, [open]);

  const set = async (at, id) => {
    setBusy(id);
    try {
      await api().remindMe(conv, message.id, at, note.trim());
      invalidate('reminders');
      toast(`I'll remind you ${reminderLabel(at).replace(/^Today/, 'today').replace(/^Tomorrow/, 'tomorrow')}`, 'success');
      onClose();
    } catch (err) {
      toast(err.message || 'Could not set the reminder.', 'danger');
    } finally {
      setBusy(null);
    }
  };
  const customAt = customReminder(date, time);

  return (
    <Sheet open={open} onClose={onClose} title="Remind me about this">
      <div className="px-2 pb-2">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={busy !== null}
            onClick={() => set(p.at, p.id)}
            className="flex w-full items-center gap-3.5 rounded-xl px-3 py-3 text-left active:bg-surface-2 disabled:opacity-60"
          >
            <Icon as={BellRing} className="text-text-2" />
            <span className="flex-1 text-[15px]">{p.label}</span>
            {busy === p.id ? <Spinner className="text-text-2" /> : <span className="text-[13px] text-text-3">{reminderLabel(p.at)}</span>}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCustom((v) => !v)}
          aria-expanded={custom}
          className="flex w-full items-center gap-3.5 rounded-xl px-3 py-3 text-left active:bg-surface-2"
        >
          <Icon as={CalendarClock} className="text-text-2" />
          <span className="flex-1 text-[15px]">Choose a date and time</span>
        </button>
      </div>
      <div className="space-y-3 px-5 pb-4">
        {custom && (
          <div className="flex gap-2.5">
            <Field className="flex-1" label="Date" type="date" min={todayInput()} value={date} onChange={(e) => setDate(e.target.value)} />
            <Field className="w-32" label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        )}
        <Field label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why remind you?" maxLength={500} />
        {custom && (
          <Button block disabled={!customAt} loading={busy === 'custom'} onClick={() => set(customAt, 'custom')}>
            {customAt ? `Remind me ${reminderLabel(customAt)}` : 'Pick a time in the future'}
          </Button>
        )}
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- edit history

function DiffText({ parts }) {
  return (
    <p className="selectable text-[14px] leading-6 whitespace-pre-wrap">
      {parts.map((p, i) => (
        <span
          key={i}
          className={cx(p.type === 'add' && 'rounded-sm bg-success/15 text-success', p.type === 'del' && 'rounded-sm bg-danger/12 text-danger line-through')}
        >
          {p.text}
        </span>
      ))}
    </p>
  );
}

export function EditHistorySheet({ message, conv, onClose }) {
  const open = Boolean(message);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [showDiff, setShowDiff] = useState(true);
  const [restoring, setRestoring] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setData(null);
    setError(null);
    api()
      .messageVersions(conv, message.id)
      .then((d) => alive && setData(d))
      .catch((err) => alive && setError(err.message || 'Could not load the history.'));
    return () => {
      alive = false;
    };
  }, [open, conv, message?.id]);

  const restore = async (v) => {
    setRestoring(v.index);
    try {
      await api().restoreVersion(conv, message.id, v.index);
      invalidate(`messages:${conv.id}`, 'thread:');
      toast(`Restored version ${v.version}`, 'success');
      onClose();
    } catch (err) {
      toast(err.message || 'Could not restore that version.', 'danger');
    } finally {
      setRestoring(null);
    }
  };

  const versions = data ? [...data.versions].reverse() : [];
  return (
    <Sheet open={open} onClose={onClose} title="Edit history" full>
      <div className="px-4 pb-4">
        {error ? (
          <EmptyState icon={History} title="History unavailable" body={error} />
        ) : !data ? (
          <div className="grid place-items-center py-10 text-text-2">
            <Spinner />
          </div>
        ) : (
          <>
            <Segmented
              className="mb-3"
              size="sm"
              value={showDiff ? 'diff' : 'text'}
              onChange={(v) => setShowDiff(v === 'diff')}
              options={[
                { value: 'diff', label: 'Changes' },
                { value: 'text', label: 'Full text' },
              ]}
            />
            <ol className="space-y-2.5">
              {versions.map((v, i) => {
                const older = versions[i + 1];
                const readable = v.state === 'ok';
                return (
                  <li key={v.version} className={cx('rounded-xl border bg-surface px-3.5 py-3', v.current ? 'border-accent/50' : 'border-line-soft')}>
                    <p className="mb-1.5 flex items-center gap-2 text-[12px] text-text-2">
                      <span className="font-semibold text-text">{v.current ? 'Current' : `Version ${v.version}`}</span>
                      {v.at && <span>{shortAgo(v.at)}</span>}
                      {!v.current && data.canRestore && readable && (
                        <button
                          type="button"
                          onClick={() => restore(v)}
                          disabled={restoring !== null}
                          className="ml-auto inline-flex items-center gap-1 font-medium text-accent-ink"
                        >
                          {restoring === v.index ? <Spinner className="h-3 w-3" /> : <Icon as={RotateCcw} size={12} />} Restore
                        </button>
                      )}
                    </p>
                    {!readable ? (
                      <p className="text-[13px] italic text-text-2">{v.state === 'locked' ? 'Unlock your messages to read this version.' : "This version couldn't be decrypted."}</p>
                    ) : showDiff && older && older.state === 'ok' ? (
                      <DiffText parts={wordDiff(older.text, v.text)} />
                    ) : (
                      <p className="selectable text-[14px] leading-6 whitespace-pre-wrap">{v.text}</p>
                    )}
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- translation

export function TranslateSheet({ message, onClose }) {
  const open = Boolean(message);
  const { autoLang, lastLang, translate, setAutoLang } = useTranslations();
  return (
    <Sheet open={open} onClose={onClose} title="Translate">
      <div className="px-2 pb-2">
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => {
              translate(message.id, message.text, l.code);
              onClose();
            }}
            className="flex w-full items-center gap-3.5 rounded-xl px-3 py-3 text-left active:bg-surface-2"
          >
            <Icon as={Languages} className="text-text-2" />
            <span className="flex-1 text-[15px]">{l.label}</span>
            {l.code === lastLang && <span className="text-[12px] text-text-3">Last used</span>}
          </button>
        ))}
      </div>
      <div className="px-5 pb-4">
        <AutoTranslateSetting autoLang={autoLang} setAutoLang={setAutoLang} fallback={lastLang} />
      </div>
    </Sheet>
  );
}

export function AutoTranslateSetting({ autoLang, setAutoLang, fallback = 'en' }) {
  return (
    <div className="rounded-xl border border-line bg-input px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <span>
          <span className="block text-[15px]">Translate messages automatically</span>
          <span className="block text-[13px] text-text-2">Other people's messages, on this device</span>
        </span>
        <Toggle checked={Boolean(autoLang)} onChange={(on) => setAutoLang(on ? fallback : '')} label="Translate messages automatically" />
      </div>
      {autoLang && (
        <select
          aria-label="Translate into"
          value={autoLang}
          onChange={(e) => setAutoLang(e.target.value)}
          className="mt-2.5 h-10 w-full rounded-lg border border-line bg-surface px-2.5 text-[15px] text-text"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              Into {l.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- message → task

export function ConvertTaskSheet({ message, conv, label, onClose }) {
  const open = Boolean(message);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!message) return;
    const text = message.text || '';
    setTitle(text.split('\n')[0].replace(/[*_`#>]/g, '').trim().slice(0, 80));
    setDescription(text ? `From ${label}:\n> ${text.slice(0, 1500)}` : '');
    setPriority('medium');
    setDue('');
  }, [message, label]);

  const submit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const task = await api().convertToTask(conv, message.id, { title: title.trim(), description, priority, due });
      invalidate('tasks');
      onClose();
      toast('Task created from the message', 'success');
      if (task?.id) nav.push('task', { id: task.id }, { tab: 'tasks' });
    } catch (err) {
      toast(err.status === 409 ? 'This message is already a task.' : err.message || 'Could not create the task.', 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Convert to task"
      footer={
        <Button block onClick={submit} loading={busy} disabled={!title.trim()}>
          Create task
        </Button>
      }
    >
      <div className="space-y-4 px-5 pb-4">
        <Field label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        <Field label="Description" multiline value={description} onChange={(e) => setDescription(e.target.value)} />
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-text-2">Priority</p>
          <Segmented size="sm" value={priority} onChange={setPriority} options={TASK_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_META[p].label }))} />
        </div>
        <Field label="Due date (optional)" type="date" min={todayInput()} value={due} onChange={(e) => setDue(e.target.value)} />
        <p className="text-[12px] text-text-3">The task links back to this message, so anyone in the conversation can see where it came from.</p>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- AI summaries

/**
 * Summarise decrypted messages with AI. `options`: [{ id, label, hint, run: () => Promise<text> }].
 * The first option runs as soon as the sheet opens.
 */
export function SummarySheet({ open, onClose, title = 'Summary', options = [] }) {
  const [active, setActive] = useState(null);
  const [state, setState] = useState({ status: 'idle' });

  const run = async (o) => {
    setActive(o.id);
    setState({ status: 'loading' });
    try {
      const text = await o.run();
      setState({ status: 'done', text: text || 'Nothing to summarise yet.' });
    } catch (err) {
      const code = err?.data?.code || err?.code;
      const msg = code === 'AI_NOT_CONFIGURED' || err?.status === 503 ? "Oruinwan AI isn't set up on this server yet." : err.message || 'Oruinwan AI could not answer.';
      setState({ status: 'error', error: msg });
    }
  };

  useEffect(() => {
    if (open && options[0]) run(options[0]);
    if (!open) setState({ status: 'idle' });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(state.text);
      toast('Copied');
    } catch {
      toast("Couldn't copy on this device", 'danger');
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={title} full>
      <div className="px-4 pb-4">
        {options.length > 1 && (
          <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                disabled={o.disabled}
                onClick={() => run(o)}
                className={cx(
                  'pressable h-8 shrink-0 rounded-full border px-3.5 text-[13px] font-medium disabled:opacity-45',
                  active === o.id ? 'border-accent bg-accent/15 text-accent-ink' : 'border-line bg-surface text-text-2',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
        {state.status === 'loading' && (
          <p className="flex items-center gap-2 py-6 text-sm text-text-2">
            <Spinner /> Reading the conversation…
          </p>
        )}
        {state.status === 'error' && <p className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger">{state.error}</p>}
        {state.status === 'done' && (
          <div className="rounded-xl border border-line-soft bg-surface px-3.5 py-3">
            <p className="mb-2 flex items-center gap-1.5 text-[12px] text-text-3">
              <Icon as={Sparkles} size={12} className="text-accent-ink" /> Oruinwan AI · from messages decrypted on this device
              <button type="button" onClick={copy} aria-label="Copy summary" className="ml-auto grid h-7 w-7 place-items-center rounded-full text-text-2 active:bg-surface-2">
                <Icon as={Copy} size={14} />
              </button>
            </p>
            <Markdown text={state.text} className="text-text" />
          </div>
        )}
        {options.find((o) => o.id === active)?.hint && <p className="mt-2 text-[12px] text-text-3">{options.find((o) => o.id === active).hint}</p>}
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- thread participants

export function ParticipantsSheet({ open, onClose, participants = [], directory = {} }) {
  const ws = useSession((s) => s.workspaceId);
  return (
    <Sheet open={open} onClose={onClose} title={`In this thread · ${participants.length}`}>
      <div className="px-2 pb-3">
        {participants.length ? (
          participants.map((p, i) => {
            const u = directory[p.id] || {};
            const name = u.name || p.username || 'Someone';
            return (
              <button
                key={`${p.id}-${ws}`}
                type="button"
                onClick={() => {
                  onClose();
                  nav.push('profile', { userId: p.id });
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left active:bg-surface-2"
              >
                <Avatar name={name} src={u.avatarUrl || p.avatarUrl} size="sm" presence={u.presence} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px]">{name}</span>
                  <span className="block text-[13px] text-text-2">
                    {i === 0 ? 'Started the thread' : ''}
                    {i === 0 && p.replyCount ? ' · ' : ''}
                    {p.replyCount ? `${p.replyCount} ${p.replyCount === 1 ? 'reply' : 'replies'}` : ''}
                  </span>
                </span>
              </button>
            );
          })
        ) : (
          <EmptyState icon={Users} title="No one yet" body="People who reply show up here." />
        )}
      </div>
    </Sheet>
  );
}

