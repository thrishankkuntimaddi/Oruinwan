// components/TaskModal.jsx
import React, { useState } from "react";

const priorities = ["Emergency", "High", "Moderate", "Low", "Later"];
const statuses = ["In Progress", "To Do", "Completed", "Overdue"];

export default function TaskModal({ onClose, onAddTask, channels = [], teamMembers = [] }) {
  const [task, setTask] = useState("");
  const [project, setProject] = useState("");
  const [assignee, setAssignee] = useState("Self");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("Moderate");
  const [status, setStatus] = useState("In Progress");

  const handleAdd = () => {
    if (!task || !project || !dueDate) return alert("Fill all required fields.");
    const newTask = { task, project, assignee, dueDate, priority, status };
    onAddTask(newTask);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-xl p-6 shadow-xl">
        <h2 className="text-xl font-semibold mb-4">Add New Task</h2>
        <div className="grid grid-cols-1 gap-4">
          <input
            type="text"
            placeholder="Task Description"
            className="border px-4 py-2 rounded"
            value={task}
            onChange={(e) => setTask(e.target.value)}
          />

          <select value={project} onChange={(e) => setProject(e.target.value)} className="border px-4 py-2 rounded">
            <option value="">Select Project</option>
            {channels.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="border px-4 py-2 rounded">
            <option>Self</option>
            {teamMembers.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <input
            type="date"
            className="border px-4 py-2 rounded"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />

          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="border px-4 py-2 rounded">
            {priorities.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>

          <select value={status} onChange={(e) => setStatus(e.target.value)} className="border px-4 py-2 rounded">
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>

          <div className="flex justify-end gap-3 mt-4">
            <button onClick={onClose} className="px-4 py-2 rounded bg-gray-200 text-sm">Cancel</button>
            <button onClick={handleAdd} className="px-4 py-2 rounded bg-blue-600 text-white text-sm">Add Task</button>
          </div>
        </div>
      </div>
    </div>
  );
}
