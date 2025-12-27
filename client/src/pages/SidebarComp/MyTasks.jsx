import React, { useState, useMemo, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  Plus, Search, Calendar, Flag,
  CheckCircle2, Trash2, User, ArrowUpDown, FileText, RotateCcw
} from "lucide-react";
import TaskModal from "../../components/tasksComp/TaskModal";
import TaskCompletionModal from "../../components/tasksComp/TaskCompletionModal";
import { useContacts } from "../../contexts/ContactsContext";
import { useTasks } from "../../contexts/TasksContext";
import { useAuth } from "../../contexts/AuthContext";

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
  const [deletionTask, setDeletionTask] = useState(null); // Task being deleted
  const [searchQuery, setSearchQuery] = useState("");
  const { members, channels } = useContacts(); // Get workspace members and channels
  const { tasks, loading, createTask, updateTask, deleteTask, restoreTask, permanentlyDeleteTask } = useTasks();
  const { user } = useAuth();

  const [sortOrder, setSortOrder] = useState("priority");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef(null);

  // Close sort menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Get current user's username for filtering
  const currentUsername = user?.username || "Unknown";

  // Filter Tasks based on Tab
  const filteredTasks = useMemo(() => {
    let filtered = [];

    // Base Filters
    if (activeTab === "deleted-tasks") {
      filtered = tasks.filter(t => t.deleted);
    } else {
      // For all other tabs, exclude deleted tasks
      const activeTasks = tasks.filter(t => !t.deleted);

      if (activeTab === "my-tasks") {
        filtered = activeTasks.filter(t => t.assignee === currentUsername && t.assigner === currentUsername && t.status !== "Completed");
      } else if (activeTab === "shared-tasks") {
        filtered = activeTasks.filter(t => t.assignee === currentUsername && t.assigner !== currentUsername && t.status !== "Completed");
      } else if (activeTab === "assigned-tasks") {
        filtered = activeTasks.filter(t => t.assigner === currentUsername && t.assignee !== currentUsername && t.status !== "Completed");
      } else if (activeTab === "completed-tasks") {
        filtered = activeTasks.filter(t => t.status === "Completed");
      }
    }

    // Search Filter
    if (searchQuery) {
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sorting Logic
    return filtered.sort((a, b) => {
      if (sortOrder === "priority") {
        return PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
      } else if (sortOrder === "dueDate") {
        return new Date(a.dueDate || 0) - new Date(b.dueDate || 0);
      } else if (sortOrder === "status") {
        return (a.status || "").localeCompare(b.status || "");
      } else if (sortOrder === "a-z") {
        return (a.title || "").localeCompare(b.title || "");
      }
      return 0;
    });
  }, [tasks, activeTab, searchQuery, sortOrder, currentUsername]);

  const handleAddTask = async (newTask) => {
    await createTask(newTask);
    setIsModalOpen(false);
  };

  const handleDelete = (id) => {
    const task = tasks.find(t => t.id === id);
    setDeletionTask(task);
  };

  const handleConfirmDeletion = () => {
    if (!deletionTask) return;
    deleteTask(deletionTask.id);
    setDeletionTask(null);
  };

  const handleRestore = (id) => {
    restoreTask(id);
  };

  const handlePermanentDelete = (id) => {
    if (window.confirm("Are you sure you want to permanently delete this task? This cannot be undone.")) {
      permanentlyDeleteTask(id);
    }
  };

  const handleUpdate = (id, field, value) => {
    if (field === "status" && value === "Completed") {
      // Trigger Completion Modal
      const task = tasks.find(t => t.id === id);
      setCompletionTask(task);
      return;
    }
    updateTask(id, { [field]: value });
  };

  const handleConfirmCompletion = (note) => {
    if (!completionTask) return;

    updateTask(completionTask.id, {
      status: "Completed",
      completionNote: note,
      completedAt: new Date().toISOString()
    });

    setCompletionTask(null);
  };

  // Permission Checks
  const canEditStatus = activeTab !== "assigned-tasks" && activeTab !== "completed-tasks" && activeTab !== "deleted-tasks";
  const canEditPriority = activeTab !== "shared-tasks" && activeTab !== "completed-tasks" && activeTab !== "deleted-tasks";
  const canEditDueDate = activeTab !== "shared-tasks" && activeTab !== "completed-tasks" && activeTab !== "deleted-tasks";
  const isCompletedTab = activeTab === "completed-tasks";
  const isDeletedTab = activeTab === "deleted-tasks";

  return (
    <div className="flex flex-col h-full bg-gray-50/50 dark:bg-gray-900">

      {/* Header Section */}
      <div className="px-8 py-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
              {activeTab === "my-tasks" && "Personal Tasks"}
              {activeTab === "shared-tasks" && "Incoming Requests"}
              {activeTab === "assigned-tasks" && "Delegated Tasks"}
              {activeTab === "completed-tasks" && <><CheckCircle2 className="text-green-600" /> Completed Tasks</>}
              {activeTab === "deleted-tasks" && <><Trash2 className="text-red-600 dark:text-red-400" /> Deleted Tasks</>}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {activeTab === "my-tasks" && "Manage your personal to-do list and priorities."}
              {activeTab === "shared-tasks" && "Track tasks assigned to you by others."}
              {activeTab === "assigned-tasks" && "Monitor tasks you've assigned to your team."}
              {activeTab === "completed-tasks" && "History of all your finished work and accomplishments."}
              {activeTab === "deleted-tasks" && "View and restore deleted tasks."}
            </p>
          </div>
          {activeTab !== "completed-tasks" && activeTab !== "deleted-tasks" && (
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
              className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700/50 border-none rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-gray-700 transition-all outline-none text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 relative" ref={sortMenuRef}>
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className={`p-2 rounded-lg transition-colors ${showSortMenu ? "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50"}`}
              title="Sort Tasks"
            >
              <ArrowUpDown size={18} />
            </button>

            {showSortMenu && (
              <div className="absolute right-0 top-full mt-2 w-40 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-1 z-20 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                <button onClick={() => { setSortOrder("priority"); setShowSortMenu(false); }} className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${sortOrder === "priority" ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" : "text-gray-700 dark:text-gray-300"}`}>Priority (High-Low)</button>
                <button onClick={() => { setSortOrder("dueDate"); setShowSortMenu(false); }} className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${sortOrder === "dueDate" ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" : "text-gray-700 dark:text-gray-300"}`}>Due Date</button>
                <button onClick={() => { setSortOrder("status"); setShowSortMenu(false); }} className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${sortOrder === "status" ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" : "text-gray-700 dark:text-gray-300"}`}>Status</button>
                <button onClick={() => { setSortOrder("a-z"); setShowSortMenu(false); }} className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${sortOrder === "a-z" ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" : "text-gray-700 dark:text-gray-300"}`}>Alphabetical (A-Z)</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Task Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <CheckCircle2 size={48} className="mb-4 opacity-20 animate-pulse" />
            <p className="text-lg font-medium">Loading tasks...</p>
            <p className="text-sm">Please wait while we fetch your tasks.</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            {isDeletedTab ? <Trash2 size={48} className="mb-4 opacity-20" /> : <CheckCircle2 size={48} className="mb-4 opacity-20" />}
            <p className="text-lg font-medium">No tasks found</p>
            <p className="text-sm">
              {activeTab === "completed-tasks" ? "You haven't completed any tasks yet." :
                activeTab === "deleted-tasks" ? "Trash is empty." : "Create a new task to get started."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className={`group bg-white dark:bg-gray-800 rounded-xl p-5 border shadow-sm hover:shadow-md transition-all duration-200 flex items-start gap-4 ${isCompletedTab ? "border-green-100 dark:border-green-900/30 bg-green-50/30 dark:bg-green-900/10" : isDeletedTab ? "border-red-100 dark:border-red-900/30 bg-red-50/30 dark:bg-red-900/10" : "border-gray-100 dark:border-gray-700"}`}
              >
                {/* Status Indicator Strip */}
                <div className={`w-1.5 self-stretch rounded-full ${task.status === "Completed" ? "bg-green-500" :
                  task.priority === "Emergency" ? "bg-red-500" :
                    task.priority === "High" ? "bg-orange-500" :
                      task.priority === "Medium" ? "bg-blue-500" : "bg-gray-300"
                  }`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className={`text-lg font-semibold text-gray-900 dark:text-gray-100 truncate pr-4 ${isCompletedTab || isDeletedTab ? "line-through text-gray-500 dark:text-gray-500" : ""}`}>{task.title}</h3>

                    {/* Actions */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isDeletedTab ? (
                        <>
                          <button
                            onClick={() => handleRestore(task.id)}
                            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                            title="Restore Task"
                          >
                            <RotateCcw size={16} />
                          </button>
                          <button
                            onClick={() => handlePermanentDelete(task.id)}
                            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Delete Permanently"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleDelete(task.id)}
                          className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete Task"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-gray-500 dark:text-gray-400 text-sm mb-4 line-clamp-2">{task.description}</p>

                  {/* Completion Note Display */}
                  {isCompletedTab && task.completionNote && (
                    <div className="mb-4 p-3 bg-green-100/50 dark:bg-green-900/20 rounded-lg text-sm text-green-800 dark:text-green-300 flex items-start gap-2">
                      <FileText size={14} className="mt-0.5 shrink-0" />
                      <span>"{task.completionNote}"</span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-sm">

                    {/* Project Badge */}
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 font-medium text-xs">
                      <Flag size={12} /> {task.project}
                    </span>

                    {/* Due Date */}
                    <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                      <Calendar size={14} />
                      {canEditDueDate ? (
                        <input
                          type="date"
                          value={task.dueDate}
                          onChange={(e) => handleUpdate(task.id, "dueDate", e.target.value)}
                          className="bg-transparent border-b border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-blue-500 outline-none transition-colors cursor-pointer dark:text-gray-300"
                        />
                      ) : (
                        <span>{task.dueDate}</span>
                      )}
                    </div>

                    {/* Assignee/Assigner Info */}
                    <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                      <User size={14} />
                      {activeTab === "assigned-tasks" ? (
                        <span>Assigned to: <span className="font-medium text-gray-700 dark:text-gray-300">{task.assignee}</span></span>
                      ) : activeTab === "shared-tasks" ? (
                        <span>Assigned by: <span className="font-medium text-gray-700 dark:text-gray-300">{task.assigner}</span></span>
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
          channels={channels || []}
          teamMembers={members || []}
        />
      )}

      {completionTask && (
        <TaskCompletionModal
          task={completionTask}
          onClose={() => setCompletionTask(null)}
          onConfirm={handleConfirmCompletion}
          mode="completion"
        />
      )}

      {deletionTask && (
        <TaskCompletionModal
          task={deletionTask}
          onClose={() => setDeletionTask(null)}
          onConfirm={handleConfirmDeletion}
          mode="deletion"
        />
      )}
    </div>
  );
};

export default MyTasks;
