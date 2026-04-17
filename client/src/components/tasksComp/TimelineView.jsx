// client/src/components/tasksComp/TimelineView.jsx
/**
 * TimelineView — Horizontal Gantt-style timeline — Monolith Flow dark theme
 */
import React, { useMemo } from 'react';
import { Calendar, AlertTriangle } from 'lucide-react';

const T = {
    base: 'var(--bg-base)',
    surface: 'var(--bg-surface)',
    border: 'var(--border-default)',
    text: 'var(--text-primary)',
    textMuted: 'var(--text-muted)',
    textDim: 'var(--text-muted)',
    amber: '#b8956a',
};

const PRIORITY_COLORS = {
    highest: '#f87171', high: '#fb923c', medium: '#b8956a',
    low: '#60a5fa', lowest: 'var(--text-muted)',
    emergency: '#f87171', urgent: '#f87171',
};

function getDateRange(tasks) {
    const dates = tasks
        .flatMap(t => [t.startDate, t.dueDate].filter(Boolean))
        .map(d => new Date(d).getTime())
        .filter(n => !isNaN(n));
    if (dates.length === 0) {
        const now = new Date();
        return { min: now.getTime(), max: now.getTime() + 30 * 86400000 };
    }
    const min = Math.min(...dates);
    const max = Math.max(...dates);
    const pad = (max - min) * 0.08 || 5 * 86400000;
    return { min: min - pad, max: max + pad };
}

function toPercent(ts, min, max) {
    if (max === min) return 0;
    return ((ts - min) / (max - min)) * 100;
}

function DayMarkers({ min, max }) {
    const total = max - min;
    const numDays = Math.floor(total / 86400000);
    const step = numDays < 10 ? 1 : numDays < 30 ? 7 : 30;

    const markers = [];
    let d = new Date(min);
    d.setHours(0, 0, 0, 0);
    while (d.getTime() <= max) {
        const pct = toPercent(d.getTime(), min, max);
        markers.push({ pct, label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), ts: d.getTime() });
        d = new Date(d.getTime() + step * 86400000);
    }

    return (
        <div style={{ position: 'relative', height: '28px', borderBottom: `1px solid ${T.border}`, flexShrink: 0, background: T.base }}>
            {markers.map(m => (
                <div key={m.ts} style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', left: `${m.pct}%`, transform: 'translateX(-50%)' }}>
                    <span style={{ fontSize: '9px', color: T.textDim, whiteSpace: 'nowrap', fontFamily: 'monospace', fontWeight: 600 }}>{m.label}</span>
                    <div style={{ width: '1px', height: '6px', background: T.border, marginTop: '2px' }} />
                </div>
            ))}
            {/* Today marker */}
            {(() => {
                const todayPct = toPercent(Date.now(), min, max);
                if (todayPct < 0 || todayPct > 100) return null;
                return (
                    <div style={{ position: 'absolute', top: 0, bottom: 0, width: '1px', background: '#f87171', opacity: 0.7, left: `${todayPct}%` }}>
                        <span style={{ position: 'absolute', top: '2px', left: '3px', fontSize: '8px', color: '#f87171', fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'monospace' }}>Today</span>
                    </div>
                );
            })()}
        </div>
    );
}

function TimelineRow({ task, min, max, onClick }) {
    const startTs = task.startDate
        ? new Date(task.startDate).getTime()
        : new Date(task.dueDate || Date.now()).getTime() - 86400000;
    const endTs = task.dueDate ? new Date(task.dueDate).getTime() : startTs + 86400000;
    const pColor = PRIORITY_COLORS[task.priority?.toLowerCase()] || T.amber;

    const leftPct = Math.max(0, toPercent(startTs, min, max));
    const rightPct = Math.min(100, toPercent(endTs, min, max));
    const widthPct = Math.max(0.5, rightPct - leftPct);
    const isOverdue = endTs < Date.now() && task.status !== 'done' && task.status !== 'Completed';

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: `1px solid ${T.border}`, minHeight: '36px', cursor: 'pointer', transition: 'background 150ms ease' }}
            onClick={() => onClick(task)}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            {/* Task name fixed panel */}
            <div style={{ width: '192px', flexShrink: 0, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, borderRight: `1px solid ${T.border}` }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0, background: pColor }} />
                <span style={{ fontSize: '12px', color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{task.title}</span>
                {isOverdue && <AlertTriangle size={9} style={{ color: '#f87171', flexShrink: 0 }} />}
            </div>

            {/* Bar area */}
            <div style={{ flex: 1, position: 'relative', height: '100%', padding: '8px 12px 8px 0' }}>
                <div style={{
                    position: 'absolute',
                    height: '18px',
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    background: isOverdue ? '#f87171' : pColor,
                    opacity: 0.85,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: '6px',
                    overflow: 'hidden',
                }}
                    title={`${task.title}\n${new Date(startTs).toDateString()} → ${new Date(endTs).toDateString()}`}>
                    {widthPct > 8 && (
                        <span style={{ fontSize: '9px', color: '#000', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {task.title.substring(0, 20)}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function TimelineView({ tasks = [], onTaskClick }) {
    const withDates = useMemo(() => tasks.filter(t => t.dueDate || t.startDate), [tasks]);
    const noDates = useMemo(() => tasks.filter(t => !t.dueDate && !t.startDate), [tasks]);
    const { min, max } = useMemo(() => getDateRange(withDates), [withDates]);

    if (tasks.length === 0) {
        return (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', background: T.base }}>
                <Calendar size={32} style={{ color: T.textDim }} />
                <p style={{ fontSize: '13px', color: T.textMuted }}>No tasks to display on timeline</p>
                <p style={{ fontSize: '11px', color: T.textDim }}>Add start/due dates to your tasks to see them here</p>
            </div>
        );
    }

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.base }}>
            {/* Header */}
            <div style={{ display: 'flex', flexShrink: 0, borderBottom: `1px solid ${T.border}`, background: T.base }}>
                <div style={{ width: '192px', flexShrink: 0, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', borderRight: `1px solid ${T.border}` }}>
                    <Calendar size={10} style={{ color: T.textDim }} />
                    <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.textDim, fontFamily: 'monospace' }}>TASK</span>
                </div>
                <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                    <DayMarkers min={min} max={max} />
                </div>
            </div>

            {/* Rows */}
            <div style={{ flex: 1, overflowY: 'auto', background: T.surface, scrollbarWidth: 'thin' }}>
                {withDates.map(task => (
                    <TimelineRow key={task.id || task._id} task={task} min={min} max={max} onClick={onTaskClick} />
                ))}
                {noDates.length > 0 && (
                    <div style={{ padding: '8px 12px', background: T.base, borderBottom: `1px solid ${T.border}` }}>
                        <p style={{ fontSize: '10px', color: T.textDim, fontFamily: 'monospace' }}>{noDates.length} task(s) with no date — not shown</p>
                    </div>
                )}
            </div>
        </div>
    );
}
