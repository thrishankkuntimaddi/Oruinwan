import React, { useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import {
  Plus, Search, Filter, Calendar, Flag,
  CheckCircle2, Trash2, User, ArrowUpDown, FileText
} from "lucide-react";
import TaskModal from "../../components/tasksComp/TaskModal";
import TaskCompletionModal from "../../components/tasksComp/TaskCompletionModal";
import { useContacts } from "../../contexts/ContactsContext";

const PRIORITY_ORDER = {
  "Emergency": 4,
  "High": 3,
  "Medium": 2,
  "Low": 1
};

const STATUS_COLORS = {
  "To Do": "bg-gray-100 text-gray-600",
  "In Progress": "bg-blue-100 text-blue-700",
  "Done": "bg-green-100 text-green-700", // Legacy
  "Completed": "bg-emerald-100 text-emerald-700",
  "Terminated": "bg-red-100 text-red-700"
};

const PRIORITY_COLORS = {
  "Emergency": "text-red-600 bg-red-50 border-red-200",
  "High": "text-orange-600 bg-orange-50 border-orange-200",
  "Medium": "text-blue-600 bg-blue-50 border-blue-200",
  "Low": "text-gray-600 bg-gray-50 border-gray-200"
};

const MyTasks = () => {
  const location = useLocation();
  const activeTab = new URLSearchParams(location.search).get("tab") || "my-tasks";
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [completionTask, setCompletionTask] = useState(null); // Task being completed
  const [searchQuery, setSearchQuery] = useState("");
  const { contacts } = useContacts();

  // Mock Data State
  const [tasks, setTasks] = useState([
    {
      id: 1,
      title: "Design Login Page",
      description: "Create a modern login page with glassmorphism.",
      assignee: "Self",
      assigner: "Self",
      status: "In Progress",
      priority: "High",
      dueDate: "2024-11-30",
      project: "Design System"
    },
    {
      id: 2,
      title: "Fix Auth Bug",
      description: "Token expiration issue needs fixing.",
      assignee: "Self",
      assigner: "Self",
      status: "Completed",
      priority: "Emergency",
      dueDate: "2024-11-28",
      project: "Backend",
      completedAt: "2024-11-28T10:00:00Z",
      completionNote: "Fixed by updating the JWT secret."
    },
    {
      id: 3,
      title: "Review PR #123",
      description: "Code review for the new feature.",
      assignee: "Self",
      assigner: "Sarah",
      status: "To Do",
      priority: "Medium",
      dueDate: "2024-12-05",
      project: "Frontend"
    },
    {
      id: 4,
      title: "Update Documentation",
      description: "Update the API docs.",
      assignee: "Bob",
      assigner: "Self",
      status: "In Progress",
      priority: "Low",
      dueDate: "2024-12-01",
      project: "Docs"
    },
  ]);

  // Filter Tasks based on Tab
  const filteredTasks = useMemo(() => {
    let filtered = [];

    // Base Filters
    if (activeTab === "my-tasks") {
      filtered = tasks.filter(t => t.assignee === "Self" && t.assigner === "Self" && t.status !== "Completed");
    } else if (activeTab === "shared-tasks") {
      filtered = tasks.filter(t => t.assignee === "Self" && t.assigner !== "Self" && t.status !== "Completed");
    } else if (activeTab === "assigned-tasks") {
      filtered = tasks.filter(t => t.assigner === "Self" && t.assignee !== "Self" && t.status !== "Completed");
    } else if (activeTab === "completed-tasks") {
      filtered = tasks.filter(t => t.status === "Completed");
    }

    // Search Filter
    if (searchQuery) {
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort by Priority (Active) or Date (Completed)
    if (activeTab === "completed-tasks") {
      return filtered.sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));
    }
    return filtered.sort((a, b) => PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority]);
  }, [tasks, activeTab, searchQuery]);

  const handleAddTask = (newTask) => {
    const taskToAdd = {
      ...newTask,
      assigner: "Self",
    };
    setTasks([taskToAdd, ...tasks]);
  };

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this task?")) {
      setTasks(tasks.filter(t => t.id !== id));
    }
  };

  const handleUpdate = (id, field, value) => {
    if (field === "status" && value === "Completed") {
      // Trigger Completion Modal
      const task = tasks.find(t => t.id === id);
      setCompletionTask(task);
      return;
    }
    setTasks(tasks.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const handleConfirmCompletion = (note) => {
    if (!completionTask) return;

    setTasks(tasks.map(t => t.id === completionTask.id ? {
      ...t,
      status: "Completed",
      completionNote: note,
      completedAt: new Date().toISOString()
    } : t));

    setCompletionTask(null);
  };

  // Permission Checks
  const canEditStatus = activeTab !== "assigned-tasks" && activeTab !== "completed-tasks";
  const canEditPriority = activeTab !== "shared-tasks" && activeTab !== "completed-tasks";
  const canEditDueDate = activeTab !== "shared-tasks" && activeTab !== "completed-tasks";
  const isCompletedTab = activeTab === "completed-tasks";

  return (
    <div className="flex flex-col h-full bg-gray-50/50">

      {/* Header Section */}
      <div className="px-8 py-6 bg-white border-b border-gray-200 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              {activeTab === "my-tasks" && "Personal Tasks"}
              {activeTab === "shared-tasks" && "Incoming Requests"}
              {activeTab === "assigned-tasks" && "Delegated Tasks"}
              {activeTab === "completed-tasks" && <><CheckCircle2 className="text-green-600" /> Completed Tasks</>}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {activeTab === "my-tasks" && "Manage your personal to-do list and priorities."}
              {activeTab === "shared-tasks" && "Track tasks assigned to you by others."}
              {activeTab === "assigned-tasks" && "Monitor tasks you've assigned to your team."}
              {activeTab === "completed-tasks" && "History of all your finished work and accomplishments."}
            </p>
          </div>
          {activeTab !== "completed-tasks" && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-blue-500/30 transition-all hover:scale-105 active:scale-95"
            >
              <Plus size={18} /> New Task
            </button>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4 mt-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search tasks..."
              className="w-full pl-10 pr-4 py-2 bg-gray-100 border-none rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all outline-none text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
              <Filter size={18} />
            </button>
            <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowUpDown size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Task Content */}
      <div className="flex-1 overflow-auto p-6">
        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <CheckCircle2 size={48} className="mb-4 opacity-20" />
            <p className="text-lg font-medium">No tasks found</p>
            <p className="text-sm">
              {activeTab === "completed-tasks" ? "You haven't completed any tasks yet." : "Create a new task to get started."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className={`group bg-white rounded-xl p-5 border shadow-sm hover:shadow-md transition-all duration-200 flex items-start gap-4 ${isCompletedTab ? "border-green-100 bg-green-50/30" : "border-gray-100"}`}
              >
                {/* Status Indicator Strip */}
                <div className={`w-1.5 self-stretch rounded-full ${task.status === "Completed" ? "bg-green-500" :
                    task.priority === "Emergency" ? "bg-red-500" :
                      task.priority === "High" ? "bg-orange-500" :
                        task.priority === "Medium" ? "bg-blue-500" : "bg-gray-300"
                  }`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className={`text-lg font-semibold text-gray-900 truncate pr-4 ${isCompletedTab ? "line-through text-gray-500" : ""}`}>{task.title}</h3>

                    {/* Actions */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Task"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <p className="text-gray-500 text-sm mb-4 line-clamp-2">{task.description}</p>

                  {/* Completion Note Display */}
                  {isCompletedTab && task.completionNote && (
                    <div className="mb-4 p-3 bg-green-100/50 rounded-lg text-sm text-green-800 flex items-start gap-2">
                      <FileText size={14} className="mt-0.5 shrink-0" />
                      <span>"{task.completionNote}"</span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-sm">

                    {/* Project Badge */}
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 text-gray-600 font-medium text-xs">
                      <Flag size={12} /> {task.project}
                    </span>

                    {/* Due Date */}
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <Calendar size={14} />
                      {canEditDueDate ? (
                        <input
                          type="date"
                          value={task.dueDate}
                          onChange={(e) => handleUpdate(task.id, "dueDate", e.target.value)}
                          className="bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none transition-colors cursor-pointer"
                        />
                      ) : (
                        <span>{task.dueDate}</span>
                      )}
                    </div>

                    {/* Assignee/Assigner Info */}
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <User size={14} />
                      {activeTab === "assigned-tasks" ? (
                        <span>Assigned to: <span className="font-medium text-gray-700">{task.assignee}</span></span>
                      ) : activeTab === "shared-tasks" ? (
                        <span>Assigned by: <span className="font-medium text-gray-700">{task.assigner}</span></span>
                      ) : (
                        <span>My Task</span>
                      )}
                    </div>

                  </div>
                </div>

                {/* Controls Column */}
                <div className="flex flex-col items-end gap-3 min-w-[140px]">

                  {/* Status Select */}
                  <div className="relative">
                    <select
                      value={task.status}
                      disabled={!canEditStatus}
                      onChange={(e) => handleUpdate(task.id, "status", e.target.value)}
                      className={`appearance-none pl-3 pr-8 py-1.5 rounded-lg text-xs font-semibold border-0 cursor-pointer outline-none ring-1 ring-inset ring-black/5 ${STATUS_COLORS[task.status]} disabled:opacity-70 disabled:cursor-not-allowed`}
                    >
                      {Object.keys(STATUS_COLORS).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    {canEditStatus && (
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                        <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                      </div>
                    )}
                  </div>

                  {/* Priority Select */}
                  <div className="relative">
                    <select
                      value={task.priority}
                      disabled={!canEditPriority}
                      onChange={(e) => handleUpdate(task.id, "priority", e.target.value)}
                      className={`appearance-none pl-3 pr-8 py-1.5 rounded-lg text-xs font-semibold border-0 cursor-pointer outline-none ring-1 ring-inset ring-black/5 ${PRIORITY_COLORS[task.priority]} disabled:opacity-70 disabled:cursor-not-allowed`}
                    >
                      {Object.keys(PRIORITY_COLORS).map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    {canEditPriority && (
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                        <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <TaskModal
          onClose={() => setIsModalOpen(false)}
          onAddTask={handleAddTask}
          channels={["General", "Design", "Engineering", "Marketing"]}
          teamMembers={contacts.map(c => c.username || c.email)}
        />
      )}

      {completionTask && (
        <TaskCompletionModal
          task={completionTask}
          onClose={() => setCompletionTask(null)}
          onConfirm={handleConfirmCompletion}
        />
      )}
    </div>
  );
};

export default MyTasks;
