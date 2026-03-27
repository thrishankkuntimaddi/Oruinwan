// client/src/components/tasksComp/WorkloadPanel.jsx
/**
 * WorkloadPanel — Shows tasks per user for a workspace.
 * Calls GET /api/tasks/workload?workspaceId=...
 * (Tasks are registered under /api/tasks in server.js)
 */
import React, { useState, useEffect } from 'react';
import { Users, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

function initials(user) {
  if (!user) return '?';
  const name = user.username || user.firstName || '';
  return name.charAt(0).toUpperCase() || '?';
}

function avatarColor(name) {
  const colors = ['#6554C0', '#0052CC', '#00875A', '#FF5630', '#FF991F', '#36B37E', '#00B8D9'];
  if (!name) return colors[0];
  return colors[name.charCodeAt(0) % colors.length];
}

function formatTime(seconds) {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function WorkloadRow({ item, maxCount }) {
  const pct = maxCount > 0 ? Math.round((item.count / maxCount) * 100) : 0;
  const name = item.user?.username || item.user?.firstName || 'Unknown';
  const bgColor = avatarColor(name);

  // Color the bar by workload intensity
  const barColor = pct > 75 ? '#FF5630' : pct > 50 ? '#E97F33' : '#0052CC';

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-b hover:bg-gray-50 transition-colors"
      style={{ borderColor: '#DFE1E6' }}
    >
      {/* Avatar */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
        style={{ background: bgColor }}
        title={name}
      >
        {initials(item.user)}
      </div>

      {/* Name + bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium text-gray-800 truncate">{name}</span>
            {item.user?.email && (
              <span className="text-[10px] text-gray-400 truncate hidden sm:block">{item.user.email}</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            <span className="text-xs font-bold" style={{ color: barColor }}>
              {item.count} {item.count === 1 ? 'task' : 'tasks'}
            </span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, background: barColor }}
          />
        </div>
      </div>

      {/* Percentage label */}
      <span className="text-[10px] font-semibold w-8 text-right flex-shrink-0" style={{ color: barColor }}>
        {pct}%
      </span>
    </div>
  );
}

export default function WorkloadPanel({ workspaceId }) {
  const { showToast } = useToast();
  const [workload, setWorkload] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchWorkload = async () => {
    if (!workspaceId) {
      setError('No workspace selected.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Route is /api/tasks/workload (tasks registered under /api/tasks)
      const res = await api.get(`/api/tasks/workload?workspaceId=${workspaceId}`);
      setWorkload(res.data.workload || []);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to load workload data.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkload();
  }, [workspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxCount = workload.reduce((max, item) => Math.max(max, item.count), 0);
  const totalTasks = workload.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className="flex-shrink-0 bg-white border-b px-4 py-2.5 flex items-center gap-2"
        style={{ borderColor: '#DFE1E6' }}
      >
        <Users size={14} style={{ color: '#0052CC' }} />
        <span className="text-xs font-semibold" style={{ color: '#172B4D' }}>Team Workload</span>
        {!loading && workload.length > 0 && (
          <span className="text-xs text-gray-400">
            — {workload.length} member(s) · {totalTasks} task(s) total
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={fetchWorkload}
          disabled={loading}
          className="p-1.5 rounded hover:bg-gray-100 transition-colors disabled:opacity-50"
          title="Refresh workload"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} style={{ color: '#7A869A' }} />
        </button>
      </div>

      {/* Legend */}
      {!loading && workload.length > 0 && (
        <div className="flex-shrink-0 px-4 py-1.5 bg-gray-50 border-b flex items-center gap-4" style={{ borderColor: '#DFE1E6' }}>
          {[
            { color: '#0052CC', label: 'Normal (≤50%)' },
            { color: '#E97F33', label: 'Heavy (51-75%)' },
            { color: '#FF5630', label: 'Overloaded (>75%)' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
              <span className="text-[10px] text-gray-500">{l.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-white" style={{ scrollbarWidth: 'thin' }}>
        {loading && (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm gap-2">
            <RefreshCw size={14} className="animate-spin" />
            Loading workload…
          </div>
        )}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-red-400">
            <p className="text-sm">{error}</p>
            <button onClick={fetchWorkload} className="text-blue-500 text-xs underline">Retry</button>
          </div>
        )}
        {!loading && !error && workload.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-gray-400">
            <Users size={28} className="opacity-30" />
            <p className="text-sm">No assigned tasks in this workspace</p>
            <p className="text-xs text-gray-300">Assign tasks to team members to see workload here</p>
          </div>
        )}
        {!loading && !error && workload.map(item => (
          <WorkloadRow key={item.userId?.toString() || Math.random()} item={item} maxCount={maxCount} />
        ))}
      </div>
    </div>
  );
}
