import React from "react";
import { useLocation } from "react-router-dom";

const MyTasks = () => {
  const location = useLocation();
  const activeTab = new URLSearchParams(location.search).get("tab") || "my-tasks";

  // Mock Data
  const myTasks = [
    { id: 1, title: "Design Login Page", status: "In Progress", priority: "High", due: "Tomorrow" },
    { id: 2, title: "Fix Auth Bug", status: "Done", priority: "Critical", due: "Today" },
  ];

  const sharedTasks = [
    { id: 3, title: "Review PR #123", assignedBy: "Sarah", status: "Pending", priority: "Medium", due: "Next Week" },
    { id: 4, title: "Update Documentation", assignedBy: "John", status: "In Progress", priority: "Low", due: "Fri" },
  ];

  const tasks = activeTab === "my-tasks" ? myTasks : sharedTasks;

  return (
    <div className="flex flex-col h-full bg-white p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {activeTab === "my-tasks" ? "My Tasks" : "Shared Tasks"}
        </h1>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
          + New Task
        </button>
      </div>

      {/* Task Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
              {activeTab === "shared-tasks" && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned By</th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tasks.map((task) => (
              <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{task.title}</td>
                {activeTab === "shared-tasks" && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{task.assignedBy}</td>
                )}
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${task.status === "Done" ? "bg-green-100 text-green-800" :
                    task.status === "In Progress" ? "bg-blue-100 text-blue-800" :
                      "bg-yellow-100 text-yellow-800"
                    }`}>
                    {task.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span className={`${task.priority === "Critical" ? "text-red-600 font-bold" :
                    task.priority === "High" ? "text-orange-600" :
                      "text-gray-500"
                    }`}>
                    {task.priority}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{task.due}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {tasks.length === 0 && (
          <div className="p-6 text-center text-gray-500">No tasks found.</div>
        )}
      </div>
    </div>
  );
};

export default MyTasks;
