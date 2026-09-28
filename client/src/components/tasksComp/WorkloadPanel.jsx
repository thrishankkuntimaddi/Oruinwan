import React, { useState, useEffect, useCallback } from 'react';
import { Users, RefreshCw } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';
import { PRIORITY_META, taskErrorMessage } from '../../utils/taskMeta';
import { UserAvatar } from './taskUi';


const T = {
  bg: 'var(--bg-base)', bar: 'var(--bg-hover)', border: 'var(--border-subtle)',
  text: 'var(--text-primary)', muted: 'var(--text-secondary)', accent: 'var(--accent)',
  font: 'Inter, system-ui, sans-serif',
};



function WorkloadRow({ item, maxCount }) {
  const pct = maxCount > 0 ? Math.round((item.count / maxCount) * 100) : 0;
  const name = item.user?.username || item.user?.firstName || 'Unknown';

  const barColor = pct > 75 ? 'var(--state-danger)' : pct > 50 ? PRIORITY_META.high.color : T.accent;

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', borderBottom: `1px solid ${T.border}`, transition: 'background 150ms ease', fontFamily: T.font, background: 'transparent', cursor: 'default' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <UserAvatar user={{ id: item.userId || item.user?._id, username: name, profilePicture: item.user?.profilePicture }} size={28} />

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

  const fetchWorkload = useCallback(async () => {
    if (!workspaceId) {
      setError('No workspace selected.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      
      const res = await api.get(`/api/v2/tasks/workload?workspaceId=${workspaceId}`);
      setWorkload(res.data.workload || []);
    } catch (err) {
      const msg = taskErrorMessage(err, 'Failed to load workload data.');
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, showToast]);

  useEffect(() => {
    fetchWorkload();
  }, [fetchWorkload]);

  const maxCount = workload.reduce((max, item) => Math.max(max, item.count), 0);
  const totalTasks = workload.reduce((sum, item) => sum + item.count, 0);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.bg, fontFamily: T.font }}>
      {}
      <div style={{ flexShrink: 0, background: 'var(--bg-surface)', borderBottom: `1px solid ${T.border}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Users size={14} style={{ color: T.accent }} />
        <span style={{ fontSize: '12px', fontWeight: 600, color: T.text }}>Team workload</span>
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

      {}
      {!loading && workload.length > 0 && (
        <div style={{ flexShrink: 0, padding: '6px 16px', background: 'var(--bg-surface)', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: '16px' }}>
          {[
            { color: T.accent, label: 'Normal (≤50%)' },
            { color: PRIORITY_META.high.color, label: 'Heavy (51-75%)' },
            { color: 'var(--state-danger)', label: 'Overloaded (>75%)' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: l.color }} />
              <span style={{ fontSize: '10px', color: T.muted, fontFamily: T.font }}>{l.label}</span>
            </div>
          ))}
        </div>
      )}

      {}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', background: T.bg }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '160px', color: T.muted, fontSize: '13px', gap: '8px', fontFamily: T.font }}>
            <RefreshCw size={14} className="animate-spin" />
            Loading workload…
          </div>
        )}
        {error && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '160px', gap: '8px' }}>
            <p style={{ fontSize: '13px', color: 'var(--state-danger)', fontFamily: T.font }}>{error}</p>
            <button onClick={fetchWorkload} style={{ fontSize: '11px', color: T.accent, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: T.font }}>Retry</button>
          </div>
        )}
        {!loading && !error && workload.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '192px', gap: '8px' }}>
            <Users size={28} style={{ opacity: 0.2, color: T.muted }} />
            <p style={{ fontSize: '13px', color: T.muted, fontFamily: T.font }}>No assigned tasks in this workspace</p>
            <p style={{ fontSize: '11px', color: T.muted, fontFamily: T.font }}>Assign tasks to team members to see workload here</p>
          </div>
        )}
        {!loading && !error && workload.map(item => (
          <WorkloadRow key={item.userId?.toString() || Math.random()} item={item} maxCount={maxCount} />
        ))}
      </div>
    </div>
  );
}
