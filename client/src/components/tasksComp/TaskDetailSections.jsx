import React, { useEffect, useMemo, useState } from 'react';
import {
    Check, Link2, Loader2, PlayCircle, StopCircle, Timer, Repeat, Flag, ListChecks, Lock,
} from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';
import { statusLabel, taskErrorMessage, STATUS_META } from '../../utils/taskMeta';
import { fromRecurring, toRecurringPayload, sameRecurring, normalizeRule } from '../../utils/taskRecurrence';
import RepeatPicker from './RepeatPicker';
import { UserAvatar, FONT } from './taskUi';
import { milestoneStatusMeta } from './useTaskPlanning';
import './tasks.css';

/**
 * Detail-panel sections shared by every task panel (Tasks page and channel
 * Tasks tab), so subtasks, dependencies, time tracking, repeat and milestone
 * look and behave the same everywhere. Each root carries `tasks-ui` so the
 * tk-* controls are styled wherever the panel is mounted.
 */

const idOf = (v) => (v && typeof v === 'object' ? String(v._id || v.id || '') : v ? String(v) : '');

export function fmtSeconds(s) {
    const total = Math.max(0, Math.floor(s || 0));
    const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), sec = total % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
}

const LockHint = ({ children }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-secondary)' }}><Lock size={9} /> {children}</span>
);

export function DetailSection({ label, icon, action, children, testId }) {
    return (
        <section className="tasks-ui" data-testid={testId} style={{ fontFamily: FONT }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                <p className="tk-label" style={{ margin: 0 }}>{icon}{label}</p>
                {action}
            </div>
            {children}
        </section>
    );
}

const rowStyle = { display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px', borderRadius: '2px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', fontSize: '12px' };
const emptyText = { margin: '0 0 8px', fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' };
const linkBtn = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: 'var(--accent)', fontFamily: FONT };

/* ── Subtasks ─────────────────────────────────────────────────────────── */

/**
 * Child issues: progress, tick off, add. `canToggle(sub)` decides per row;
 * `onAdd(title)` resolves truthy on success; `onToggle(sub)` flips done/todo.
 */
export function SubtasksSection({ task, canAdd = false, canToggle = () => false, onAdd, onToggle, resolveUser = (u) => u, disabled = false }) {
    const subs = task.subtasks || [];
    const done = subs.filter((s) => s.status === 'done').length;
    const [adding, setAdding] = useState(false);
    const [title, setTitle] = useState('');
    const [busy, setBusy] = useState(false);
    const submit = async () => {
        const t = title.trim();
        if (!t || !onAdd) return;
        setBusy(true);
        try { if (await onAdd(t)) { setTitle(''); setAdding(false); } } finally { setBusy(false); }
    };
    const pct = subs.length ? Math.round((done / subs.length) * 100) : 0;

    return (
        <DetailSection testId="task-subtasks" label={`Child issues${subs.length ? ` (${done}/${subs.length} done)` : ''}`} icon={<ListChecks size={10} />}
            action={canAdd && !disabled && onAdd && <button type="button" style={linkBtn} onClick={() => setAdding((v) => !v)}>{adding ? 'Cancel' : '+ Add'}</button>}>
            {subs.length > 0 && (
                <div aria-hidden style={{ height: '3px', background: 'var(--bg-active)', borderRadius: '2px', overflow: 'hidden', marginBottom: '8px' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'var(--state-success)', transition: 'width 200ms ease' }} />
                </div>
            )}
            {adding && (
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                    <input autoFocus className="tk-field" value={title} maxLength={200} placeholder="Child issue title…" aria-label="Child issue title"
                        onChange={(e) => setTitle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setAdding(false); }} />
                    <button type="button" className="tk-btn tk-btn-primary" onClick={submit} disabled={!title.trim() || busy}>
                        {busy ? <Loader2 size={11} className="tk-spin" /> : 'Add'}
                    </button>
                </div>
            )}
            {subs.length === 0 && !adding && <p style={emptyText}>No child issues</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {subs.map((s) => {
                    const isDone = s.status === 'done';
                    const can = !disabled && !!onToggle && s.status !== 'cancelled' && canToggle(s);
                    const assignee = s.assignees?.[0];
                    return (
                        <div key={s.id} data-testid="task-subtask" style={{ ...rowStyle, padding: '4px 6px' }}>
                            <button type="button" role="checkbox" aria-checked={isDone} aria-label={s.title || 'Child issue'} disabled={!can}
                                title={can ? (isDone ? 'Mark as to do' : 'Mark as done') : 'Only its assignees or workspace admins can change this'}
                                onClick={() => can && onToggle(s)}
                                style={{
                                    width: 14, height: 14, padding: 0, borderRadius: '2px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    border: `1px solid ${isDone ? 'var(--state-success)' : 'var(--border-accent)'}`, background: isDone ? 'var(--state-success)' : 'transparent',
                                    cursor: can ? 'pointer' : 'not-allowed', opacity: can ? 1 : 0.6,
                                }}>
                                {isDone && <Check size={10} strokeWidth={3} style={{ color: '#fff' }} />}
                            </button>
                            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isDone ? 'var(--text-secondary)' : 'var(--text-primary)', textDecoration: isDone ? 'line-through' : 'none', fontStyle: s.title ? 'normal' : 'italic' }}>
                                {s.title || 'Child issue'}
                            </span>
                            {!isDone && s.status !== 'todo' && <span style={{ fontSize: '10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{statusLabel(s.status)}</span>}
                            {assignee && <UserAvatar user={resolveUser(assignee)} size={16} />}
                        </div>
                    );
                })}
            </div>
        </DetailSection>
    );
}

/* ── Dependencies ─────────────────────────────────────────────────────── */

/**
 * "Depends on": lists dependencies and adds one with POST
 * /api/v2/tasks/:id/dependency. `candidates` are tasks the viewer can pick;
 * `onAdded(dependencies)` receives [{id,title,status}].
 */
export function DependenciesSection({ task, candidates = [], lookup = [], canAdd = false, disabled = false, onAdded }) {
    const { showToast } = useToast();
    const [pick, setPick] = useState('');
    const [busy, setBusy] = useState(false);
    const byId = useMemo(() => new Map([...lookup, ...candidates].map((t) => [t.id, t])), [lookup, candidates]);
    const deps = task.dependencies || [];
    const depIds = deps.map((d) => d.id);
    const options = candidates.filter((t) => !t.deleted && !t.isSubtask && t.id !== task.id && !depIds.includes(t.id));
    const blocking = deps.filter((d) => (byId.get(d.id)?.status || d.status) && (byId.get(d.id)?.status || d.status) !== 'done').length;

    const add = async () => {
        if (!pick) return;
        setBusy(true);
        try {
            const res = await api.post(`/api/v2/tasks/${task.id}/dependency`, { dependencyTaskId: pick });
            const ids = (res.data?.dependencies || [...depIds, pick]).map(idOf);
            onAdded?.(ids.map((id) => ({ id, title: byId.get(id)?.title || '', status: byId.get(id)?.status || null })));
            setPick('');
            showToast('Dependency added', 'success');
        } catch (err) {
            showToast(taskErrorMessage(err, 'Failed to add dependency'), 'error');
        } finally { setBusy(false); }
    };

    return (
        <DetailSection testId="task-dependencies" label={`Depends on${deps.length ? ` (${deps.length})` : ''}`} icon={<Link2 size={10} />}
            action={!canAdd && !disabled && <LockHint>Creator, assignees and admins</LockHint>}>
            {deps.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                    {deps.map((d) => {
                        const known = byId.get(d.id);
                        const st = known?.status || d.status;
                        return (
                            <div key={d.id} style={rowStyle}>
                                <Link2 size={10} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                                <span style={{ flex: 1, minWidth: 0, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {known?.issueKey ? `${known.issueKey} · ` : ''}{known?.title || d.title || `Task ${d.id.slice(-6)}`}
                                </span>
                                {st && <span style={{ fontSize: '10px', whiteSpace: 'nowrap', color: st === 'done' ? 'var(--state-success)' : 'var(--text-secondary)' }}>{statusLabel(st)}</span>}
                            </div>
                        );
                    })}
                    {blocking > 0 && <p style={{ margin: '2px 0 0', fontSize: '11px', color: STATUS_META.blocked.color }}>{blocking} still open</p>}
                </div>
            ) : <p style={emptyText}>No dependencies</p>}
            {canAdd && !disabled && (
                <div style={{ display: 'flex', gap: '6px' }}>
                    <select className="tk-field" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Task this depends on">
                        <option value="">{options.length ? 'Choose a task…' : 'No other tasks'}</option>
                        {options.map((t) => <option key={t.id} value={t.id}>{t.issueKey ? `${t.issueKey} · ` : ''}{t.title}</option>)}
                    </select>
                    <button type="button" className="tk-btn" onClick={add} disabled={!pick || busy}>
                        {busy ? <Loader2 size={11} className="tk-spin" /> : 'Add'}
                    </button>
                </div>
            )}
        </DetailSection>
    );
}

/* ── Time tracking ────────────────────────────────────────────────────── */

/** Start/stop timer (POST /api/v2/tasks/:id/time/start|stop). `onChange(timeTracking)` stores the result. */
export function TimeTrackingSection({ task, disabled = false, onChange }) {
    const { showToast } = useToast();
    const sessions = task.timeTracking?.sessions || [];
    const openSession = [...sessions].reverse().find((s) => s.start && !s.end);
    const totalTime = task.timeTracking?.totalTime || 0;
    const [now, setNow] = useState(Date.now());
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        if (!openSession) return undefined;
        const iv = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(iv);
    }, [openSession]);
    const runningFor = openSession ? (now - new Date(openSession.start).getTime()) / 1000 : 0;
    const estimate = task.estimatedHours ? task.estimatedHours * 3600 : 0;

    const toggle = async () => {
        setBusy(true);
        try {
            const res = await api.post(`/api/v2/tasks/${task.id}/time/${openSession ? 'stop' : 'start'}`);
            if (res.data?.timeTracking) onChange?.(res.data.timeTracking);
            setNow(Date.now());
            showToast(openSession ? `Timer stopped — +${fmtSeconds(res.data?.elapsed)}` : 'Timer started', 'success');
        } catch (err) {
            showToast(taskErrorMessage(err, 'Timer update failed'), 'error');
        } finally { setBusy(false); }
    };

    return (
        <DetailSection testId="task-time" label="Time tracking" icon={<Timer size={10} />}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '12px', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Logged</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{fmtSeconds(totalTime)}</span>
                {estimate > 0 && <span style={{ color: 'var(--text-secondary)' }}>of {task.estimatedHours}h estimated</span>}
                {openSession && <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontWeight: 700, color: 'var(--state-success)' }}>● running {fmtSeconds(runningFor)}</span>}
            </div>
            {estimate > 0 && (
                <div aria-hidden style={{ height: '3px', background: 'var(--bg-active)', borderRadius: '2px', overflow: 'hidden', marginBottom: '8px' }}>
                    <div style={{ width: `${Math.min(100, Math.round(((totalTime + runningFor) / estimate) * 100))}%`, height: '100%', background: totalTime + runningFor > estimate ? 'var(--state-danger)' : 'var(--accent)' }} />
                </div>
            )}
            <button type="button" className={`tk-btn ${openSession ? 'tk-btn-danger' : ''}`} onClick={toggle} disabled={busy || disabled} style={{ width: '100%' }}>
                {busy ? <Loader2 size={12} className="tk-spin" /> : openSession ? <><StopCircle size={13} /> Stop timer</> : <><PlayCircle size={13} /> Start timer</>}
            </button>
        </DetailSection>
    );
}

/* ── Repeat ───────────────────────────────────────────────────────────── */

/**
 * Repeat schedule of a task. `onSave({ recurring })` saves through the
 * panel's update; when the saved task comes back without the schedule the
 * server did not keep it, and the section says so instead of pretending.
 */
export function RepeatSection({ task, canEdit = false, disabled = false, onSave }) {
    const initial = useMemo(() => fromRecurring(task.recurring), [task.recurring]);
    const [rule, setRule] = useState(initial);
    const [busy, setBusy] = useState(false);
    const [notKept, setNotKept] = useState(false);
    useEffect(() => { setRule(initial); }, [initial]);
    const dirty = JSON.stringify(normalizeRule(rule)) !== JSON.stringify(normalizeRule(initial));

    const save = async () => {
        const recurring = toRecurringPayload(rule, { dueDate: task.dueDate });
        setBusy(true);
        try {
            const saved = await onSave?.({ recurring });
            if (saved && typeof saved === 'object' && 'id' in saved) {
                const kept = sameRecurring(saved.recurring, recurring);
                setNotKept(!kept);
                if (!kept) setRule(fromRecurring(saved.recurring));
            }
        } finally { setBusy(false); }
    };

    return (
        <DetailSection testId="task-repeat" label="Repeat" icon={<Repeat size={10} />}
            action={!canEdit && <LockHint>Creator and admins</LockHint>}>
            <RepeatPicker value={rule} onChange={(r) => { setRule(r); setNotKept(false); }} dueDate={task.dueDate} disabled={!canEdit || disabled} idPrefix={`tk-repeat-${task.id}`} />
            {dirty && canEdit && !disabled && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '8px' }}>
                    <button type="button" className="tk-btn" onClick={() => setRule(initial)} disabled={busy}>Reset</button>
                    <button type="button" className="tk-btn tk-btn-primary" onClick={save} disabled={busy}>
                        {busy ? <Loader2 size={11} className="tk-spin" /> : <Check size={11} />} Save repeat
                    </button>
                </div>
            )}
            {notKept && (
                <p role="status" style={{ margin: '8px 0 0', fontSize: '11px', color: 'var(--state-danger)' }}>
                    The server didn’t keep this repeat schedule. Repeating tasks may not be available on this server yet.
                </p>
            )}
        </DetailSection>
    );
}

/* ── Milestone ────────────────────────────────────────────────────────── */

/** Link a task to a milestone. `onSave({ milestoneId })` saves through the panel's update. */
export function MilestoneSection({ task, milestones = [], canEdit = false, disabled = false, onSave }) {
    const current = idOf(task.milestoneId) || '';
    const [busy, setBusy] = useState(false);
    const [notKept, setNotKept] = useState(false);
    const linked = milestones.find((m) => m.id === current);
    if (!milestones.length && !current) return null;

    const change = async (value) => {
        setBusy(true);
        try {
            const saved = await onSave?.({ milestoneId: value || null });
            if (saved && typeof saved === 'object' && 'id' in saved) setNotKept((idOf(saved.milestoneId) || '') !== (value || ''));
        } finally { setBusy(false); }
    };

    return (
        <DetailSection testId="task-milestone" label="Milestone" icon={<Flag size={10} />}
            action={busy ? <Loader2 size={11} className="tk-spin" /> : (!canEdit && <LockHint>Creator and admins</LockHint>)}>
            <select className="tk-field" aria-label="Milestone" value={current} disabled={!canEdit || disabled || busy} onChange={(e) => change(e.target.value)}>
                <option value="">No milestone</option>
                {milestones.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                {current && !linked && <option value={current}>Milestone {current.slice(-6)}</option>}
            </select>
            {linked && (
                <p style={{ margin: '6px 0 0', fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '1px', background: milestoneStatusMeta(linked.status).color }} />
                    {milestoneStatusMeta(linked.status).label}
                    {linked.dueDate && <> · due {new Date(linked.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })}</>}
                </p>
            )}
            {notKept && (
                <p role="status" style={{ margin: '6px 0 0', fontSize: '11px', color: 'var(--state-danger)' }}>
                    The server didn’t save the milestone link. Linking tasks may not be available on this server yet.
                </p>
            )}
        </DetailSection>
    );
}

