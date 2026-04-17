// client/src/components/tasksComp/WorkloadPanel.jsx
/**
 * WorkloadPanel — Shows tasks per user for a workspace.
 * Calls GET /api/tasks/workload?workspaceId=...
 * (Tasks are registered under /api/tasks in server.js)
 */
import React, { useState, useEffect } from 'react';
import { Users, RefreshCw } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';

function initials(user) {
  if (!user) return '?';
  const name = user.username || user.firstName || '';
  return name.charAt(0).toUpperCase() || '?';
}

const T = {
  bg: '#0c0c0c', bar: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.07)',
  text: '#e4e4e4', muted: 'rgba(228,228,228,0.35)', accent: '#b8956a',
  font: 'Inter, system-ui, sans-serif',
};

function avatarColor(name) {
  const colors = ['#b8956a', '#8b5cf6', '#22c55e', '#f97316', '#3b82f6', '#06b6d4', '#ec4899'];
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

  const barColor = pct > 75 ? '#ef4444' : pct > 50 ? '#f97316' : T.accent;

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', borderBottom: `1px solid ${T.border}`, transition: 'background 150ms ease', fontFamily: T.font, background: 'transparent', cursor: 'default' }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div
        style={{ width: '28px', height: '28px', borderRadius: '50%', background: bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}
        title={name}
      >
        {initials(item.user)}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
            {item.user?.email && (
              <span style={{ fontSize: '10px', color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.user.email}</span>
            )}
          </div>
          <span style={{ fontSize: '11px', fontWeight: 700, color: barColor, flexShrink: 0, marginLeft: '8px', fontFamily: T.font }}>
            {item.count} {item.count === 1 ? 'task' : 'tasks'}
          </span>
        </div>
        <div style={{ height: '5px', background: 'var(--bg-active)', overflow: 'hidden' }}>
          <div
            style={{ height: '100%', width: `${pct}%`, background: barColor, transition: 'width 300ms ease' }}
          />
        </div>
      </div>

      <span style={{ fontSize: '10px', fontWeight: 700, width: '32px', textAlign: 'right', flexShrink: 0, color: barColor, fontFamily: T.font }}>
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
      // Route is /api/v2/tasks/workload (tasks registered under /api/v2/tasks)
      const res = await api.get(`/api/v2/tasks/workload?workspaceId=${workspaceId}`);
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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.bg, fontFamily: T.font }}>
      {/* Header */}
      <div style={{ flexShrink: 0, background: 'var(--bg-surface)', borderBottom: `1px solid ${T.border}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Users size={14} style={{ color: T.accent }} />
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Team Workload</span>
        {!loading && workload.length > 0 && (
          <span style={{ fontSize: '11px', color: T.muted }}>
            — {workload.length} member(s) · {totalTasks} task(s) total
          </span>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={fetchWorkload}
          disabled={loading}
          style={{ padding: '5px', background: 'transparent', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', color: T.muted, opacity: loading ? 0.5 : 1, transition: 'color 150ms ease' }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.color = T.accent; }}
          onMouseLeave={e => { e.currentTarget.style.color = T.muted; }}
          title="Refresh workload"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Legend */}
      {!loading && workload.length > 0 && (
        <div style={{ flexShrink: 0, padding: '6px 16px', background: 'rgba(255,255,255,0.02)', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: '16px' }}>
          {[
            { color: T.accent, label: 'Normal (≤50%)' },
            { color: '#f97316', label: 'Heavy (51-75%)' },
            { color: '#ef4444', label: 'Overloaded (>75%)' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: l.color }} />
              <span style={{ fontSize: '10px', color: T.muted, fontFamily: T.font }}>{l.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', background: T.bg }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '160px', color: T.muted, fontSize: '13px', gap: '8px', fontFamily: T.font }}>
            <RefreshCw size={14} className="animate-spin" />
            Loading workload…
          </div>
        )}
        {error && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '160px', gap: '8px' }}>
            <p style={{ fontSize: '13px', color: '#f87171', fontFamily: T.font }}>{error}</p>
            <button onClick={fetchWorkload} style={{ fontSize: '11px', color: T.accent, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: T.font }}>Retry</button>
          </div>
        )}
        {!loading && !error && workload.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '192px', gap: '8px' }}>
            <Users size={28} style={{ opacity: 0.2, color: T.muted }} />
            <p style={{ fontSize: '13px', color: T.muted, fontFamily: T.font }}>No assigned tasks in this workspace</p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: T.font }}>Assign tasks to team members to see workload here</p>
          </div>
        )}
        {!loading && !error && workload.map(item => (
          <WorkloadRow key={item.userId?.toString() || Math.random()} item={item} maxCount={maxCount} />
        ))}
      </div>
    </div>
  );
}
