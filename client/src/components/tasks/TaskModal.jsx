import React, { useState } from "react";
import { X, Calendar, User, Flag, Briefcase, AlignLeft, Type } from "lucide-react";

const priorities = ["Emergency", "High", "Medium", "Low"];

export default function TaskModal({ onClose, onAddTask, channels = [], teamMembers = [] }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [project, setProject] = useState("");
  const [assigneeType, setAssigneeType] = useState("Self"); // Self or Others
  const [assignee, setAssignee] = useState("Self");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [status] = useState("To Do");

  const handleAdd = () => {
    if (!title || !project || !dueDate) return alert("Please fill in all required fields.");

    const finalAssignee = assigneeType === "Self" ? "Self" : assignee;

    const newTask = {
      id: Date.now(), // Temporary ID
      title,
      description,
      project,
      assignee: finalAssignee,
      dueDate,
      priority,
      status,
      createdAt: new Date().toISOString(),
    };

    onAddTask(newTask);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl transform transition-all scale-100 overflow-hidden border border-gray-100">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span className="bg-blue-600 text-white p-1.5 rounded-lg shadow-sm">
              <Briefcase size={18} />
            </span>
            New Task
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 p-1 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">

          {/* Title */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
              <Type size={14} /> Title
            </label>
            <input
              type="text"
              placeholder="What needs to be done?"
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-gray-800 placeholder-gray-400"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
              <AlignLeft size={14} /> Description
            </label>
            <textarea
              placeholder="Add details about this task..."
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-gray-800 placeholder-gray-400 min-h-[80px] resize-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-5">

            {/* Project / Channel */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <Briefcase size={14} /> Project / Channel
              </label>
              <select
                value={project}
                onChange={(e) => setProject(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-gray-700 appearance-none"
              >
                <option value="">Select Context</option>
                {channels.length > 0 ? channels.map((c) => (
                  <option key={c} value={c}>{c}</option>
                )) : (
                  <>
                    <option value="General">General</option>
                    <option value="Development">Development</option>
                    <option value="Design">Design</option>
                  </>
                )}
              </select>
            </div>

            {/* Due Date */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <Calendar size={14} /> Due Date
              </label>
              <input
                type="date"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-gray-700"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            {/* Assignee */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <User size={14} /> Assign To
              </label>
              <div className="flex gap-2">
                <select
                  value={assigneeType}
                  onChange={(e) => setAssigneeType(e.target.value)}
                  className="w-1/3 px-2 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-gray-700 text-sm"
                >
                  <option value="Self">Self</option>
                  <option value="Others">Others</option>
                </select>

                {assigneeType === "Others" && (
                  <select
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                    className="w-2/3 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-gray-700"
                  >
                    <option value="">Select Person</option>
                    {teamMembers.length > 0 ? teamMembers.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    )) : (
                      <>
                        <option value="Alice">Alice</option>
                        <option value="Bob">Bob</option>
                        <option value="Charlie">Charlie</option>
                      </>
                    )}
                  </select>
                )}
                {assigneeType === "Self" && (
                  <div className="w-2/3 px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 flex items-center">
                    Me
                  </div>
                )}
              </div>
            </div>

            {/* Priority */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <Flag size={14} /> Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-gray-700"
              >
                {priorities.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-gray-600 font-medium hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 hover:scale-[1.02] transition-all active:scale-95"
          >
            Create Task
          </button>
        </div>

      </div>
    </div>
  );
}
