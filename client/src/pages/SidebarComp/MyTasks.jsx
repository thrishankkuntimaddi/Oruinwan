import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Plus, Search, CheckCircle2, Circle, Trash2, RotateCcw, Activity, LayoutGrid, List,
  ChevronLeft, Inbox, Send, Eye, Hash, GitBranch, Users, Bell, X,
} from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useIsMobile } from '../../hooks/useIsMobile';
import TaskModal from '../../components/tasksComp/TaskModal';
import WorkspaceTaskDetailPanel from '../../components/tasksComp/WorkspaceTaskDetailPanel';
import TransferRequestModal from '../../components/tasksComp/TransferRequestModal';
import TaskCompletionModal from '../../components/tasksComp/TaskCompletionModal';
import KanbanBoard from '../../components/tasksComp/KanbanBoard';
import SprintBoard from '../../components/tasksComp/SprintBoard';
import TimelineView from '../../components/tasksComp/TimelineView';
import WorkloadPanel from '../../components/tasksComp/WorkloadPanel';
import {
  StatusBadge, PriorityTag, IssueTypeIcon, AvatarStack, fmtDate, isOverdue, tint, FONT,
} from '../../components/tasksComp/taskUi';
import { useTasks } from '../../contexts/TasksContext';
import { useAuth } from '../../contexts/AuthContext';
import { useContacts } from '../../contexts/ContactsContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useToast } from '../../contexts/ToastContext';
import { PRIORITIES, PRIORITY_META, priorityLabel, statusLabel, canTransition, isClosed, STATUSES } from '../../utils/taskMeta';
import { taskAbilities, isCreator, isAssignee, deleteOnlyHides } from '../../utils/taskPermissions';

/* ── Views: one filter per sidebar entry, used for both the list and its count ── */
const VIEWS = [
  { key: 'my-tasks', label: 'My Issues', desc: 'Tasks you created for yourself.', Icon: Circle, scope: (t, me) => isCreator(t, me) && isAssignee(t, me) },
  { key: 'shared-tasks', label: 'Incoming', desc: 'Tasks assigned to you by others.', Icon: Inbox, scope: (t, me) => isAssignee(t, me) && !isCreator(t, me) },
  { key: 'assigned-tasks', label: 'Given', desc: 'Tasks you created for other people.', Icon: Send, scope: (t, me) => isCreator(t, me) && !isAssignee(t, me) },
  { key: 'all-tasks', label: 'All Issues', desc: 'Every workspace task you can see.', Icon: Eye, scope: () => true },
  null,
  { key: 'completed-tasks', label: 'Completed', desc: 'Done and cancelled tasks.', Icon: CheckCircle2, scope: () => true, closed: true },
  { key: 'deleted-tasks', label: 'Trash', desc: 'Restore tasks or delete them for good.', Icon: Trash2, trash: true },
];
const VIEW_BY_KEY = Object.fromEntries(VIEWS.filter(Boolean).map((v) => [v.key, v]));

/**
 * Tasks of one view. `withClosed` keeps done tasks (board/sprint need the Done
 * column); lists and sidebar counts use the same function without it.
 */
function tasksForView(tasks, viewKey, me, { withClosed = false } = {}) {
  const view = VIEW_BY_KEY[viewKey] || VIEW_BY_KEY['my-tasks'];
  if (view.trash) return tasks.filter((t) => t.deleted);
  const inScope = tasks.filter((t) => !t.deleted && !t.isSubtask && view.scope(t, me));
  if (view.closed) return inScope.filter((t) => isClosed(t.status));
  return withClosed ? inScope.filter((t) => t.status !== 'cancelled') : inScope.filter((t) => !isClosed(t.status));
}

const SORT_OPTIONS = [
  { id: 'priority', label: 'Priority' },
  { id: 'dueDate', label: 'Due date' },
  { id: 'status', label: 'Status' },
  { id: 'a-z', label: 'A–Z' },
  { id: 'newest', label: 'Newest' },
];
const PRIORITY_RANK = Object.fromEntries(PRIORITIES.map((p, i) => [p, PRIORITIES.length - i]));
const STATUS_RANK = Object.fromEntries(STATUSES.map((s, i) => [s, i]));

const VIEW_MODES = [
  { key: 'list', Icon: List, label: 'List' },
  { key: 'board', Icon: LayoutGrid, label: 'Board' },
  { key: 'sprint', Icon: Activity, label: 'Sprint' },
  { key: 'timeline', Icon: GitBranch, label: 'Timeline' },
  { key: 'workload', Icon: Users, label: 'Workload' },
];

const channelKey = (t) => t.channel?.id || 'none';

function ListRow({ task, view, selected, can, onOpen, onDelete, onRestore, onPurge, onTransferRequest, onTransferRespond }) {
  const done = task.status === 'done';
  const overdue = isOverdue(task);
  const pendingTransfer = task.transferRequest?.status === 'pending';
  return (
    <div className={`tasks-row tasks-row-body${selected ? ' is-selected' : ''}`} role="button" tabIndex={0}
      aria-label={task.title}
      onClick={() => onOpen(task)}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(task); }}>
      <span aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '2px', background: PRIORITY_META[task.priority]?.color }} />
      <span className="tk-col-type"><IssueTypeIcon type={task.issueType} /></span>

      <div style={{ minWidth: 0, padding: '8px 0' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', minWidth: 0 }}>
          {task.issueKey && <span style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0 }}>{task.issueKey}</span>}
          <span style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: done || task.deleted ? 'var(--text-secondary)' : 'var(--text-primary)', textDecoration: done ? 'line-through' : 'none' }}>
            {task.title}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px', fontSize: '11px', color: 'var(--text-secondary)', minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap' }}>
          {task.channel?.name && <span className="tk-meta-channel">#{task.channel.name}</span>}
          {view === 'shared-tasks' && task.creator && <span>From <b style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{task.creator.username}</b></span>}
          {view === 'assigned-tasks' && task.assignees.length > 0 && <span>To <b style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{task.assignees.map((a) => a.username).join(', ')}</b></span>}
          {task.subtasks?.length > 0 && <span>{task.subtasks.filter((s) => s.status === 'done').length}/{task.subtasks.length} subtasks</span>}
          {pendingTransfer && <span style={{ color: 'var(--accent)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Send size={10} /> Transfer pending</span>}
          {task.status === 'blocked' && task.blockedReason && <span style={{ color: 'var(--state-danger)', overflow: 'hidden', textOverflow: 'ellipsis' }}>Blocked: {task.blockedReason}</span>}
          {task.labels?.slice(0, 3).map((l) => <span key={l} style={{ padding: '0 5px', borderRadius: '2px', background: 'var(--accent-dim)', color: 'var(--text-primary)' }}>{l}</span>)}
        </div>
        {view === 'assigned-tasks' && pendingTransfer && can.handleTransfer && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', padding: '6px 8px', borderRadius: '2px', background: 'var(--accent-dim)', border: `1px solid ${tint('var(--accent)', 30)}`, fontSize: '11px', color: 'var(--text-primary)' }}
            onClick={(e) => e.stopPropagation()}>
            <Bell size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Transfer to <b>{task.transferRequest.requestedTo?.username || 'another member'}</b>{task.transferRequest.note ? ` — “${task.transferRequest.note}”` : ''}
            </span>
            <button type="button" className="tk-btn tk-btn-primary" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => onTransferRespond(task.id, 'approve')}>Approve</button>
            <button type="button" className="tk-btn" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => onTransferRespond(task.id, 'reject')}>Reject</button>
          </div>
        )}
      </div>

      <span className="tk-col-channel" style={{ fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {task.channel?.name ? `#${task.channel.name}` : '—'}
      </span>
      <span className="tk-col-priority"><PriorityTag priority={task.priority} /></span>
      <span className="tk-col-due" style={{ fontSize: '12px', whiteSpace: 'nowrap', color: overdue ? 'var(--state-danger)' : 'var(--text-secondary)', fontWeight: overdue ? 700 : 400 }}>
        {task.dueDate ? fmtDate(task.dueDate) : '—'}
      </span>
      <span className="tk-col-status" style={{ minWidth: 0 }}><StatusBadge status={task.status} /></span>
      <span className="tk-col-assignee"><AvatarStack users={task.assignees} size={20} max={3} /></span>

      <span className="tk-col-actions tk-row-actions" onClick={(e) => e.stopPropagation()}>
        {task.deleted ? (
          <>
            {can.restore && <button type="button" className="tk-icon-btn" title="Restore" aria-label="Restore" onClick={() => onRestore(task.id)}><RotateCcw size={13} /></button>}
            {can.purge && <button type="button" className="tk-icon-btn danger" title="Delete forever" aria-label="Delete forever" onClick={() => onPurge(task)}><Trash2 size={13} /></button>}
          </>
        ) : (
          <>
            {can.transfer && <button type="button" className="tk-icon-btn" title="Request transfer" aria-label="Request transfer" onClick={() => onTransferRequest(task)}><Send size={13} /></button>}
            {can.del && <button type="button" className="tk-icon-btn danger" title={can.edit ? 'Move to trash' : 'Remove from my list'} aria-label="Delete" onClick={() => onDelete(task)}><Trash2 size={13} /></button>}
          </>
        )}
      </span>
    </div>
  );
}

export default function MyTasks() {
  const location = useLocation();
  const navigate = useNavigate();
  const requestedView = new URLSearchParams(location.search).get('tab');
  const activeView = VIEW_BY_KEY[requestedView] ? requestedView : 'my-tasks';

  const {
    tasks, loading, refreshing, workspaceId, createTask, updateTask, patchTaskLocal, deleteTask, restoreTask,
    permanentlyDeleteTask, handleTransferResponse, requestTransfer, fetchTask,
  } = useTasks();
  const { user } = useAuth();
  const { members, channels } = useContacts();
  const { activeWorkspace } = useWorkspace();
  const { showToast } = useToast();
  const isMobile = useIsMobile();

  const currentUserId = user?._id || user?.id;
  const permCtx = useMemo(() => ({ userId: currentUserId, role: activeWorkspace?.role }), [currentUserId, activeWorkspace?.role]);
  const abilitiesOf = useCallback((t) => taskAbilities(t, permCtx), [permCtx]);

  const [viewMode, setViewMode] = useState('list');
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('priority');
  const [channelFilter, setChannelFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [mobileShowList, setMobileShowList] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [confirm, setConfirm] = useState(null); // { mode, task, to? }
  const [transferTask, setTransferTask] = useState(null);

  useEffect(() => { setChannelFilter('all'); }, [activeView]);

  // /workspace/:ws/tasks/:taskId (notification links) opens that task's detail panel.
  const { taskId: routeTaskId } = useParams();
  useEffect(() => {
    if (!routeTaskId) return undefined;
    let cancelled = false;
    fetchTask(routeTaskId).then((t) => {
      if (cancelled) return;
      if (t?.id) setSelectedId(t.id);
      else showToast('That task is no longer available', 'error');
    });
    return () => { cancelled = true; };
  }, [routeTaskId, fetchTask, showToast]);

  const selectedTask = selectedId ? tasks.find((t) => t.id === selectedId) || null : null;

  const counts = useMemo(() => Object.fromEntries(
    VIEWS.filter(Boolean).map((v) => [v.key, tasksForView(tasks, v.key, currentUserId).length]),
  ), [tasks, currentUserId]);

  const applyFilters = useCallback((list, { skipChannel = false } = {}) => {
    let out = list;
    const q = search.trim().toLowerCase();
    if (q) out = out.filter((t) => t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q) || (t.issueKey || '').toLowerCase().includes(q));
    if (!skipChannel && channelFilter !== 'all') out = out.filter((t) => channelKey(t) === channelFilter);
    if (priorityFilter !== 'all') out = out.filter((t) => t.priority === priorityFilter);
    return [...out].sort((a, b) => {
      if (sortOrder === 'priority') return (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0);
      if (sortOrder === 'dueDate') return new Date(a.dueDate || '2999-01-01') - new Date(b.dueDate || '2999-01-01');
      if (sortOrder === 'status') return (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99);
      if (sortOrder === 'a-z') return a.title.localeCompare(b.title);
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }, [search, channelFilter, priorityFilter, sortOrder]);

  const boardMode = viewMode === 'board' || viewMode === 'sprint';
  const viewTasks = useMemo(() => tasksForView(tasks, activeView, currentUserId, { withClosed: boardMode }), [tasks, activeView, currentUserId, boardMode]);
  const shown = useMemo(() => applyFilters(viewTasks), [applyFilters, viewTasks]);

  // Channel sidebar counts follow the other filters (search/priority) but not the channel itself.
  const channelGroups = useMemo(() => {
    const groups = new Map();
    for (const t of applyFilters(viewTasks, { skipChannel: true })) {
      const key = channelKey(t);
      const g = groups.get(key) || { key, name: t.channel?.name || 'No channel', count: 0 };
      g.count += 1;
      groups.set(key, g);
    }
    return [...groups.values()].sort((a, b) => b.count - a.count);
  }, [applyFilters, viewTasks]);
  const channelTotal = channelGroups.reduce((n, g) => n + g.count, 0);

  /* ── Actions ── */
  const openTask = useCallback((t) => setSelectedId(t.id), []);

  const changeStatus = useCallback((task, to) => {
    if (!task || task.status === to) return;
    if (!abilitiesOf(task).status) {
      showToast('Only the creator, assignees or workspace admins can change this task’s status', 'error');
      return;
    }
    if (!canTransition(task.status, to)) {
      showToast(`A ${statusLabel(task.status).toLowerCase()} task can’t move to ${statusLabel(to)}`, 'error');
      return;
    }
    if (to === 'blocked') setConfirm({ mode: 'blocked', task, to });
    else if (to === 'done') setConfirm({ mode: 'completion', task, to });
    else updateTask(task.id, { status: to });
  }, [abilitiesOf, showToast, updateTask]);

  const askDelete = useCallback((task) => {
    setConfirm({ mode: deleteOnlyHides(task, permCtx) ? 'hide' : 'deletion', task });
  }, [permCtx]);

  const runConfirm = async (text) => {
    const { mode, task } = confirm;
    if (mode === 'blocked') {
      if (await updateTask(task.id, { status: 'blocked', blockedReason: text })) setConfirm(null);
      return;
    }
    if (mode === 'completion') {
      const ok = await updateTask(task.id, text ? { status: 'done', completionNote: text } : { status: 'done' });
      if (ok) setConfirm(null);
      return;
    }
    if (mode === 'deletion' || mode === 'hide') {
      const ok = await deleteTask(task.id, { hideOnly: mode === 'hide' });
      if (ok) { setConfirm(null); if (mode === 'hide' && selectedId === task.id) setSelectedId(null); }
      return;
    }
    if (mode === 'purge') {
      const ok = await permanentlyDeleteTask(task.id);
      if (ok) { setConfirm(null); if (selectedId === task.id) setSelectedId(null); }
    }
  };

  const setView = (key) => {
    const params = new URLSearchParams(location.search);
    params.set('tab', key);
    navigate(`?${params.toString()}`, { replace: true });
    if (isMobile) setMobileShowList(true);
  };

  const view = VIEW_BY_KEY[activeView];
  const canCreate = !view.trash && !view.closed;

  /* ── First load only: skeleton. Later refreshes happen silently. ── */
  if (loading) {
    return (
      <div className="tasks-ui" style={{ display: 'flex', height: '100%', overflow: 'hidden', background: 'var(--bg-base)' }}>
        <div className="tk-shimmer" style={{ width: '208px', flexShrink: 0, background: 'var(--bg-surface)', borderRight: '1px solid var(--border-subtle)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[100, 80, 90, 70, 85].map((w, i) => <div key={i} style={{ height: '28px', background: 'var(--bg-hover)', width: `${w}%` }} />)}
        </div>
        <div className="tk-shimmer" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px', gap: '12px' }}>
          <div style={{ height: '20px', width: '180px', background: 'var(--bg-active)' }} />
          {[90, 75, 85, 65, 80].map((w, i) => <div key={i} style={{ height: '44px', background: 'var(--bg-hover)', width: `${w}%` }} />)}
        </div>
      </div>
    );
  }

  const navButton = (active) => ({
    width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', borderRadius: '2px',
    background: active ? 'var(--accent-dim)' : 'transparent', border: `1px solid ${active ? tint('var(--accent)', 30) : 'transparent'}`,
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: active ? 600 : 500, fontSize: '13px',
    fontFamily: FONT, cursor: 'pointer', textAlign: 'left',
  });

  const emptyText = view.trash ? 'Trash is empty' : (search || channelFilter !== 'all' || priorityFilter !== 'all') ? 'No matching tasks' : 'No tasks here';

  return (
    <div className="tasks-ui" style={{ display: 'flex', height: '100%', overflow: 'hidden', background: 'var(--bg-base)', fontFamily: FONT }}>

      {/* ── Views sidebar ── */}
      <nav aria-label="Task views" style={{
        width: isMobile ? '100%' : '208px', flexShrink: 0, background: 'var(--bg-surface)',
        borderRight: isMobile ? 'none' : '1px solid var(--border-subtle)',
        display: (isMobile && mobileShowList) ? 'none' : 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        <div style={{ padding: '16px 10px' }}>
          <p className="tk-label" style={{ padding: '0 8px' }}>Tasks</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {VIEWS.map((v, i) => (v === null
              ? <div key={`sep-${i}`} style={{ height: '1px', background: 'var(--border-subtle)', margin: '6px 8px' }} />
              : (
                <button key={v.key} type="button" onClick={() => setView(v.key)} aria-current={activeView === v.key ? 'page' : undefined}
                  style={navButton(activeView === v.key)}
                  onMouseEnter={(e) => { if (activeView !== v.key) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={(e) => { if (activeView !== v.key) e.currentTarget.style.background = 'transparent'; }}>
                  <v.Icon size={14} style={{ color: activeView === v.key ? 'var(--accent)' : 'var(--text-secondary)', flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{v.label}</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: activeView === v.key ? 'var(--accent)' : 'var(--text-secondary)' }}>{counts[v.key] || 0}</span>
                </button>
              )))}
          </div>

          {channelGroups.length > 0 && !isMobile && (
            <div style={{ marginTop: '18px' }}>
              <p className="tk-label" style={{ padding: '0 8px' }}>By channel</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {[{ key: 'all', name: 'All channels', count: channelTotal }, ...channelGroups].map((g) => (
                  <button key={g.key} type="button" onClick={() => setChannelFilter(g.key)} aria-pressed={channelFilter === g.key}
                    style={{ ...navButton(channelFilter === g.key), fontSize: '12px', padding: '5px 10px', gap: '8px' }}
                    onMouseEnter={(e) => { if (channelFilter !== g.key) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={(e) => { if (channelFilter !== g.key) e.currentTarget.style.background = 'transparent'; }}>
                    <Hash size={11} style={{ color: channelFilter === g.key ? 'var(--accent)' : 'var(--text-secondary)', flexShrink: 0 }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>{g.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* ── Main ── */}
      <div style={{ flex: 1, minWidth: 0, display: (isMobile && !mobileShowList) ? 'none' : 'flex', overflow: 'hidden' }}>
        <div className="tasks-main" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          <header className="tasks-header" style={{ position: 'relative', padding: isMobile ? '10px 14px' : undefined }}>
            {refreshing && (
              <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: '2px', overflow: 'hidden' }}>
                <div style={{ width: '40%', height: '100%', background: 'var(--accent)', animation: 'tk-progress 1s linear infinite' }} />
              </div>
            )}
            <div className="tasks-header-top">
              {isMobile && (
                <button type="button" className="tk-icon-btn" onClick={() => setMobileShowList(false)} aria-label="Back to views"><ChevronLeft size={18} /></button>
              )}
              <div className="tasks-header-title">
                <h1>{view.label}</h1>
                {!isMobile && <p>{view.desc}</p>}
              </div>
              {canCreate && (
                <button type="button" className="tk-btn tk-btn-primary" onClick={() => setShowModal(true)} style={{ padding: '7px 14px' }}>
                  <Plus size={13} strokeWidth={2.5} /> Create
                </button>
              )}
            </div>
            <div className="tasks-toolbar" role="toolbar" aria-label="Filter and view">
              <div className="tk-search">
                <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input className="tk-field" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks…" aria-label="Search tasks" style={{ paddingLeft: '28px', paddingRight: search ? '26px' : undefined }} />
                {search && <button type="button" className="tk-icon-btn" onClick={() => setSearch('')} aria-label="Clear search" style={{ position: 'absolute', right: '2px', top: '50%', transform: 'translateY(-50%)', width: 22, height: 22 }}><X size={12} /></button>}
              </div>
              <select className="tk-field" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} aria-label="Sort by">
                {SORT_OPTIONS.map((o) => <option key={o.id} value={o.id}>Sort: {o.label}</option>)}
              </select>
              <select className="tk-field" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} aria-label="Priority filter">
                <option value="all">All priorities</option>
                {PRIORITIES.map((p) => <option key={p} value={p}>{priorityLabel(p)}</option>)}
              </select>
              <div className="tasks-viewswitch" role="group" aria-label="Layout">
                {VIEW_MODES.map(({ key, Icon, label }) => (
                  <button key={key} type="button" onClick={() => setViewMode(key)} aria-pressed={viewMode === key} title={label}>
                    <Icon size={14} /><span className="tk-vs-label">{label}</span>
                  </button>
                ))}
              </div>
              <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                {viewMode !== 'workload' && `${shown.length} ${shown.length === 1 ? 'task' : 'tasks'}`}
              </span>
            </div>
          </header>

          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {viewMode === 'workload' ? (
              <WorkloadPanel workspaceId={workspaceId} />
            ) : shown.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '10px', padding: '24px', textAlign: 'center' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '2px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {view.trash ? <Trash2 size={20} style={{ color: 'var(--text-secondary)' }} /> : <CheckCircle2 size={20} style={{ color: 'var(--text-secondary)' }} />}
                </div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{emptyText}</p>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {view.trash ? 'Tasks you delete appear here for restoring.' : canCreate ? 'Use Create to add a task.' : ''}
                </p>
              </div>
            ) : viewMode === 'board' ? (
              <KanbanBoard tasks={shown} onTaskClick={openTask} onStatusChange={changeStatus} canMove={(t) => !t.deleted && abilitiesOf(t).status} />
            ) : viewMode === 'sprint' ? (
              <SprintBoard tasks={shown} workspaceId={workspaceId} onTaskClick={openTask} />
            ) : viewMode === 'timeline' ? (
              <TimelineView tasks={shown} onTaskClick={openTask} />
            ) : (
              <div className="tasks-list" style={{ height: '100%', overflowY: 'auto', scrollbarWidth: 'thin' }}>
                <div className="tasks-row tasks-row-head" role="row">
                  <span className="tk-col-type" />
                  <span>Summary</span>
                  <span className="tk-col-channel">Channel</span>
                  <span className="tk-col-priority">Priority</span>
                  <span className="tk-col-due">Due date</span>
                  <span className="tk-col-status">Status</span>
                  <span className="tk-col-assignee">Assignee</span>
                  <span className="tk-col-actions" />
                </div>
                {shown.map((task) => (
                  <ListRow
                    key={task.id}
                    task={task}
                    view={activeView}
                    selected={task.id === selectedId}
                    can={abilitiesOf(task)}
                    onOpen={openTask}
                    onDelete={askDelete}
                    onRestore={restoreTask}
                    onPurge={(t) => setConfirm({ mode: 'purge', task: t })}
                    onTransferRequest={setTransferTask}
                    onTransferRespond={handleTransferResponse}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedTask && (
          <WorkspaceTaskDetailPanel
            fullScreen={isMobile}
            task={selectedTask}
            members={members || []}
            allTasks={tasks}
            can={abilitiesOf(selectedTask)}
            onClose={() => {
              setSelectedId(null);
              if (routeTaskId) navigate(`/workspace/${workspaceId}/tasks${location.search}`, { replace: true });
            }}
            onUpdate={updateTask}
            onStatusChange={changeStatus}
            onDelete={askDelete}
            onRestore={restoreTask}
            onRequestTransfer={setTransferTask}
            onTransferRespond={handleTransferResponse}
            onPatchLocal={patchTaskLocal}
            onFetch={fetchTask}
          />
        )}
      </div>

      {showModal && (
        <TaskModal
          channels={channels || []}
          teamMembers={members || []}
          onClose={() => setShowModal(false)}
          onAddTask={createTask}
        />
      )}

      {confirm && (
        <TaskCompletionModal key={`${confirm.mode}-${confirm.task.id}`} task={confirm.task} mode={confirm.mode} onClose={() => setConfirm(null)} onConfirm={runConfirm} />
      )}

      {transferTask && (
        <TransferRequestModal
          task={transferTask}
          members={members || []}
          currentUserId={currentUserId}
          onClose={() => setTransferTask(null)}
          onConfirm={async (newAssigneeId, note) => {
            const m = (members || []).find((x) => String(x._id || x.id) === String(newAssigneeId));
            const ok = await requestTransfer(transferTask.id, newAssigneeId, note, m ? { _id: newAssigneeId, username: m.username } : undefined);
            if (ok) setTransferTask(null);
          }}
        />
      )}
    </div>
  );
}
