import React, { useState, useMemo, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  Plus, Search, Calendar, Flag,
  CheckCircle2, Trash2, User, ArrowUpDown, FileText, RotateCcw
} from "lucide-react";
import TaskModal from "../../components/tasksComp/TaskModal";
import TaskCompletionModal from "../../components/tasksComp/TaskCompletionModal";
import TransferRequestModal from "../../components/tasksComp/TransferRequestModal";
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
  "To Do": "text-gray-600 bg-gray-100 hover:bg-gray-200",
  "In Progress": "text-blue-600 bg-blue-50 hover:bg-blue-100",
  "Completed": "text-emerald-600 bg-emerald-50 hover:bg-emerald-100",
  "Cancelled": "text-red-600 bg-red-50 hover:bg-red-100"
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
  const [completionTask, setCompletionTask] = useState(null);
  const [deletionTask, setDeletionTask] = useState(null);
  const [transferRequestTask, setTransferRequestTask] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { members, channels } = useContacts();
  const { tasks, loading, createTask, updateTask, deleteTask, restoreTask, permanentlyDeleteTask, handleTransferResponse } = useTasks();
  const { user } = useAuth();

  const [sortOrder, setSortOrder] = useState("priority");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentUserId = user?._id || user?.id;

  const filteredTasks = useMemo(() => {
    let filtered = [];

    if (activeTab === "deleted-tasks") {
      filtered = tasks.filter(t => t.deleted);
    } else {
      const activeTasks = tasks.filter(t => !t.deleted);

      const isAssignee = (t) => {
        if (t.assignees && t.assignees.length > 0) {
          return t.assignees.some(a => String(a._id || a.id) === String(currentUserId));
        }
        return String(t.assigneeId) === String(currentUserId);
      };

      if (activeTab === "my-tasks") {
        filtered = activeTasks.filter(t => isAssignee(t) && t.assignerId === currentUserId && t.status !== "Completed");
      } else if (activeTab === "shared-tasks") {
        filtered = activeTasks.filter(t => isAssignee(t) && t.assignerId !== currentUserId && t.status !== "Completed");
      } else if (activeTab === "assigned-tasks") {
        filtered = activeTasks.filter(t => t.assignerId === currentUserId && !isAssignee(t) && t.status !== "Completed");
      } else if (activeTab === "completed-tasks") {
        filtered = activeTasks.filter(t => t.status === "Completed");
      }
    }

    if (searchQuery) {
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

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
  }, [tasks, activeTab, searchQuery, sortOrder, currentUserId]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTask(null);
  };

  const handleDoubleClick = (task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleAddTask = async (newTask) => {
    await createTask(newTask);
    setIsModalOpen(false);
  };

  const handleDelete = (id) => {
    const task = tasks.find(t => t.id === id);
    setDeletionTask(task);
  };

  const handleTransferRequest = async (newAssigneeId, note) => {
    try {
      const response = await fetch(`http://localhost:5000/api/tasks/${transferRequestTask.id}/transfer-request`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          newAssigneeId: newAssigneeId,  // Backend expects 'newAssigneeId', not 'requestedTo'
          note: note
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send transfer request');
      }

      setTransferRequestTask(null);
      alert("Transfer request sent to assigner!");
    } catch (error) {
      console.error("Failed to send transfer request:", error);
      alert(`Failed to send transfer request: ${error.message}`);
    }
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
    if (field === "status" && (value === "Completed" || value === "done")) {
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

  const canEditStatus = activeTab !== "assigned-tasks" && activeTab !== "completed-tasks" && activeTab !== "deleted-tasks";
  const canEditPriority = activeTab !== "shared-tasks" && activeTab !== "completed-tasks" && activeTab !== "deleted-tasks";
  const canEditDueDate = activeTab !== "shared-tasks" && activeTab !== "completed-tasks" && activeTab !== "deleted-tasks";
  const isCompletedTab = activeTab === "completed-tasks";
  const isDeletedTab = activeTab === "deleted-tasks";

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900/50 overflow-hidden font-sans selection:bg-blue-100 selection:text-blue-900">

      {/* Glassmorphic Header - Sticky & Blurred */}
      <div className="shrink-0 px-8 py-5 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-700/60 z-20 sticky top-0 transition-all duration-300">
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent flex items-center gap-3">
                {activeTab === "my-tasks" && "Personal Tasks"}
                {activeTab === "shared-tasks" && "Incoming Requests"}
                {activeTab === "assigned-tasks" && "Delegated Tasks"}
                {activeTab === "completed-tasks" && <><CheckCircle2 className="text-emerald-500" size={28} /> Completed</>}
                {activeTab === "deleted-tasks" && <><Trash2 className="text-rose-500" size={28} /> Trash Bin</>}
              </h1>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {activeTab === "my-tasks" && "Manage your priorities effectively."}
                {activeTab === "shared-tasks" && "Collaborate on tasks assigned to you."}
                {activeTab === "assigned-tasks" && "Oversee team progress."}
                {activeTab === "completed-tasks" && "Your history of accomplishments."}
                {activeTab === "deleted-tasks" && "Recover or permanently remove items."}
              </p>
            </div>

            {activeTab !== "completed-tasks" && activeTab !== "deleted-tasks" && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="group relative inline-flex items-center gap-2 bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-6 py-2.5 rounded-2xl font-semibold shadow-lg shadow-blue-500/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-blue-500/50 active:scale-95"
              >
                <Plus size={20} className="stroke-[2.5]" />
                <span>New Task</span>
              </button>
            )}
          </div>

          {/* Interactive Toolbar */}
          <div className="flex items-center gap-4">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-lg group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Search className="text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
              </div>
              <input
                type="text"
                placeholder="Search tasks..."
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700/50 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-sm font-medium text-gray-900 dark:text-white placeholder-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Sort Menu */}
            <div className="relative" ref={sortMenuRef}>
              <button
                onClick={() => setShowSortMenu(!showSortMenu)}
                className={`flex items-center justify-center p-2.5 rounded-xl border transition-all duration-200 font-medium text-sm ${showSortMenu
                  ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300"
                  : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300"
                  } shadow-sm`}
                title="Sort"
              >
                <ArrowUpDown size={18} />
              </button>

              {showSortMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-black/50 border border-gray-100 dark:border-gray-700 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                  {[
                    { id: "priority", label: "Priority (High-Low)" },
                    { id: "dueDate", label: "Due Date (Soonest)" },
                    { id: "status", label: "Status" },
                    { id: "a-z", label: "Alphabetical" }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => { setSortOrder(opt.id); setShowSortMenu(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-between ${sortOrder === opt.id
                        ? "text-blue-600 bg-blue-50 dark:bg-blue-900/20"
                        : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        }`}
                    >
                      {opt.label}
                      {sortOrder === opt.id && <CheckCircle2 size={14} className="text-blue-500" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-8 scroll-smooth custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[50vh] text-gray-400 animate-in fade-in duration-700">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-blue-100 rounded-full animate-spin border-t-blue-600"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 bg-white rounded-full"></div>
              </div>
            </div>
            <p className="mt-6 text-lg font-medium text-gray-500">Syncing your tasks...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[50vh] text-center max-w-sm mx-auto">
            <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6 shadow-inner">
              {isDeletedTab ? <Trash2 size={40} className="text-gray-400" /> : <CheckCircle2 size={40} className="text-gray-400 opacity-60" />}
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {activeTab === "completed-tasks" ? "No completed tasks yet" :
                activeTab === "deleted-tasks" ? "Trash is empty" : "All Caught Up!"}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
              {activeTab === "completed-tasks" ? "Start checking off items to build your history." :
                activeTab === "deleted-tasks" ? "Items you delete will show up here." : "You have no active tasks in this view. Enjoy your free time or creating a new task."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 max-w-full">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                onDoubleClick={() => handleDoubleClick(task)}
                className={`group relative bg-white dark:bg-gray-800 rounded-2xl p-4 pl-5 border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl overflow-hidden ${isCompletedTab
                  ? "border-emerald-100 bg-emerald-50/30 dark:border-emerald-900/30 dark:bg-emerald-900/10"
                  : isDeletedTab
                    ? "border-red-100 bg-red-50/30 dark:border-red-900/30 dark:bg-red-900/10"
                    : "border-gray-100 dark:border-gray-700/50 shadow-sm hover:border-blue-200/50 dark:hover:border-blue-900/30"
                  }`}
              >
                {/* Modern Vertical Priority Strip */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-colors ${task.priority === "Emergency" ? "bg-red-500" :
                  task.priority === "High" ? "bg-orange-500" :
                    task.priority === "Medium" ? "bg-blue-500" : "bg-gray-300"
                  }`} />

                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  {/* Main Content */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className={`text-lg font-bold text-gray-900 dark:text-white truncate transition-colors ${isCompletedTab || isDeletedTab ? "line-through opacity-60" : "group-hover:text-blue-600 dark:group-hover:text-blue-400"
                        }`}>
                        {task.title}
                      </h3>

                      {/* Action Icons (Hover Reveal) */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        {isDeletedTab ? (
                          <>
                            <button onClick={() => handleRestore(task.id)} className="p-2 hover:bg-green-100 text-green-600 rounded-lg transition-colors" title="Restore"><RotateCcw size={16} /></button>
                            <button onClick={() => handlePermanentDelete(task.id)} className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition-colors" title="Forever Delete"><Trash2 size={16} /></button>
                          </>
                        ) : activeTab === "shared-tasks" ? (
                          // Incoming tasks: show Transfer Request button + delete only if completed
                          <>
                            {task.transferRequest?.status === 'pending' ? (
                              <div className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-xs rounded-md font-semibold whitespace-nowrap">
                                Transfer Pending
                              </div>
                            ) : (
                              <button
                                onClick={() => setTransferRequestTask(task)}
                                className="p-2 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
                                title="Request Transfer"
                              >
                                <RotateCcw size={16} />
                              </button>
                            )}
                            {task.status === "Completed" && (
                              <button onClick={() => handleDelete(task.id)} className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors" title="Delete"><Trash2 size={16} /></button>
                            )}
                          </>
                        ) : (
                          // All other tabs: show delete normally
                          <button onClick={() => handleDelete(task.id)} className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors" title="Delete"><Trash2 size={16} /></button>
                        )}
                      </div>
                    </div>

                    <p className={`text-sm text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed ${(isCompletedTab || isDeletedTab) && "opacity-60"
                      }`}>
                      {task.description || <span className="italic text-gray-400">No description provided.</span>}
                    </p>

                    {/* Completion Note */}
                    {task.status === "Completed" && task.completionNote && (
                      <div className="mt-2 text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-3 py-2 rounded-lg border border-emerald-100 dark:border-emerald-800 flex items-start gap-2">
                        <FileText size={14} className="mt-0.5 shrink-0" />
                        <span className="font-medium">"{task.completionNote}"</span>
                      </div>
                    )}

                    {/* Meta Tags Row */}
                    <div className="flex flex-wrap items-center gap-4 pt-1">
                      {/* Project */}
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 bg-gray-100/80 dark:bg-gray-700/50 px-2.5 py-1 rounded-md">
                        <Flag size={12} /> {task.project}
                      </div>

                      {/* Due Date */}
                      <div className={`flex items-center gap-1.5 text-xs font-medium ${new Date(task.dueDate) < new Date() && !isCompletedTab ? "text-red-500 bg-red-50 px-2 py-1 rounded-md" : "text-gray-500"
                        }`}>
                        <Calendar size={13} />
                        {canEditDueDate ? (
                          <input
                            type="date"
                            value={task.dueDate}
                            onChange={(e) => handleUpdate(task.id, "dueDate", e.target.value)}
                            className="bg-transparent border-0 p-0 text-inherit focus:ring-0 cursor-pointer h-5"
                          />
                        ) : (
                          <span>{task.dueDate}</span>
                        )}
                      </div>

                      {/* Assignment Info */}
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <User size={13} />
                        {activeTab === "assigned-tasks" ? (
                          <span>To: <span className="font-semibold text-gray-700 dark:text-gray-300">{task.assignee}</span></span>
                        ) : activeTab === "shared-tasks" ? (
                          <span>From: <span className="font-semibold text-gray-700 dark:text-gray-300">{task.assigner}</span></span>
                        ) : (
                          <span>{task.assignees && task.assignees.length > 1 ? "Team Task" : "Personal"}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="flex flex-col items-end gap-3 md:w-36 shrink-0">
                    {/* Transfer Request Action (Assigner View) */}
                    {activeTab === "assigned-tasks" && task.transferRequest?.status === "pending" && (
                      <div className="w-full bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-xl p-3 flex flex-col gap-2 shadow-sm">
                        <div className="flex items-center gap-1 text-xs font-semibold text-purple-700 dark:text-purple-300">
                          <RotateCcw size={12} />
                          <span>Transfer Request</span>
                        </div>
                        <p className="text-[10px] text-gray-500 leading-tight">
                          To: <span className="font-medium text-gray-700 dark:text-gray-300">{task.transferRequest.requestedTo?.username || "Unknown"}</span>
                        </p>
                        {task.transferRequest.note && (
                          <p className="text-[10px] italic text-gray-500 line-clamp-2">"{task.transferRequest.note}"</p>
                        )}
                        <div className="flex gap-2 mt-1">
                          <button
                            onClick={() => handleTransferResponse(task.id, 'approve')}
                            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-xs py-1.5 rounded-lg font-medium transition-colors shadow-sm"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleTransferResponse(task.id, 'reject')}
                            className="flex-1 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-xs py-1.5 rounded-lg font-medium transition-colors shadow-sm"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    )}
                    {/* Custom Selectors Styled as Badges */}
                    <div className="relative w-full">
                      <select
                        value={task.status}
                        disabled={!canEditStatus}
                        onChange={(e) => handleUpdate(task.id, "status", e.target.value)}
                        className={`w-full appearance-none py-1.5 pl-3 pr-6 rounded-lg text-xs font-bold border-0 cursor-pointer outline-none transition-all ${STATUS_COLORS[task.status]} shadow-sm ring-1 ring-inset ring-black/5 hover:ring-black/10`}
                      >
                        {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>

                    <div className="relative w-full">
                      <select
                        value={task.priority}
                        disabled={!canEditPriority}
                        onChange={(e) => handleUpdate(task.id, "priority", e.target.value)}
                        className={`w-full appearance-none py-1.5 pl-3 pr-6 rounded-lg text-xs font-bold border-0 cursor-pointer outline-none transition-all ${PRIORITY_COLORS[task.priority]} shadow-sm ring-1 ring-inset ring-black/5 hover:ring-black/10`}
                      >
                        {Object.keys(PRIORITY_COLORS).map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <TaskModal
          onClose={handleCloseModal}
          onAddTask={handleAddTask}
          onUpdateTask={updateTask}
          initialData={editingTask}
          channels={channels || []}
          teamMembers={members || []}
        />
      )}

      {/* Completion Modal */}
      {completionTask && (
        <TaskCompletionModal
          task={completionTask}
          onClose={() => setCompletionTask(null)}
          onConfirm={handleConfirmCompletion}
          mode="completion"
        />
      )}

      {/* Transfer Request Modal */}
      {transferRequestTask && (
        <TransferRequestModal
          task={transferRequestTask}
          members={members}
          onClose={() => setTransferRequestTask(null)}
          onConfirm={handleTransferRequest}
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
