// client/src/components/tasksComp/TimelineView.jsx
/**
 * TimelineView — Horizontal Gantt-style timeline using CSS positioning.
 * No chart library required. Uses startDate + dueDate from existing task fields.
 */
import React, { useMemo } from 'react';
import { Calendar, AlertTriangle } from 'lucide-react';

const PRIORITY_COLORS = {
  highest: '#CD1317', high: '#E97F33', medium: '#0052CC', low: '#3E7FC1', lowest: '#7A869A',
  emergency: '#CD1317', urgent: '#CD1317'
};

function getDateRange(tasks) {
  const dates = tasks
    .flatMap(t => [t.startDate, t.dueDate].filter(Boolean))
    .map(d => new Date(d).getTime())
    .filter(n => !isNaN(n));

  if (dates.length === 0) {
    const now = new Date();
    return { min: now.getTime(), max: now.getTime() + 30 * 86400000 }; // 30-day window
  }

  const min = Math.min(...dates);
  const max = Math.max(...dates);
  // Add 10% padding on each side
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
    <div className="relative h-6 border-b flex-shrink-0" style={{ borderColor: '#DFE1E6' }}>
      {markers.map(m => (
        <div key={m.ts} className="absolute flex flex-col items-center" style={{ left: `${m.pct}%`, transform: 'translateX(-50%)' }}>
          <span className="text-[9px] text-gray-400 whitespace-nowrap font-medium">{m.label}</span>
          <div className="w-px h-2 bg-gray-200 mt-0.5" />
        </div>
      ))}
      {/* Today marker */}
      {(() => {
        const todayPct = toPercent(Date.now(), min, max);
        if (todayPct < 0 || todayPct > 100) return null;
        return (
          <div className="absolute top-0 bottom-0 w-px bg-red-400 opacity-70" style={{ left: `${todayPct}%` }}>
            <span className="absolute -top-0.5 left-1 text-[8px] text-red-500 font-bold">Today</span>
          </div>
        );
      })()}
    </div>
  );
}

function TimelineRow({ task, min, max, onClick }) {
  const startTs = task.startDate ? new Date(task.startDate).getTime() : new Date(task.dueDate || Date.now()).getTime() - 86400000;
  const endTs = task.dueDate ? new Date(task.dueDate).getTime() : startTs + 86400000;
  const pColor = PRIORITY_COLORS[task.priority?.toLowerCase()] || '#0052CC';

  const leftPct = Math.max(0, toPercent(startTs, min, max));
  const rightPct = Math.min(100, toPercent(endTs, min, max));
  const widthPct = Math.max(0.5, rightPct - leftPct);

  const isOverdue = endTs < Date.now() && task.status !== 'done' && task.status !== 'Completed';

  return (
    <div
      className="flex items-center gap-3 border-b hover:bg-gray-50 transition-colors cursor-pointer"
      style={{ borderColor: '#DFE1E6', minHeight: 36 }}
      onClick={() => onClick(task)}
    >
      {/* Task name — fixed width left panel */}
      <div className="w-48 flex-shrink-0 px-3 py-1.5 flex items-center gap-1.5 min-w-0">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: pColor }} />
        <span className="text-xs text-gray-800 truncate">{task.title}</span>
        {isOverdue && <AlertTriangle size={9} className="text-red-500 flex-shrink-0" />}
      </div>

      {/* Timeline bar area */}
      <div className="flex-1 relative h-full py-2 pr-3">
        <div
          className="absolute h-5 rounded-sm flex items-center px-1.5 cursor-pointer"
          style={{
            left: `${leftPct}%`,
            width: `${widthPct}%`,
            background: isOverdue ? '#FF5630' : pColor,
            opacity: 0.8,
            top: '50%',
            transform: 'translateY(-50%)',
          }}
          title={`${task.title}\n${new Date(startTs).toDateString()} → ${new Date(endTs).toDateString()}`}
        >
          {widthPct > 8 && (
            <span className="text-white text-[9px] font-medium truncate">{task.title.substring(0, 20)}</span>
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
      <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
        <Calendar size={32} className="opacity-30" />
        <p className="text-sm">No tasks to display on timeline</p>
        <p className="text-xs">Add start/due dates to your tasks to see them here</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-shrink-0 bg-white border-b" style={{ borderColor: '#DFE1E6' }}>
        <div className="w-48 flex-shrink-0 px-3 py-2 flex items-center gap-1.5 border-r" style={{ borderColor: '#DFE1E6' }}>
          <Calendar size={11} style={{ color: '#7A869A' }} />
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#7A869A' }}>Task</span>
        </div>
        <div className="flex-1 relative overflow-hidden">
          <DayMarkers min={min} max={max} />
        </div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto bg-white" style={{ scrollbarWidth: 'thin' }}>
        {withDates.map(task => (
          <TimelineRow
            key={task.id || task._id}
            task={task}
            min={min}
            max={max}
            onClick={onTaskClick}
          />
        ))}
        {noDates.length > 0 && (
          <div className="px-3 py-2 bg-gray-50 border-b" style={{ borderColor: '#DFE1E6' }}>
            <p className="text-[10px] text-gray-400 font-medium">{noDates.length} task(s) with no date — not shown</p>
          </div>
        )}
      </div>
    </div>
  );
}
