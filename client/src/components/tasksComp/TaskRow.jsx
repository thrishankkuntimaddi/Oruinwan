// components/TaskRow.jsx
const priorityColors = {
  Emergency: "bg-red-500 text-white",
  High: "bg-orange-500 text-white",
  Moderate: "bg-yellow-400 text-black",
  Low: "bg-green-400 text-black",
  Later: "bg-gray-300 text-black",
};

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
    <tr className="border-t border-gray-200">
      <td className="px-4 py-2">{task.task}</td>
      <td className="px-4 py-2 text-gray-600">{task.project}</td>
      <td className="px-4 py-2 text-gray-600">{task.assignee}</td>
      <td className="px-4 py-2 text-gray-600">{task.dueDate}</td>
      <td className="px-4 py-2">
        {activeTab === "Deleted" ? (
          task.priority
        ) : (
          <select
            className={`rounded px-2 py-1 text-xs font-medium ${priorityColors[task.priority]}`}
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
      <td className="px-4 py-2">
        {activeTab === "Deleted" ? (
          task.status
        ) : (
          <select
            className="bg-gray-100 rounded px-2 py-1 text-xs"
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
      <td className="px-4 py-2">
        {activeTab === "Deleted" ? (
          <div className="flex gap-2">
            <button
              onClick={() => restoreTask(index)}
              className="text-green-600 hover:underline text-xs"
            >
              Restore
            </button>
            <button
              onClick={() => permanentlyDelete(index)}
              className="text-red-600 hover:underline text-xs"
            >
              Delete
            </button>
          </div>
        ) : (
          <button
            onClick={() => deleteTask(index)}
            className="text-red-500 text-lg hover:scale-110"
          >
            🗑️
          </button>
        )}
      </td>
    </tr>
  );
};

export default TaskRow;
