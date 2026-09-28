import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Activity, Calendar, Clock } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';
import { taskErrorMessage, STATUS_META } from '../../utils/taskMeta';
import { PriorityIcon, StatusBadge, AvatarStack, fmtDate, isOverdue, FONT } from './taskUi';

const T = {
  bg: 'var(--bg-base)', bar: 'var(--bg-hover)', cardBg: 'var(--bg-base)',
  border: 'var(--border-subtle)', accent: 'var(--accent)',
  text: 'var(--text-primary)', muted: 'var(--text-secondary)',
  font: FONT,
};

const sameId = (a, b) => a != null && b != null && String(a) === String(b);
const inSprint = (t, sprintId) => sameId(t.sprintId, sprintId) || sameId(t.sprint?._id || t.sprint, sprintId);

function SprintTaskRow({ task, onClick }) {
  const overdue = isOverdue(task);
  const done = task.status === 'done';
  return (
    <div
      role="button"
      tabIndex={0}
      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px', minHeight: '44px', background: T.cardBg, borderBottom: `1px solid ${T.border}`, cursor: 'pointer', transition: 'background 150ms ease', fontFamily: T.font }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = T.cardBg; }}
      onClick={() => onClick(task)}
      onKeyDown={e => { if (e.key === 'Enter') onClick(task); }}
    >
      <span style={{ width: '16px', display: 'inline-flex', justifyContent: 'center' }}><PriorityIcon priority={task.priority} size={13} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: done ? T.muted : T.text, textDecoration: done ? 'line-through' : 'none' }}>
          {task.title}
        </p>
        {task.issueKey && <span style={{ fontSize: '10px', fontFamily: 'monospace', color: T.muted }}>{task.issueKey}</span>}
      </div>
      <span style={{ width: '96px', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', flexShrink: 0, color: overdue ? 'var(--state-danger)' : T.muted, fontWeight: overdue ? 700 : 400 }}>
        {task.dueDate ? <><Calendar size={10} /> {fmtDate(task.dueDate, { month: 'short', day: 'numeric' })}</> : '—'}
      </span>
      <span style={{ width: '56px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}><AvatarStack users={task.assignees} size={18} /></span>
      <span style={{ width: '110px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}><StatusBadge status={task.status} compact /></span>
    </div>
  );
}

function SprintProgress({ sprint, tasks }) {
  const sprintTasks = tasks.filter(t => inSprint(t, sprint._id));
  const done = sprintTasks.filter(t => t.status === 'done').length;
  const pct = sprintTasks.length > 0 ? Math.round((done / sprintTasks.length) * 100) : 0;
  return { pct, done, total: sprintTasks.length };
}

export default function SprintBoard({ tasks = [], workspaceId, onTaskClick }) {
  const { showToast } = useToast();
  const [sprints, setSprints] = useState([]);
  const [selectedSprint, setSelectedSprint] = useState('all');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    setLoading(true);
    api.get(`/api/sprints?workspaceId=${workspaceId}`)
      .then(res => setSprints(res.data.sprints || []))
      .catch(err => {
        
        if (err.response?.status !== 404) {
          showToast(taskErrorMessage(err, 'Could not load sprints'), 'error');
        }
      })
      .finally(() => setLoading(false));
  }, [workspaceId, showToast]);

  const filteredTasks = selectedSprint === 'all'
    ? tasks
    : tasks.filter(t => inSprint(t, selectedSprint));

  const activeSprint = sprints.find(s => sameId(s._id, selectedSprint));
  const selectedLabel = selectedSprint === 'all'
    ? `All Tasks (${tasks.length})`
    : activeSprint?.name || 'Sprint';

  
  const doneCount = filteredTasks.filter(t => t.status === 'done').length;
  const inProgressCount = filteredTasks.filter(t => t.status === 'in_progress').length;
  const blockedCount = filteredTasks.filter(t => t.status === 'blocked').length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.bg }}>
      {}
      <div style={{ flexShrink: 0, background: 'var(--bg-surface)', borderBottom: `1px solid ${T.border}`, padding: '10px 16px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', fontFamily: T.font }}>
        <Activity size={14} style={{ color: T.accent }} />
        <span style={{ fontSize: '12px', fontWeight: 600, color: T.muted }}>Sprint</span>

        {}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button
            onClick={() => setOpen(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', border: '1px solid var(--border-default)', borderRadius: '2px', padding: '5px 10px', background: 'var(--bg-input)', color: T.text, cursor: 'pointer', minWidth: '160px', fontFamily: T.font, transition: 'border-color 150ms ease' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
          >
            <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loading ? 'Loading…' : selectedLabel}</span>
            <ChevronDown size={12} style={{ flexShrink: 0, transition: 'transform 200ms ease', transform: open ? 'rotate(180deg)' : 'none' }} />
          </button>

          {open && (
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', zIndex: 50, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', minWidth: '220px', boxShadow: 'var(--card-shadow)', fontFamily: T.font }}>
              <button
                onClick={() => { setSelectedSprint('all'); setOpen(false); }}
                style={{ width: '100%', textAlign: 'left', padding: '9px 12px', fontSize: '12px', color: selectedSprint === 'all' ? T.accent : T.text, background: 'transparent', border: 'none', borderBottom: `1px solid ${T.border}`, cursor: 'pointer', fontFamily: T.font }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600 }}>All Tasks</span>
                  <span style={{ color: T.muted }}>{tasks.length}</span>
                </div>
              </button>
              {sprints.map(s => {
                const { pct, done, total } = SprintProgress({ sprint: s, tasks });
                const statusColor = s.status === 'active' ? 'var(--state-success)' : s.status === 'planning' ? 'var(--accent)' : T.muted;
                return (
                  <button
                    key={s._id}
                    onClick={() => { setSelectedSprint(s._id); setOpen(false); }}
                    style={{ width: '100%', textAlign: 'left', padding: '9px 12px', fontSize: '12px', color: selectedSprint === s._id ? T.accent : T.text, background: 'transparent', border: 'none', borderBottom: `1px solid ${T.border}`, cursor: 'pointer', fontFamily: T.font }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '5px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                      </div>
                      <span style={{ color: T.muted, flexShrink: 0 }}>{done}/{total}</span>
                    </div>
                    <div style={{ height: '3px', background: 'var(--bg-active)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--state-success)', transition: 'width 300ms ease' }} />
                    </div>
                    {s.startDate && s.endDate && (
                      <p style={{ fontSize: '9px', color: T.muted, marginTop: '3px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Clock size={8} />
                        {new Date(s.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} →{' '}
                        {new Date(s.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    )}
                  </button>
                );
              })}
              {sprints.length === 0 && !loading && (
                <div style={{ padding: '12px', fontSize: '12px', color: T.muted, textAlign: 'center', fontFamily: T.font }}>
                  No sprints yet.
                </div>
              )}
            </div>
          )}
        </div>

        {}
        {filteredTasks.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: '8px' }}>
            {[
              { label: 'Total', count: filteredTasks.length, color: T.muted },
              { label: 'Done', count: doneCount, color: STATUS_META.done.color },
              { label: 'In progress', count: inProgressCount, color: STATUS_META.in_progress.color },
              { label: 'Blocked', count: blockedCount, color: STATUS_META.blocked.color },
            ].filter(s => s.count > 0).map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.color }} />
                <span style={{ fontSize: '11px', color: T.muted, fontFamily: T.font }}>{s.label}</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: T.text, fontFamily: T.font }}>{s.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', background: T.bg }}>
        {}
        <div style={{ position: 'sticky', top: 0, display: 'flex', alignItems: 'center', gap: '12px', padding: '7px 16px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)', color: T.muted, fontFamily: T.font, zIndex: 10 }}>
          <span style={{ width: '16px' }} />
          <span style={{ flex: 1 }}>Summary</span>
          <span style={{ width: '96px', textAlign: 'center' }}>Due date</span>
          <span style={{ width: '56px', textAlign: 'center' }}>Assignee</span>
          <span style={{ width: '110px', textAlign: 'center' }}>Status</span>
        </div>

        {filteredTasks.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '192px', color: T.muted, gap: '8px', fontFamily: T.font }}>
            <Activity size={24} style={{ opacity: 0.3 }} />
            <p style={{ fontSize: '13px' }}>
              {selectedSprint === 'all' ? 'No tasks' : 'No tasks in this sprint'}
            </p>
          </div>
        ) : (
          filteredTasks.map(task => (
            <SprintTaskRow key={task.id || task._id} task={task} onClick={onTaskClick} />
          ))
        )}
      </div>
    </div>
  );
}
