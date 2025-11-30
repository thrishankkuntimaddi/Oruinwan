// components/TaskTable.jsx
import TaskRow from "./TaskRow";

const TaskTable = ({
  tasks,
  activeTab,
  updateTaskField,
  deleteTask,
  restoreTask,
  permanentlyDelete,
}) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden text-sm">
        <thead className="bg-gray-50 text-gray-700">
          <tr>
            <th className="px-4 py-2 text-left">Task</th>
            <th className="px-4 py-2 text-left">Project</th>
            <th className="px-4 py-2 text-left">Assignee</th>
            <th className="px-4 py-2 text-left">Due Date</th>
            <th className="px-4 py-2 text-left">Priority</th>
            <th className="px-4 py-2 text-left">Status</th>
            <th className="px-4 py-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 ? (
            <tr>
              <td colSpan="7" className="text-center text-gray-400 py-6">
                No tasks found.
              </td>
            </tr>
          ) : (
            tasks.map((task, index) => (
              <TaskRow
                key={index}
                task={task}
                index={index}
                activeTab={activeTab}
                updateTaskField={updateTaskField}
                deleteTask={deleteTask}
                restoreTask={restoreTask}
                permanentlyDelete={permanentlyDelete}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default TaskTable;
