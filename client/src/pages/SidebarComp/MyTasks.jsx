/**
 * MyTasks.jsx — Jira-Grade Workspace Task Dashboard
 *
 * Scope: ENTIRE workspace — personal, incoming, delegated, across ALL channels
 *
 * Views:
 *  - My Issues       (self-created self-assigned)
 *  - Incoming        (assigned to me by others)
 *  - Given           (I delegated to others)
 *  - All Issues      (everything I can see — filterable by channel)
 *  - Completed       (done tasks)
 *  - Trash           (deleted tasks with restore/permanent delete)
 *
 * Modes: List view (default) | Board view (Jira Kanban)
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Plus, Search, X, Loader2, CheckCircle2, Clock, Circle,
  ChevronUp, ChevronDown, Minus, Calendar, User, Flag,
  AlertTriangle, Trash2, RotateCcw, Activity, ListTodo,
  LayoutGrid, List, SlidersHorizontal, ChevronRight, ChevronLeft,
  BookOpen, Inbox, Send, Eye, Archive, Hash, Bell, Zap,
  GitBranch, Timer, Users
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useIsMobile } from '../../hooks/useIsMobile';
import TaskModal from '../../components/tasksComp/TaskModal';
import WorkspaceTaskDetailPanel from '../../components/tasksComp/WorkspaceTaskDetailPanel';
import TransferRequestModal from '../../components/tasksComp/TransferRequestModal';
import TaskCompletionModal from '../../components/tasksComp/TaskCompletionModal';
import KanbanBoard from '../../components/tasksComp/KanbanBoard';
import SprintBoard from '../../components/tasksComp/SprintBoard';
import TimelineView from '../../components/tasksComp/TimelineView';
import WorkloadPanel from '../../components/tasksComp/WorkloadPanel';
import { useTasks } from '../../contexts/TasksContext';
import { useAuth } from '../../contexts/AuthContext';
import { useContacts } from '../../contexts/ContactsContext';
import api from '@services/api';

// ─── Design tokens (Jira Atlas palette) ─────────────────────────────────────-

const JIRA_BLUE = '#b8956a'; // amber accent
const BOARD_BG = '#0f0f0f';  // Monolith Flow board bg
const SIDEBAR_BG = '#111111';
const TOOLBAR_BG = '#0c0c0c';
const BORDER_COLOR = 'rgba(255,255,255,0.06)';
const TEXT_PRIMARY = '#e4e4e4';
const TEXT_MUTED = 'rgba(228,228,228,0.45)';
const CARD_SHADOW = '0 1px 2px rgba(0,0,0,0.5)';

const STATUS_META = {
  'To Do':      { bg: 'rgba(255,255,255,0.06)', color: 'rgba(228,228,228,0.5)', border: 'rgba(255,255,255,0.12)' },
  'In Progress':{ bg: 'rgba(96,165,250,0.12)', color: '#60a5fa',               border: 'rgba(96,165,250,0.25)'  },
  'Completed':  { bg: 'rgba(52,211,153,0.1)',  color: '#34d399',               border: 'rgba(52,211,153,0.25)'  },
  'Cancelled':  { bg: 'rgba(248,113,113,0.08)',color: '#f87171',               border: 'rgba(248,113,113,0.2)'  },
  'Blocked':    { bg: 'rgba(248,113,113,0.1)', color: '#f87171',               border: 'rgba(248,113,113,0.25)' },
  'In Review':  { bg: 'rgba(167,139,250,0.1)', color: '#a78bfa',               border: 'rgba(167,139,250,0.25)' },
};

const PRIORITY_META = {
  Highest: { color: '#CD1317', bg: 'rgba(205,19,23,0.08)' },
  High: { color: '#E97F33', bg: 'rgba(233,127,51,0.08)' },
  Medium: { color: '#E2B203', bg: 'rgba(226,178,3,0.08)' },
  Low: { color: '#3E7FC1', bg: 'rgba(62,127,193,0.08)' },
  Lowest: { color: '#7A869A', bg: 'rgba(122,134,154,0.08)' },
  // Legacy values
  Emergency: { color: '#CD1317', bg: 'rgba(205,19,23,0.08)' },
};

const BOARD_COLUMNS = [
  { key: 'To Do', label: 'TO DO', color: '#42526E', headerBg: '#DFE1E6', topColor: '#42526E' },
  { key: 'In Progress', label: 'IN PROGRESS', color: '#0052CC', headerBg: '#DEEBFF', topColor: '#0052CC' },
  { key: 'In Review', label: 'IN REVIEW', color: '#6554C0', headerBg: '#EAE6FF', topColor: '#6554C0' },
  { key: 'Completed', label: 'DONE', color: '#00875A', headerBg: '#E3FCEF', topColor: '#00875A' },
];

const SIDEBAR_VIEWS = [
  { key: 'my-tasks', label: 'My Issues', icon: <Circle size={15} /> },
  { key: 'shared-tasks', label: 'Incoming', icon: <Inbox size={15} /> },
  { key: 'assigned-tasks', label: 'Given', icon: <Send size={15} /> },
  { key: 'all-tasks', label: 'All Issues', icon: <Eye size={15} /> },
  null, // separator
  { key: 'completed-tasks', label: 'Completed', icon: <CheckCircle2 size={15} /> },
  { key: 'deleted-tasks', label: 'Trash', icon: <Trash2 size={15} /> },
];

const SORT_OPTIONS = [
  { id: 'priority', label: 'Priority' },
  { id: 'dueDate', label: 'Due Date' },
  { id: 'status', label: 'Status' },
  { id: 'a-z', label: 'Alphabetical' },
  { id: 'newest', label: 'Newest First' },
];

const PRIORITY_ORDER = { Emergency: 5, Highest: 5, High: 4, Medium: 3, Low: 2, Lowest: 1 };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function PriorityIcon({ priority, size = 14 }) {
  const p = priority?.toLowerCase();
  const color = PRIORITY_META[priority]?.color || '#E2B203';
  if (p === 'highest' || p === 'emergency') return <ChevronUp size={size} strokeWidth={3} style={{ color }} />;
  if (p === 'high') return <ChevronUp size={size} strokeWidth={2} style={{ color }} />;
  if (p === 'low') return <ChevronDown size={size} strokeWidth={2} style={{ color }} />;
  if (p === 'lowest') return <ChevronDown size={size} strokeWidth={3} style={{ color }} />;
  return <Minus size={size} strokeWidth={2.5} style={{ color }} />;
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META['To Do'];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '3px 8px', background: m.bg, color: m.color, border: `1px solid ${m.border}` }}>
      {status === 'To Do' && <Circle size={8} style={{ marginRight: '4px' }} strokeWidth={2.5} />}
      {status === 'In Progress' && <Clock size={8} style={{ marginRight: '4px' }} strokeWidth={2.5} />}
      {status === 'Completed' && <CheckCircle2 size={8} style={{ marginRight: '4px' }} strokeWidth={2.5} />}
      {status}
    </span>
  );
}

function avatarColor(name) {
  const colors = ['#b8956a', '#60a5fa', '#34d399', '#a78bfa', '#fb923c', '#f472b6', '#38bdf8', '#818cf8'];
  if (!name) return colors[0];
  return colors[name.charCodeAt(0) % colors.length];
}
function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}
function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function isOverdue(task) {
  return task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'Completed' && task.status !== 'Cancelled';
}

// ─── Issue Type Icon (Jira-discipline) ────────────────────────────────

const ISSUE_TYPE_META = {
  epic: { label: 'Epic', color: '#6554C0', bg: '#EAE6FF', Icon: Zap },
  bug: { label: 'Bug', color: '#FF5630', bg: '#FFEBE6', Icon: AlertTriangle },
  subtask: { label: 'Subtask', color: '#00B8D9', bg: '#E6FCFF', Icon: CheckCircle2 },
  task: { label: 'Task', color: '#0052CC', bg: '#DEEBFF', Icon: CheckCircle2 },
};

function IssueTypeIcon({ type = 'task', size = 11 }) {
  const meta = ISSUE_TYPE_META[type] || ISSUE_TYPE_META.task;
  const { Icon, color, bg } = meta;
  return (
    <span title={meta.label}
      className="inline-flex items-center justify-center rounded-sm flex-shrink-0"
      style={{ width: 16, height: 16, background: bg }}>
      <Icon size={size} style={{ color }} strokeWidth={2.5} />
    </span>
  );
}

// ─── Transfer Request Banner ───────────────────────────────────────────────

function TransferBanner({ task, onApprove, onReject, onRequest }) {
  if (task.transferRequest?.status === 'pending') {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 12px', marginTop: '6px', fontSize: '12px', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.22)' }}>
        <Bell size={12} style={{ marginTop: '1px', flexShrink: 0, color: '#a78bfa' }} />
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 700, color: '#a78bfa' }}>Transfer Pending</span>
          <span style={{ color: 'rgba(228,228,228,0.4)', marginLeft: '6px' }}>→ {task.transferRequest.requestedTo?.username || '?'}</span>
          {task.transferRequest.note && <p style={{ color: 'rgba(228,228,228,0.35)', fontStyle: 'italic', marginTop: '2px' }}>"{task.transferRequest.note}"</p>}
        </div>
        {onApprove && (
          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
            <button onClick={e => { e.stopPropagation(); onApprove(); }}
              style={{ padding: '3px 10px', fontSize: '10px', fontWeight: 700, color: '#0c0c0c', background: '#a78bfa', border: 'none', cursor: 'pointer' }}>Approve</button>
            <button onClick={e => { e.stopPropagation(); onReject(); }}
              style={{ padding: '3px 8px', fontSize: '10px', color: '#a78bfa', background: 'transparent', border: '1px solid rgba(167,139,250,0.3)', cursor: 'pointer' }}>Reject</button>
          </div>
        )}
      </div>
    );
  }
  return null;
}

// ─── List Row ─────────────────────────────────────────────────────────────────

function ListRow({ task, view, onEdit, onDelete, onRestore, onPermanentDelete, onTransferRequest, onTransferApprove, onTransferReject, onStatusChange }) {
  const isDeleted = task.deleted;
  const isCompleted = task.status === 'Completed';
  const overdue = isOverdue(task);
  const pMeta = PRIORITY_META[task.priority] || PRIORITY_META.Medium;
  const isIncoming = view === 'shared-tasks';
  const isGiven = view === 'assigned-tasks';

  return (
    <div
      className="group relative"
      style={{ background: '#111', borderBottom: `1px solid ${BORDER_COLOR}`, cursor: 'pointer', transition: 'background 150ms ease' }}
      onMouseEnter={e => e.currentTarget.style.background = '#161616'}
      onMouseLeave={e => e.currentTarget.style.background = '#111'}
      onClick={() => onEdit(task)}
    >
      {/* Priority strip */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r-full"
        style={{ background: pMeta.color }} />

      <div className="flex items-center gap-4 px-4 py-3 pl-5">
        {/* Issue type icon (replaces plain status dot) */}
        <div className="flex-shrink-0">
          <IssueTypeIcon type={task.issueType || 'task'} size={11} />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            {/* Issue key */}
            {task.issueKey && (
              <span className="text-[10px] font-mono font-semibold flex-shrink-0 mt-0.5" style={{ color: '#7A869A' }}>
                {task.issueKey}
              </span>
            )}
            <p className={`text-sm font-medium leading-snug flex-1 truncate ${isCompleted || isDeleted ? 'line-through' : ''}`}
              style={{ color: isCompleted || isDeleted ? 'rgba(228,228,228,0.3)' : TEXT_PRIMARY }}>
              {task.title}
            </p>
          </div>

          {/* Labels chips */}
          {task.labels?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {task.labels.slice(0, 4).map(l => (
                <span key={l} style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 6px', fontSize: '9px', fontWeight: 600, background: 'rgba(184,149,106,0.12)', color: '#b8956a', border: '1px solid rgba(184,149,106,0.2)' }}>{l}</span>
              ))}
            </div>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {/* Channel / Project */}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 500, color: 'rgba(228,228,228,0.4)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', padding: '1px 6px' }}>
              <Hash size={9} /> {task.project || 'General'}
            </span>

            {/* Priority */}
            <span className="flex items-center gap-0.5 text-[10px] font-semibold"
              style={{ color: PRIORITY_META[task.priority]?.color || '#E2B203' }}>
              <PriorityIcon priority={task.priority} size={10} />
              {task.priority}
            </span>

            {/* Due date */}
            {task.dueDate && (
              <span className={`flex items-center gap-1 text-[10px] font-medium ${isOverdue(task) ? 'text-red-600' : 'text-gray-400'}`}>
                <Calendar size={9} />
                {fmtDate(task.dueDate)}
                {isOverdue(task) && ' · Overdue'}
              </span>
            )}

            {/* From/To */}
            {isIncoming && (
              <span className="text-[10px] text-gray-400">
                From: <span className="font-medium text-gray-600">{task.assigner}</span>
              </span>
            )}
            {isGiven && (
              <span className="text-[10px] text-gray-400">
                To: <span className="font-medium text-gray-600">{task.assignee}</span>
              </span>
            )}
          </div>
        </div>

        {/* Status badge */}
        <div className="flex-shrink-0">
          <StatusBadge status={task.status} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {isDeleted ? (
            <>
              <button onClick={e => { e.stopPropagation(); onRestore(task.id); }}
                className="p-1.5 rounded text-green-600 hover:bg-green-50 transition-colors"
                title="Restore">
                <RotateCcw size={13} />
              </button>
              <button onClick={e => { e.stopPropagation(); onPermanentDelete(task.id); }}
                className="p-1.5 rounded text-red-500 hover:bg-red-50 transition-colors"
                title="Delete forever">
                <Trash2 size={13} />
              </button>
            </>
          ) : isIncoming && !isCompleted ? (
            <>
              {task.transferRequest?.status !== 'pending' && (
                <button onClick={e => { e.stopPropagation(); onTransferRequest(task); }}
                  title="Request transfer"
                  className="p-1.5 rounded text-purple-500 hover:bg-purple-50 transition-colors">
                  <RotateCcw size={13} />
                </button>
              )}
            </>
          ) : (
            <button onClick={e => { e.stopPropagation(); onDelete(task.id); }}
              className="p-1.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Delete">
              <Trash2 size={13} />
            </button>
          )}
        </div>

        {/* Assignee avatar */}
        {task.assignee && task.assignee !== 'Self' && (
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
            style={{ background: avatarColor(task.assignee) }}
            title={task.assignee}>
            {initials(task.assignee)}
          </div>
        )}
      </div>

      {/* Transfer request banner (for given tasks) */}
      {isGiven && task.transferRequest?.status === 'pending' && (
        <div className="px-5 pb-2">
          <TransferBanner
            task={task}
            onApprove={() => onTransferApprove(task.id)}
            onReject={() => onTransferReject(task.id)}
          />
        </div>
      )}
    </div>
  );
}

// ─── Board Card ───────────────────────────────────────────────────────────────

function BoardCard({ task, view, onEdit, onDelete, onRestore }) {
  const overdue = isOverdue(task);
  const pMeta = PRIORITY_META[task.priority] || PRIORITY_META.Medium;

  return (
    <div
      onClick={() => onEdit(task)}
      className="group rounded-sm cursor-pointer mb-2 relative"
      style={{ background: '#1a1a1a', boxShadow: CARD_SHADOW, borderLeft: `3px solid ${pMeta.color}` }}
      onMouseEnter={e => e.currentTarget.style.background = '#222'}
      onMouseLeave={e => e.currentTarget.style.background = '#1a1a1a'}>
      <div className="px-3 pt-2 pb-2.5">
        <div className="flex items-start gap-2">
          <div className="w-3.5 h-3.5 rounded-sm flex items-center justify-center mt-0.5 flex-shrink-0"
            style={{ background: STATUS_META[task.status]?.color || '#42526E' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-white opacity-90" />
          </div>
          <p className={`text-sm leading-snug flex-1`} style={{ color: task.status === 'Completed' ? 'rgba(228,228,228,0.3)' : TEXT_PRIMARY, textDecoration: task.status === 'Completed' ? 'line-through' : 'none' }}>
            {task.title}
          </p>
          <button onClick={e => { e.stopPropagation(); onDelete(task.id); }}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-300 hover:text-red-500 transition-all flex-shrink-0">
            <X size={11} />
          </button>
        </div>

        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: 'rgba(228,228,228,0.35)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', padding: '1px 5px' }}>
            <Hash size={8} /> {task.project || 'General'}
          </span>
          <PriorityIcon priority={task.priority} size={12} />
          {task.dueDate && (
            <span className={`flex items-center gap-0.5 text-[10px] ${overdue ? 'text-red-600' : 'text-gray-400'}`}>
              <Calendar size={9} />
              {fmtDate(task.dueDate).slice(0, 6)}
            </span>
          )}
          <div className="flex-1" />
          {task.assignee && task.assignee !== 'Self' && (
            <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
              style={{ background: avatarColor(task.assignee) }}>
              {initials(task.assignee)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Board Column ─────────────────────────────────────────────────────────────

function BoardColumn({ col, tasks, view, onEdit, onDelete }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, background: BOARD_BG }}>
      <div className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0"
        style={{ borderTop: `3px solid ${col.topColor}` }}>
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: col.color }}>
          {col.label}
        </span>
        <span className="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: col.headerBg, color: col.color }}>
          {tasks.length}
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2"
        style={{ scrollbarWidth: 'thin' }}>
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center h-16 opacity-40">
            <p className="text-xs text-gray-400">No issues</p>
          </div>
        ) : (
          tasks.map(t => (
            <BoardCard key={t.id} task={t} view={view} onEdit={onEdit} onDelete={() => { }} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Stats Strip ──────────────────────────────────────────────────────────────

function StatsStrip({ tasks, currentUserId }) {
  const active = tasks.filter(t => !t.deleted && t.status !== 'Completed');
  const overdue = active.filter(t => isOverdue(t));
  const mine = active.filter(t => String(t.assigneeId) === String(currentUserId) || String(t.assignerId) === String(currentUserId));
  const completed = tasks.filter(t => t.status === 'Completed').length;

  const stats = [
    { label: 'Active', value: active.length, color: JIRA_BLUE },
    { label: 'Overdue', value: overdue.length, color: '#FF5630' },
    { label: 'Mine', value: mine.length, color: '#6554C0' },
    { label: 'Completed', value: completed, color: '#00875A' },
  ];

  return (
    <div className="flex gap-3 px-5 pb-3 flex-shrink-0">
      {stats.map(s => (
        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER_COLOR}`, borderRadius: '2px', padding: '6px 10px' }}>
          <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
          <span style={{ fontSize: '11px', color: TEXT_MUTED, fontWeight: 500 }}>{s.label}</span>
          <span className="text-sm font-bold" style={{ color: s.color }}>{s.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Create / Edit Task Modal (wrapper) ───────────────────────────────────────

function CreateTaskModal({ initialData, channels, members, onClose, onSubmit, onUpdate }) {
  return (
    <TaskModal
      onClose={onClose}
      onAddTask={onSubmit}
      onUpdateTask={onUpdate}
      initialData={initialData}
      channels={channels}
      teamMembers={members}
    />
  );
}

// ─── Main MyTasks ─────────────────────────────────────────────────────────────

export default function MyTasks() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeView = new URLSearchParams(location.search).get('tab') || 'my-tasks';

  const { tasks, loading, createTask, updateTask, deleteTask, restoreTask, permanentlyDeleteTask, handleTransferResponse } = useTasks();
  const { user } = useAuth();
  const { members, channels } = useContacts();
  // Extract workspaceId from URL for workload/sprint endpoints
  const pathMatch = window.location.pathname.match(/\/workspace\/([^/]+)/);
  const workspaceId = pathMatch ? pathMatch[1] : null;

  const isMobile = useIsMobile();

  const [viewMode, setViewMode] = useState('list'); // list | board | sprint | timeline | workload
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('priority');
  const [channelFilter, setChannelFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  // Mobile nav: false = show sidebar nav, true = show task list
  const [mobileShowList, setMobileShowList] = useState(false);
  // Right-side detail panel (replaces click-to-edit modal)
  const [selectedTask, setSelectedTask] = useState(null);
  const [completionTask, setCompletionTask] = useState(null);
  const [deletionTask, setDeletionTask] = useState(null);
  const [transferTask, setTransferTask] = useState(null);

  const currentUserId = user?._id || user?.id;


  // Filter logic by view — declared BEFORE channelCounts so it can be used as dependency
  const viewFiltered = useMemo(() => {
    const isAssignee = (t) => {
      if (t.assignees?.length > 0) return t.assignees.some(a => String(a._id || a.id) === String(currentUserId));
      return String(t.assigneeId) === String(currentUserId);
    };

    const active = tasks.filter(t => !t.deleted);

    switch (activeView) {
      case 'my-tasks':
        return active.filter(t => isAssignee(t) && String(t.assignerId) === String(currentUserId) && t.status !== 'Completed');
      case 'shared-tasks':
        return active.filter(t => isAssignee(t) && String(t.assignerId) !== String(currentUserId) && t.status !== 'Completed');
      case 'assigned-tasks':
        return active.filter(t => String(t.assignerId) === String(currentUserId) && !isAssignee(t) && t.status !== 'Completed');
      case 'all-tasks':
        return active.filter(t => t.status !== 'Completed');
      case 'completed-tasks':
        return active.filter(t => t.status === 'Completed');
      case 'deleted-tasks':
        return tasks.filter(t => t.deleted);
      default:
        return active;
    }
  }, [tasks, activeView, currentUserId]);

  // channelCounts: channels that have tasks in the current view, sorted by count
  const channelCounts = useMemo(() => {
    const counts = {};
    viewFiltered.forEach(t => {
      const ch = t.project || 'General';
      counts[ch] = (counts[ch] || 0) + 1;
    });
    return counts;
  }, [viewFiltered]);

  // channelNames: only channels that appear in this view, sorted by task count desc
  const channelNames = useMemo(() => {
    return Object.keys(channelCounts).sort((a, b) => channelCounts[b] - channelCounts[a]);
  }, [channelCounts]);

  // Second-pass filters: search + channel + priority + sort
  const filtered = useMemo(() => {
    let list = [...viewFiltered];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
      );
    }

    if (channelFilter !== 'all') {
      list = list.filter(t => (t.project || 'General') === channelFilter);
    }

    if (priorityFilter !== 'all') {
      list = list.filter(t => t.priority === priorityFilter);
    }

    return list.sort((a, b) => {
      if (sortOrder === 'priority') return (PRIORITY_ORDER[b.priority] || 0) - (PRIORITY_ORDER[a.priority] || 0);
      if (sortOrder === 'dueDate') return new Date(a.dueDate || '2099') - new Date(b.dueDate || '2099');
      if (sortOrder === 'status') return (a.status || '').localeCompare(b.status || '');
      if (sortOrder === 'a-z') return (a.title || '').localeCompare(b.title || '');
      if (sortOrder === 'newest') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      return 0;
    });
  }, [viewFiltered, search, channelFilter, priorityFilter, sortOrder]);

  // Board grouped by status
  const boardGroups = useMemo(() =>
    Object.fromEntries(BOARD_COLUMNS.map(c => [c.key, filtered.filter(t => t.status === c.key)])),
    [filtered]
  );

  // --- Handlers ---
  // Clicking a task row opens the right-side detail panel
  const handleEdit = useCallback((task) => {
    setSelectedTask(task);
  }, []);

  // Panel save handler — updates task in context and refreshes selectedTask
  const handlePanelUpdate = useCallback(async (id, updates) => {
    const updated = await updateTask(id, updates);
    // Keep selectedTask in sync (updateTask returns updated task)
    setSelectedTask(prev => prev?.id === id ? { ...prev, ...updates } : prev);
  }, [updateTask]);

  // Panel delete handler
  const handlePanelDelete = useCallback((id) => {
    const task = tasks.find(t => t.id === id);
    setSelectedTask(null);
    setDeletionTask(task);
  }, [tasks]);

  const handleCreate = useCallback(async (data) => {
    await createTask(data);
    setShowModal(false);
    setEditingTask(null);
  }, [createTask]);

  const handleUpdate = useCallback(async (id, updates) => {
    await updateTask(id, updates);
    setShowModal(false);
    setEditingTask(null);
  }, [updateTask]);

  const handleDelete = useCallback((id) => {
    const task = tasks.find(t => t.id === id);
    setDeletionTask(task);
  }, [tasks]);

  const handleConfirmDelete = useCallback(() => {
    if (deletionTask) { deleteTask(deletionTask.id); setDeletionTask(null); }
  }, [deleteTask, deletionTask]);

  const handleRestore = useCallback((id) => restoreTask(id), [restoreTask]);

  const handlePermanentDelete = useCallback((id) => {
    if (window.confirm('Delete permanently? This cannot be undone.')) permanentlyDeleteTask(id);
  }, [permanentlyDeleteTask]);

  const handleTransferApprove = useCallback((id) => handleTransferResponse(id, 'approve'), [handleTransferResponse]);
  const handleTransferReject = useCallback((id) => handleTransferResponse(id, 'reject'), [handleTransferResponse]);

  const setView = (key) => {
    const params = new URLSearchParams(location.search);
    params.set('tab', key);
    navigate(`?${params.toString()}`, { replace: true });
    // On mobile, switch to list view after selecting a category
    if (isMobile) setMobileShowList(true);
  };

  const isDeleted = activeView === 'deleted-tasks';
  const isCompleted = activeView === 'completed-tasks';
  const canCreate = !isDeleted && !isCompleted;

  const viewLabel = {
    'my-tasks': 'My Issues',
    'shared-tasks': 'Incoming',
    'assigned-tasks': 'Given',
    'all-tasks': 'All Issues',
    'completed-tasks': 'Completed',
    'deleted-tasks': 'Trash',
  }[activeView] || 'Tasks';

  const viewDesc = {
    'my-tasks': 'Tasks you created and own.',
    'shared-tasks': 'Tasks assigned to you by others.',
    'assigned-tasks': 'Tasks you delegated to others.',
    'all-tasks': 'All workspace tasks visible to you.',
    'completed-tasks': 'Finished tasks.',
    'deleted-tasks': 'Trash — restore or delete permanently.',
  }[activeView] || '';

  // Keep selectedTask in sync when tasks array updates (e.g. after socket push)
  // Must be BEFORE any early returns to satisfy React hooks rules
  useEffect(() => {
    if (!selectedTask) return;
    const fresh = tasks.find(t => t.id === selectedTask.id);
    if (fresh) setSelectedTask(fresh);
  }, [tasks]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: BOARD_BG }}>
        <style>{`@keyframes mf-sh{0%,100%{opacity:.35}50%{opacity:.7}}.mf-sh{animation:mf-sh 1.6s ease-in-out infinite}`}</style>
        <div className="mf-sh" style={{ width: '200px', flexShrink: 0, background: SIDEBAR_BG, borderRight: `1px solid ${BORDER_COLOR}`, padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[100, 80, 90, 70, 85].map((w, i) => (
            <div key={i} style={{ height: '32px', background: 'rgba(255,255,255,0.05)', width: `${w}%` }} />
          ))}
        </div>
        <div className="mf-sh" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px', gap: '12px' }}>
          <div style={{ height: '20px', width: '180px', background: 'rgba(255,255,255,0.08)' }} />
          {[90, 75, 85, 65, 80].map((w, i) => (
            <div key={i} style={{ height: '48px', background: 'rgba(255,255,255,0.05)', width: `${w}%` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: BOARD_BG }}>

      {/* ── Left sidebar ── */}
      <div style={{
        width: isMobile ? '100%' : '200px',
        flexShrink: 0, background: SIDEBAR_BG,
        borderRight: isMobile ? 'none' : `1px solid ${BORDER_COLOR}`,
        display: (isMobile && mobileShowList) ? 'none' : 'flex',
        flexDirection: 'column', overflowY: 'auto'
      }}>
        <div className="px-3 py-4">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3 px-2" style={{ color: TEXT_MUTED }}>Tasks</p>
          <nav className="space-y-0.5">
            {SIDEBAR_VIEWS.map((v, i) =>
              v === null
                ? <div key={i} style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '6px 8px' }} />
                : (
                  <button key={v.key} onClick={() => setView(v.key)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', background: activeView === v.key ? 'rgba(184,149,106,0.12)' : 'transparent', border: activeView === v.key ? '1px solid rgba(184,149,106,0.2)' : '1px solid transparent', color: activeView === v.key ? JIRA_BLUE : 'rgba(228,228,228,0.5)', fontWeight: activeView === v.key ? 700 : 400, fontSize: '13px', fontFamily: 'Inter, system-ui, sans-serif', cursor: 'pointer', transition: 'all 150ms ease', textAlign: 'left' }}
                    onMouseEnter={e => { if (activeView !== v.key) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                    onMouseLeave={e => { if (activeView !== v.key) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ color: activeView === v.key ? JIRA_BLUE : 'rgba(228,228,228,0.35)', flexShrink: 0 }}>
                      {v.icon}
                    </span>
                    <span style={{ flex: 1 }}>{v.label}</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'monospace', color: activeView === v.key ? JIRA_BLUE : 'rgba(228,228,228,0.3)' }}>
                      {v.key === 'my-tasks' && tasks.filter(t => !t.deleted && String(t.assignerId) === String(currentUserId) && String(t.assigneeId) === String(currentUserId) && t.status !== 'Completed').length}
                      {v.key === 'shared-tasks' && tasks.filter(t => !t.deleted && String(t.assignerId) !== String(currentUserId) && t.assignees?.some(a => String(a._id) === String(currentUserId)) && t.status !== 'Completed').length}
                      {v.key === 'assigned-tasks' && tasks.filter(t => !t.deleted && String(t.assignerId) === String(currentUserId) && String(t.assigneeId) !== String(currentUserId) && t.status !== 'Completed').length}
                      {v.key === 'all-tasks' && tasks.filter(t => !t.deleted && t.status !== 'Completed').length}
                      {v.key === 'completed-tasks' && tasks.filter(t => t.status === 'Completed').length}
                      {v.key === 'deleted-tasks' && tasks.filter(t => t.deleted).length || undefined}
                    </span>
                  </button>
                )
            )}
          </nav>

          {/* Channel filter in sidebar — only channels with tasks in current view */}
          {channelNames.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2 px-2" style={{ color: TEXT_MUTED }}>By Channel</p>
              <div className="space-y-0.5">
                {/* All Channels reset button */}
                <button onClick={() => setChannelFilter('all')}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 10px', background: channelFilter === 'all' ? 'rgba(184,149,106,0.12)' : 'transparent', border: channelFilter === 'all' ? '1px solid rgba(184,149,106,0.2)' : '1px solid transparent', color: channelFilter === 'all' ? JIRA_BLUE : 'rgba(228,228,228,0.5)', fontSize: '12px', fontFamily: 'Inter, system-ui, sans-serif', cursor: 'pointer', transition: 'all 150ms ease', textAlign: 'left' }}
                  onMouseEnter={e => { if (channelFilter !== 'all') e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={e => { if (channelFilter !== 'all') e.currentTarget.style.background = 'transparent'; }}
                >
                  <Hash size={10} style={{ color: channelFilter === 'all' ? JIRA_BLUE : 'rgba(228,228,228,0.3)', flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>All Channels</span>
                  <span style={{ fontSize: '10px', fontWeight: 700, fontFamily: 'monospace', color: channelFilter === 'all' ? JIRA_BLUE : 'rgba(228,228,228,0.3)' }}>{viewFiltered.length}</span>
                </button>
                {channelNames.map(ch => (
                  <button key={ch} onClick={() => setChannelFilter(ch)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 10px', background: channelFilter === ch ? 'rgba(184,149,106,0.12)' : 'transparent', border: channelFilter === ch ? '1px solid rgba(184,149,106,0.2)' : '1px solid transparent', color: channelFilter === ch ? JIRA_BLUE : 'rgba(228,228,228,0.5)', fontSize: '12px', fontFamily: 'Inter, system-ui, sans-serif', cursor: 'pointer', transition: 'all 150ms ease', textAlign: 'left' }}
                    onMouseEnter={e => { if (channelFilter !== ch) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                    onMouseLeave={e => { if (channelFilter !== ch) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <Hash size={10} style={{ color: channelFilter === ch ? JIRA_BLUE : 'rgba(228,228,228,0.3)', flexShrink: 0 }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch}</span>
                    <span style={{ fontSize: '10px', fontWeight: 700, fontFamily: 'monospace', color: channelFilter === ch ? JIRA_BLUE : 'rgba(228,228,228,0.3)' }}>{channelCounts[ch] || 0}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Main content + optional right panel ── */}
      <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden"
        style={{ display: (isMobile && !mobileShowList) ? 'none' : 'flex' }}
      >
        <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">

          {/* ── Toolbar ── */}
          <div style={{ flexShrink: 0, background: TOOLBAR_BG, borderBottom: `1px solid ${BORDER_COLOR}`, padding: isMobile ? '0' : '10px 20px' }}>
            {isMobile ? (
              /* ── Mobile toolbar: 2 compact rows ── */
              <>
                {/* Row 1: back + title + create */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderBottom: `1px solid ${BORDER_COLOR}` }}>
                  {mobileShowList && (
                    <button
                      onClick={() => setMobileShowList(false)}
                      style={{ display: 'flex', alignItems: 'center', padding: '4px', color: JIRA_BLUE, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, WebkitTapHighlightColor: 'transparent' }}
                    >
                      <ChevronLeft size={18} />
                    </button>
                  )}
                  <span style={{ fontSize: '14px', fontWeight: 700, color: TEXT_PRIMARY, fontFamily: 'Inter, system-ui, sans-serif', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {viewLabel}
                  </span>
                  {canCreate && (
                    <button
                      onClick={() => { setEditingTask(null); setShowModal(true); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', background: JIRA_BLUE, border: 'none', color: '#0c0c0c', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', flexShrink: 0, WebkitTapHighlightColor: 'transparent' }}
                    >
                      <Plus size={12} strokeWidth={2.5} /> New
                    </button>
                  )}
                </div>
                {/* Row 2: search + sort compact */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={12} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(228,228,228,0.35)' }} />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search issues…"
                      style={{ width: '100%', paddingLeft: '26px', paddingRight: '8px', paddingTop: '6px', paddingBottom: '6px', background: '#1a1a1a', border: `1px solid ${BORDER_COLOR}`, color: TEXT_PRIMARY, fontSize: '12px', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box' }}
                      onFocus={e => e.target.style.borderColor = JIRA_BLUE}
                      onBlur={e => e.target.style.borderColor = BORDER_COLOR}
                    />
                  </div>
                  <select value={sortOrder} onChange={e => setSortOrder(e.target.value)}
                    style={{ background: '#1a1a1a', border: `1px solid ${BORDER_COLOR}`, color: TEXT_MUTED, fontSize: '11px', padding: '6px 4px', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', flexShrink: 0, maxWidth: '80px' }}>
                    {SORT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                  <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
                    style={{ background: '#1a1a1a', border: `1px solid ${BORDER_COLOR}`, color: TEXT_MUTED, fontSize: '11px', padding: '6px 4px', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', flexShrink: 0, maxWidth: '90px' }}>
                    <option value="all">All Priority</option>
                    {['Highest', 'High', 'Medium', 'Low', 'Lowest'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </>
            ) : (
              /* ── Desktop toolbar: original single row ── */
              <div className="flex items-center gap-3">
                <div>
                  <h1 className="text-base font-bold" style={{ color: TEXT_PRIMARY }}>{viewLabel}</h1>
                  <p className="text-xs" style={{ color: TEXT_MUTED }}>{viewDesc}</p>
                </div>

                <div className="flex-1" />

                {/* Search */}
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search issues…"
                    style={{ background: '#1a1a1a', border: `1px solid ${BORDER_COLOR}`, color: TEXT_PRIMARY, fontSize: '12px', padding: '5px 8px 5px 28px', outline: 'none', width: '160px', fontFamily: 'Inter, system-ui, sans-serif' }}
                    onFocus={e => e.target.style.borderColor = JIRA_BLUE}
                    onBlur={e => e.target.style.borderColor = BORDER_COLOR}
                  />
                </div>

                {/* Sort */}
                <select value={sortOrder} onChange={e => setSortOrder(e.target.value)}
                  style={{ background: '#1a1a1a', border: `1px solid ${BORDER_COLOR}`, color: TEXT_MUTED, fontSize: '12px', padding: '5px 8px', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif' }}>
                  {SORT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>

                {/* Priority filter */}
                <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
                  style={{ background: '#1a1a1a', border: `1px solid ${BORDER_COLOR}`, color: TEXT_MUTED, fontSize: '12px', padding: '5px 8px', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif' }}>
                  <option value="all">All Priorities</option>
                  {['Highest', 'High', 'Medium', 'Low', 'Lowest', 'Emergency'].map(p =>
                    <option key={p} value={p}>{p}</option>
                  )}
                </select>

                {/* View toggle */}
                <div style={{ display: 'flex', overflow: 'hidden', border: `1px solid ${BORDER_COLOR}` }}>
                  {[
                    { key: 'list',      Icon: List,         title: 'List view' },
                    { key: 'board',     Icon: LayoutGrid,   title: 'Kanban board' },
                    { key: 'sprint',    Icon: Activity,     title: 'Sprint board' },
                    { key: 'timeline',  Icon: GitBranch,    title: 'Timeline' },
                    { key: 'workload',  Icon: Users,        title: 'Workload' },
                  ].map(({ key, Icon, title }, idx) => (
                    <button
                      key={key}
                      onClick={() => setViewMode(key)}
                      title={title}
                      style={{ padding: '5px 8px', display: 'flex', alignItems: 'center', background: viewMode === key ? 'rgba(184,149,106,0.15)' : 'transparent', color: viewMode === key ? JIRA_BLUE : TEXT_MUTED, borderLeft: idx > 0 ? `1px solid ${BORDER_COLOR}` : 'none', cursor: 'pointer', border: 'none' }}
                    >
                      <Icon size={14} />
                    </button>
                  ))}
                </div>

                {canCreate && (
                  <button onClick={() => { setEditingTask(null); setShowModal(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-sm transition-opacity hover:opacity-90"
                    style={{ background: JIRA_BLUE }}>
                    <Plus size={13} strokeWidth={2.5} /> Create
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Stats strip ── */}
          {activeView === 'all-tasks' && (
            <div style={{ flexShrink: 0, background: TOOLBAR_BG, borderBottom: `1px solid ${BORDER_COLOR}`, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              {[
                { label: 'Active',    count: tasks.filter(t => !t.deleted && t.status !== 'Completed').length, color: JIRA_BLUE },
                { label: 'Overdue',   count: tasks.filter(t => isOverdue(t)).length,                          color: '#f87171' },
                { label: 'Completed', count: tasks.filter(t => t.status === 'Completed').length,              color: '#34d399' },
                { label: 'In Review', count: tasks.filter(t => t.status === 'In Review').length,              color: '#a78bfa' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.color }} />
                  <span style={{ color: TEXT_MUTED }}>{s.label}</span>
                  <span style={{ fontWeight: 700, color: s.color }}>{s.count}</span>
                </div>
              ))}
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: '11px', color: TEXT_MUTED }}>{filtered.length} showing</span>
            </div>
          )}

          {/* ── Content area ── */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {filtered.length === 0 && viewMode !== 'workload' ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', background: BOARD_BG }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER_COLOR}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isDeleted ? <Trash2 size={22} style={{ color: TEXT_MUTED }} /> : <CheckCircle2 size={22} style={{ color: TEXT_MUTED }} />}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontWeight: 600, fontSize: '13px', color: TEXT_MUTED }}>
                    {isDeleted ? 'Trash is empty' : search ? 'No matching issues' : 'No issues here'}
                  </p>
                  <p style={{ fontSize: '11px', color: 'rgba(228,228,228,0.25)', marginTop: '4px' }}>
                    {isDeleted ? 'Deleted items will appear here.' : canCreate ? 'Click Create to add your first issue.' : ''}
                  </p>
                </div>
              </div>
            ) : viewMode === 'board' ? (
              /* Kanban board view */
              <KanbanBoard
                tasks={filtered}
                onTaskClick={handleEdit}
                onTasksUpdate={() => {}}
              />
            ) : viewMode === 'sprint' ? (
              /* Sprint board view */
              <SprintBoard
                tasks={filtered}
                workspaceId={workspaceId}
                onTaskClick={handleEdit}
              />
            ) : viewMode === 'timeline' ? (
              /* Timeline / Gantt view */
              <TimelineView
                tasks={filtered}
                onTaskClick={handleEdit}
              />
            ) : viewMode === 'workload' ? (
              /* Workload panel */
              <WorkloadPanel workspaceId={workspaceId} />
            ) : (
              /* List view (default) */
              <div className="h-full overflow-y-auto" style={{ background: BOARD_BG, scrollbarWidth: 'thin' }}>
                {/* Table header */}
                <div style={{ position: 'sticky', top: 0, display: 'flex', alignItems: 'center', gap: '16px', padding: '8px 20px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', background: '#0a0a0a', borderBottom: `1px solid ${BORDER_COLOR}`, color: TEXT_MUTED, fontFamily: 'monospace', zIndex: 10 }}>
                  <span style={{ width: '16px', flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>Summary</span>
                  <span style={{ width: '112px', textAlign: 'center' }}>Channel</span>
                  <span style={{ width: '80px', textAlign: 'center' }}>Priority</span>
                  <span style={{ width: '96px', textAlign: 'center' }}>Due Date</span>
                  <span style={{ width: '96px', textAlign: 'center' }}>Status</span>
                  <span style={{ width: '48px' }} />
                </div>

                <div>
                  {filtered.map(task => (
                    <ListRow
                      key={task.id}
                      task={task}
                      view={activeView}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onRestore={handleRestore}
                      onPermanentDelete={handlePermanentDelete}
                      onTransferRequest={setTransferTask}
                      onTransferApprove={handleTransferApprove}
                      onTransferReject={handleTransferReject}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right task detail panel ── */}
        {selectedTask && (
          <WorkspaceTaskDetailPanel
            task={selectedTask}
            members={members || []}
            onClose={() => setSelectedTask(null)}
            onUpdate={handlePanelUpdate}
            onDelete={handlePanelDelete}
          />
        )}

      </div>{/* end main content + right panel wrapper */}

      {/* ── Modals ── */}
      {showModal && (
        <CreateTaskModal
          initialData={editingTask}
          channels={channels || []}
          members={members || []}
          onClose={() => { setShowModal(false); setEditingTask(null); }}
          onSubmit={handleCreate}
          onUpdate={(id, updates) => handleUpdate(id, updates)}
        />
      )}

      {completionTask && (
        <TaskCompletionModal
          task={completionTask}
          onClose={() => setCompletionTask(null)}
          onConfirm={(note) => { updateTask(completionTask.id, { status: 'Completed', completionNote: note, completedAt: new Date().toISOString() }); setCompletionTask(null); }}
          mode="completion"
        />
      )}

      {deletionTask && (
        <TaskCompletionModal
          task={deletionTask}
          onClose={() => setDeletionTask(null)}
          onConfirm={handleConfirmDelete}
          mode="deletion"
        />
      )}

      {transferTask && (
        <TransferRequestModal
          task={transferTask}
          members={members || []}
          onClose={() => setTransferTask(null)}
          onConfirm={async (newAssigneeId, note) => {
            try {
              await api.post(`/api/v2/tasks/${transferTask.id}/transfer-request`, { newAssigneeId, note });
              setTransferTask(null);
            } catch (e) { console.error(e); }
          }}
        />
      )}
    </div>
  );
}
