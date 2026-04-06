// client/src/components/tasksComp/SprintBoard.jsx
/**
 * SprintBoard — Groups tasks by sprint with a sprint selector dropdown.
 * Fetches sprints from GET /api/sprints?workspaceId=...
 * Uses the same `api` axios instance (auto-includes auth token + baseURL).
 */
import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Activity, Calendar, Clock } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';

const T = {
  bg: '#0c0c0c', bar: 'rgba(255,255,255,0.05)', cardBg: 'rgba(255,255,255,0.03)',
  border: 'rgba(255,255,255,0.07)', accent: '#b8956a',
  text: '#e4e4e4', muted: 'rgba(228,228,228,0.35)',
  font: 'Inter, system-ui, sans-serif',
};

const STATUS_META = {
  'To Do':       { bg: 'rgba(255,255,255,0.06)',   color: 'rgba(228,228,228,0.45)' },
  'In Progress': { bg: 'rgba(59,130,246,0.12)',    color: '#60a5fa' },
  'In Review':   { bg: 'rgba(139,92,246,0.12)',   color: '#a78bfa' },
  'Completed':   { bg: 'rgba(34,197,94,0.1)',     color: '#4ade80' },
  'Blocked':     { bg: 'rgba(239,68,68,0.1)',     color: '#f87171' },
  'Cancelled':   { bg: 'rgba(248,113,113,0.1)',   color: '#f87171' },
};

const PRIORITY_COLORS = {
  Highest: '#ef4444', High: '#f97316', Medium: '#b8956a',
  Low: '#3b82f6', Lowest: 'rgba(228,228,228,0.3)', Emergency: '#ef4444'
};

function SprintTaskRow({ task, onClick }) {
  const sm = STATUS_META[task.status] || STATUS_META['To Do'];
  const pColor = PRIORITY_COLORS[task.priority] || '#E2B203';
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'Completed';

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px', background: T.cardBg, borderBottom: `1px solid ${T.border}`, cursor: 'pointer', transition: 'background 150ms ease', fontFamily: T.font }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
      onMouseLeave={e => e.currentTarget.style.background = T.cardBg}
      onClick={() => onClick(task)}
    >
      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: pColor, flexShrink: 0 }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: task.status === 'Completed' ? T.muted : T.text, textDecoration: task.status === 'Completed' ? 'line-through' : 'none' }}>
          {task.title}
        </p>
        {task.issueKey && (
          <span style={{ fontSize: '10px', fontFamily: 'monospace', color: T.muted }}>{task.issueKey}</span>
        )}
      </div>

      {task.dueDate && (
        <span style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0, color: isOverdue ? '#f87171' : T.muted, fontWeight: isOverdue ? 700 : 400, fontFamily: T.font }}>
          <Calendar size={9} />
          {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {isOverdue && ' · Overdue'}
        </span>
      )}

      {task.assignees?.[0]?.username && (
        <div
          style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(184,149,106,0.2)', border: '1px solid rgba(184,149,106,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 700, color: T.accent, flexShrink: 0 }}
          title={task.assignees[0].username}
        >
          {task.assignees[0].username.charAt(0).toUpperCase()}
        </div>
      )}

      <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 7px', background: sm.bg, color: sm.color, flexShrink: 0 }}>
        {task.status}
      </span>
    </div>
  );
}

function SprintProgress({ sprint, tasks }) {
  const sprintTasks = tasks.filter(t =>
    (t.sprintId && t.sprintId === sprint._id) ||
    (t.sprint && (t.sprint._id === sprint._id || t.sprint === sprint._id))
  );
  const done = sprintTasks.filter(t => t.status === 'Completed').length;
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

  // Close dropdown when clicking outside
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
        // Sprints may not exist yet — not an error
        if (err.response?.status !== 404) {
          showToast('Could not load sprints', 'error');
        }
      })
      .finally(() => setLoading(false));
  }, [workspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredTasks = selectedSprint === 'all'
    ? tasks
    : tasks.filter(t =>
        (t.sprintId && t.sprintId === selectedSprint) ||
        (t.sprint && (t.sprint._id === selectedSprint || t.sprint === selectedSprint))
      );

  const activeSprint = sprints.find(s => s._id === selectedSprint);
  const selectedLabel = selectedSprint === 'all'
    ? `All Tasks (${tasks.length})`
    : activeSprint?.name || 'Sprint';

  // Stats for the current sprint
  const doneCount = filteredTasks.filter(t => t.status === 'Completed').length;
  const inProgressCount = filteredTasks.filter(t => t.status === 'In Progress').length;
  const blockedCount = filteredTasks.filter(t => t.status === 'Blocked').length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.bg }}>
      {/* Toolbar */}
      <div style={{ flexShrink: 0, background: '#111111', borderBottom: `1px solid ${T.border}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px', fontFamily: T.font }}>
        <Activity size={14} style={{ color: T.accent }} />
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(228,228,228,0.5)' }}>Sprint</span>

        {/* Sprint selector dropdown */}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button
            onClick={() => setOpen(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', border: `1px solid ${T.border}`, padding: '5px 10px', background: 'rgba(255,255,255,0.04)', color: T.text, cursor: 'pointer', minWidth: '160px', fontFamily: T.font, transition: 'border-color 150ms ease' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
          >
            <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loading ? 'Loading…' : selectedLabel}</span>
            <ChevronDown size={12} style={{ flexShrink: 0, transition: 'transform 200ms ease', transform: open ? 'rotate(180deg)' : 'none' }} />
          </button>

          {open && (
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', zIndex: 50, background: '#1a1a1a', border: `1px solid ${T.border}`, minWidth: '220px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', fontFamily: T.font }}>
              <button
                onClick={() => { setSelectedSprint('all'); setOpen(false); }}
                style={{ width: '100%', textAlign: 'left', padding: '9px 12px', fontSize: '12px', color: selectedSprint === 'all' ? T.accent : T.text, background: 'transparent', border: 'none', borderBottom: `1px solid ${T.border}`, cursor: 'pointer', fontFamily: T.font }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600 }}>All Tasks</span>
                  <span style={{ color: T.muted }}>{tasks.length}</span>
                </div>
              </button>
              {sprints.map(s => {
                const { pct, done, total } = SprintProgress({ sprint: s, tasks });
                const statusColor = s.status === 'active' ? '#22c55e' : s.status === 'planning' ? '#3b82f6' : T.muted;
                return (
                  <button
                    key={s._id}
                    onClick={() => { setSelectedSprint(s._id); setOpen(false); }}
                    style={{ width: '100%', textAlign: 'left', padding: '9px 12px', fontSize: '12px', color: selectedSprint === s._id ? T.accent : T.text, background: 'transparent', border: 'none', borderBottom: `1px solid ${T.border}`, cursor: 'pointer', fontFamily: T.font }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '5px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                      </div>
                      <span style={{ color: T.muted, flexShrink: 0 }}>{done}/{total}</span>
                    </div>
                    <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: '#22c55e', transition: 'width 300ms ease' }} />
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

        {/* Stats strip */}
        {filteredTasks.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: '8px' }}>
            {[
              { label: 'Total', count: filteredTasks.length, color: T.muted },
              { label: 'Done', count: doneCount, color: '#4ade80' },
              { label: 'In Progress', count: inProgressCount, color: '#60a5fa' },
              { label: 'Blocked', count: blockedCount, color: '#f87171' },
            ].filter(s => s.count > 0).map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.color }} />
                <span style={{ fontSize: '10px', color: T.muted, fontFamily: T.font }}>{s.label}</span>
                <span style={{ fontSize: '10px', fontWeight: 700, color: s.color, fontFamily: T.font }}>{s.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Task list */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', background: T.bg }}>
        {/* Table header */}
        <div style={{ position: 'sticky', top: 0, display: 'flex', alignItems: 'center', gap: '12px', padding: '7px 16px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', background: '#111111', borderBottom: `1px solid ${T.border}`, color: T.muted, fontFamily: T.font, zIndex: 10 }}>
          <span style={{ width: '8px' }} />
          <span style={{ flex: 1 }}>Summary</span>
          <span style={{ width: '96px', textAlign: 'center' }}>Due Date</span>
          <span style={{ width: '24px' }} />
          <span style={{ width: '96px', textAlign: 'center' }}>Status</span>
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
