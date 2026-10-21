import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, Download, RefreshCw, Users, ListChecks } from 'lucide-react';
import api from '@services/api';
import { taskErrorMessage } from '../../utils/taskMeta';
import { reportRange, reportRows, fmtHours, estimatePct, reportCsv } from '../../utils/taskTime';
import { UserAvatar, FONT } from './taskUi';
import { EmptyState } from '../ui/page';

const RANGES = [
  { key: 'week', label: 'This week' },
  { key: '7d', label: 'Last 7 days' },
  { key: 'month', label: 'This month' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'all', label: 'All time' },
];

const head = { fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' };
const row = { display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 16px', borderBottom: '1px solid var(--border-subtle)', fontSize: '13px' };

function Bar({ pct, over }) {
  return (
    <div aria-hidden style={{ height: '4px', background: 'var(--bg-active)', overflow: 'hidden', borderRadius: '2px' }}>
      <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: over ? 'var(--state-danger)' : 'var(--accent)' }} />
    </div>
  );
}

/** Workspace time report: hours per person and per task (GET /api/v2/tasks/time/report). */
export default function TimeReportView({ workspaceId, onOpenTask }) {
  const [range, setRange] = useState('week');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const { from, to } = reportRange(range);
      const res = await api.get('/api/v2/tasks/time/report', { params: { workspaceId, ...(from ? { from, to } : {}) } });
      setReport(res.data || null);
    } catch (err) {
      setError(taskErrorMessage(err, 'Could not load the time report'));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, range]);
  useEffect(() => { load(); }, [load]);

  const people = useMemo(() => reportRows(report?.byUser || [], report?.totalSeconds), [report]);
  const tasks = useMemo(() => reportRows(report?.byTask || [], report?.totalSeconds), [report]);

  const exportCsv = () => {
    const blob = new Blob([reportCsv(report)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-report-${range}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="tasks-ui" data-testid="time-report" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: FONT }}>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '10px 16px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}>
        <Clock size={14} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Total</span>
        <strong style={{ fontSize: '15px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{fmtHours(report?.totalSeconds || 0)}</strong>
        <div className="gl-tabs gl-x-tabs-fit" role="group" aria-label="Report period" style={{ marginLeft: 'auto' }}>
          {RANGES.map((r) => (
            <button key={r.key} type="button" className={`gl-tab${range === r.key ? ' is-active' : ''}`} aria-pressed={range === r.key} onClick={() => setRange(r.key)}>{r.label}</button>
          ))}
        </div>
        <button type="button" className="gl-icon-btn" onClick={load} disabled={loading} aria-label="Refresh" title="Refresh"><RefreshCw size={14} className={loading ? 'tk-spin' : ''} /></button>
        <button type="button" className="gl-btn gl-btn--ghost gl-btn--sm" onClick={exportCsv} disabled={!report || loading}><Download size={13} /> CSV</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin' }}>
        {error ? (
          <EmptyState icon={Clock} title="Couldn’t load the time report" text={error}
            action={<button type="button" className="gl-btn" onClick={load}>Try again</button>} />
        ) : !loading && report && !people.length && !tasks.length ? (
          <EmptyState icon={Clock} title="No time logged in this period"
            text="Start a timer or log time on a task and it shows up here, per person and per task." />
        ) : (
          <>
            <section aria-label="Time by person">
              <div style={{ ...row, ...head, background: 'var(--bg-surface)' }}><Users size={11} /> People</div>
              {people.map((u) => (
                <div key={u.userId} style={row}>
                  <UserAvatar user={{ id: u.userId, username: u.user?.username || '?', profilePicture: u.user?.profilePicture }} size={24} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.user?.username || 'Unknown'}{u.running && <span style={{ color: 'var(--state-success)', fontSize: '11px' }}> ● tracking</span>}
                      </span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '12px', whiteSpace: 'nowrap' }}>{u.tasks} {u.tasks === 1 ? 'task' : 'tasks'}</span>
                    </div>
                    <Bar pct={u.share} />
                  </div>
                  <strong style={{ width: '72px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>{fmtHours(u.seconds)}</strong>
                </div>
              ))}
            </section>
            <section aria-label="Time by task">
              <div style={{ ...row, ...head, background: 'var(--bg-surface)' }}><ListChecks size={11} /> Tasks</div>
              {tasks.map((t) => {
                const pct = estimatePct(t.seconds, t.estimatedHours);
                return (
                  <button key={t.taskId} type="button" onClick={() => onOpenTask?.(t.taskId)}
                    style={{ ...row, width: '100%', background: 'none', border: 0, borderBottom: '1px solid var(--border-subtle)', cursor: onOpenTask ? 'pointer' : 'default', textAlign: 'left', fontFamily: FONT, color: 'inherit' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: t.estimatedHours ? '4px' : 0 }}>
                        {t.issueKey && <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-secondary)' }}>{t.issueKey} · </span>}{t.title || 'Untitled'}
                      </div>
                      {t.estimatedHours ? <Bar pct={pct} over={pct > 100} /> : null}
                    </div>
                    {t.estimatedHours ? <span style={{ fontSize: '11px', color: pct > 100 ? 'var(--state-danger)' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{pct}% of {t.estimatedHours}h</span> : null}
                    <strong style={{ width: '72px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>{fmtHours(t.seconds)}</strong>
                  </button>
                );
              })}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
