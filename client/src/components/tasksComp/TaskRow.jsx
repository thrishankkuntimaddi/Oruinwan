import { Trash2, RotateCcw } from "lucide-react";

// Priority colours come from the theme (danger / warning / accent / success / muted).
const priorityColors = {
  Emergency: "var(--state-danger)",
  High: "var(--color-warning)",
  Moderate: "var(--accent)",
  Low: "var(--state-success)",
  Later: "var(--text-secondary)",
};

const selectStyle = (tone) => ({
  padding: "3px 8px",
  fontSize: 12,
  fontWeight: 600,
  fontFamily: "var(--font)",
  borderRadius: "var(--gl-radius, 3px)",
  color: tone || "var(--text-primary)",
  background: tone ? `color-mix(in srgb, ${tone} 10%, transparent)` : "var(--bg-input)",
  border: `1px solid ${tone ? `color-mix(in srgb, ${tone} 35%, transparent)` : "var(--border-default)"}`,
});

const cell = { padding: "8px 16px", fontSize: 13 };
const mutedCell = { ...cell, color: "var(--text-secondary)" };

const statusOrder = ["In Progress", "To Do", "Completed", "Overdue"];

const TaskRow = ({
  task,
  index,
  activeTab,
  updateTaskField,
  deleteTask,
  restoreTask,
  permanentlyDelete,
}) => {
  return (
    <tr style={{ borderTop: "1px solid var(--border-subtle)" }}>
      <td style={{ ...cell, color: "var(--text-primary)" }}>{task.task}</td>
      <td style={mutedCell}>{task.project}</td>
      <td style={mutedCell}>{task.assignee}</td>
      <td style={mutedCell}>{task.dueDate}</td>
      <td style={cell}>
        {activeTab === "Deleted" ? (
          task.priority
        ) : (
          <select
            aria-label="Priority"
            style={selectStyle(priorityColors[task.priority])}
            value={task.priority}
            onChange={(e) => updateTaskField(index, "priority", e.target.value)}
          >
            {Object.keys(priorityColors).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}
      </td>
      <td style={cell}>
        {activeTab === "Deleted" ? (
          task.status
        ) : (
          <select
            aria-label="Status"
            style={selectStyle()}
            value={task.status}
            onChange={(e) => updateTaskField(index, "status", e.target.value)}
          >
            {statusOrder.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </td>
      <td style={cell}>
        {activeTab === "Deleted" ? (
          <div style={{ display: "flex", gap: 4 }}>
            <button type="button" className="gl-btn gl-btn--ghost gl-btn--sm" onClick={() => restoreTask(index)}>
              <RotateCcw size={12} /> Restore
            </button>
            <button type="button" className="gl-btn gl-btn--ghost gl-btn--sm" style={{ color: "var(--state-danger)" }} onClick={() => permanentlyDelete(index)}>
              <Trash2 size={12} /> Delete forever
            </button>
          </div>
        ) : (
          <button type="button" className="gl-icon-btn" onClick={() => deleteTask(index)} aria-label={`Delete ${task.task}`} title="Delete task">
            <Trash2 size={14} />
          </button>
        )}
      </td>
    </tr>
  );
};

export default TaskRow;
