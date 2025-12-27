import React, { useState, useEffect } from "react";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import { X, Calendar, User, Flag, Briefcase, AlignLeft, Type, Users, Hash, Link as LinkIcon, Plus, CheckCircle2, Paperclip } from "lucide-react";
import api from "../../services/api";

const priorities = ["Emergency", "High", "Medium", "Low"];

export default function TaskModal({ onClose, onAddTask, onUpdateTask, channels = [], teamMembers = [], initialData = null }) {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [project, setProject] = useState("");
  const [assignmentType, setAssignmentType] = useState("self"); // "self", "individual", "channel"
  const [selectedMembers, setSelectedMembers] = useState([]); // For multi-select
  const [selectedChannel, setSelectedChannel] = useState(""); // For channel assignment
  const [attachments, setAttachments] = useState([]); // { name, url }
  const [newAttachmentUrl, setNewAttachmentUrl] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [status, setStatus] = useState("To Do");
  const [channelMembers, setChannelMembers] = useState([]); // Members of selected project/channel
  const [loadingMembers, setLoadingMembers] = useState(false);
  const isEditing = !!initialData;
  const isReadOnly = isEditing && (initialData?.status === "Completed" || String(initialData?.assignerId) !== String(user?._id));

  // Initialize Data for Editing
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || "");
      setDescription(initialData.description || "");
      setDueDate(initialData.dueDate || "");
      setPriority(initialData.priority || "Medium");
      setAttachments(initialData.attachments || []);

      // Determine Assignment Type & selections
      if (initialData.visibility === "channel") {
        setAssignmentType("channel");
        setProject(initialData.project);
        // selectedChannel logic handled by useEffect below via 'project'
      } else if (initialData.assignees && initialData.assignees.length > 1) {
        setAssignmentType("individual");
        setSelectedMembers(initialData.assignees.map(u => u._id));
      } else if (initialData.assignees && initialData.assignees.length === 1 && initialData.assignees[0]._id !== user._id) {
        setAssignmentType("individual");
        setSelectedMembers([initialData.assignees[0]._id]);
      } else {
        setAssignmentType("self");
      }
      setStatus(initialData.status || "To Do");
    }
  }, [initialData, user]);

  // Fetch channel members when a project/channel is selected
  useEffect(() => {
    const fetchChannelMembers = async () => {
      if (!project) {
        setChannelMembers([]);
        setSelectedChannel("");
        return;
      }

      const selectedChan = channels.find(ch => ch.label === project || ch.id === project);

      // Sync selectedChannel with project context
      if (selectedChan) {
        setSelectedChannel(selectedChan.id);
      } else {
        setSelectedChannel("");
      }

      if (!selectedChan) {
        setChannelMembers(teamMembers);
        return;
      }

      try {
        setLoadingMembers(true);
        const response = await api.get(`/api/channels/${selectedChan.id}/members`);
        setChannelMembers(response.data.members || []);
      } catch (error) {
        console.error("Failed to fetch channel members:", error);
        setChannelMembers(teamMembers);
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchChannelMembers();
  }, [project, channels, teamMembers]);

  // Toggle member selection for multi-select
  const toggleMemberSelection = (memberId) => {
    setSelectedMembers(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleAdd = () => {
    if (!title || !project || !dueDate) {
      return showToast("Please fill in all required fields.", "error");
    }

    // Validate due date
    const selectedDate = new Date(dueDate);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const maxDate = new Date('2100-12-31');

    if (selectedDate < tomorrow) {
      return showToast("Due date must be at least tomorrow", "error");
    }

    if (selectedDate > maxDate) {
      return showToast("Due date cannot exceed year 2100", "error");
    }

    // Validate assignment based on type
    if (assignmentType === "individual" && selectedMembers.length === 0) {
      return showToast("Please select at least one team member", "error");
    }

    if (assignmentType === "channel" && !selectedChannel) {
      return showToast("Please select a channel", "error");
    }

    const taskPayload = {
      title,
      description,
      project,
      assignmentType,
      assignedToIds: assignmentType === "individual" ? selectedMembers : [],
      channelId: assignmentType === "channel" ? selectedChannel : null,
      dueDate,
      priority,
      status,
      attachments, // Include attachments
    };

    if (isEditing && onUpdateTask) {
      onUpdateTask(initialData.id, taskPayload);
    } else {
      onAddTask(taskPayload);
    }
    onClose();
  };

  // Use channel members if available, otherwise use all team members
  const availableMembers = channelMembers.length > 0 ? channelMembers : teamMembers;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md transition-opacity duration-300">
      <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl rounded-3xl w-full max-w-2xl shadow-2xl shadow-blue-900/20 dark:shadow-black/50 transform transition-all scale-100 overflow-hidden border border-white/50 dark:border-gray-800/50 max-h-[85vh] overflow-y-auto custom-scrollbar">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100/50 dark:border-gray-800/50 flex justify-between items-center bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-gray-800/50 dark:to-gray-900/50 sticky top-0 z-10 backdrop-blur-xl">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
            <span className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white p-2 rounded-xl shadow-lg shadow-blue-500/20">
              <Briefcase size={20} />
            </span>
            <span className="tracking-tight">{isEditing ? (isReadOnly ? "Task Details" : "Update Task") : "Create New Task"}</span>
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-all duration-200">
            <X size={24} />
          </button>
        </div>

        {/* Completion Note (if available) */}
        {initialData?.status === "Completed" && initialData?.completionNote && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50/80 border border-emerald-100 rounded-2xl flex flex-col gap-2 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
              <CheckCircle2 size={18} /> Completion Note
            </div>
            <p className="text-emerald-800 text-sm italic pl-6 border-l-2 border-emerald-200">"{initialData.completionNote}"</p>
            {initialData.completedAt && (
              <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider pl-6 self-end">
                Completed on {new Date(initialData.completedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        )}

        {/* Assigner View Warning */}
        {isEditing && !isReadOnly && String(initialData?.assignerId) === String(user?._id) && initialData?.status !== "Completed" && (
          <div className="mx-6 mt-4 p-3 bg-blue-50/50 border border-blue-100 rounded-2xl flex items-center gap-3 text-blue-700 text-xs font-semibold shadow-sm">
            <User size={18} className="text-blue-500" />
            <span>You are the assigner. You have full edit access to this task.</span>
          </div>
        )}

        {/* Assignee View Note */}
        {isEditing && isReadOnly && initialData?.status !== "Completed" && (
          <div className="mx-6 mt-4 p-3 bg-amber-50/50 border border-amber-100 rounded-2xl flex items-center gap-3 text-amber-700 text-xs font-semibold shadow-sm">
            <AlignLeft size={18} className="text-amber-500" /> :
            <span>Read-only mode. Only {initialData.assigner} can modify these details.</span>
          </div>
        )}

        {/* Body */}
        <div className="p-6 space-y-4">

          {/* Title - Floating Label Style */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5 ml-1">
              <Type size={12} /> Task Title
            </label>
            <input
              type="text"
              readOnly={initialData?.status === "Completed"}
              placeholder="What needs to be done?"
              className={`w-full px-4 py-2.5 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-200/60 dark:border-gray-700/60 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-800 transition-all outline-none text-gray-900 dark:text-white font-medium placeholder-gray-400 shadow-sm ${isReadOnly ? "cursor-default opacity-80" : ""}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5 ml-1">
              <AlignLeft size={12} /> Description
            </label>
            <textarea
              readOnly={initialData?.status === "Completed"}
              placeholder="Add comprehensive details, context, and requirements..."
              className={`w-full px-4 py-2.5 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-200/60 dark:border-gray-700/60 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-800 transition-all outline-none text-gray-900 dark:text-white leading-relaxed placeholder-gray-400 min-h-[80px] resize-none shadow-sm ${initialData?.status === "Completed" ? "cursor-default opacity-80" : ""}`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">

            {/* Channel */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5 ml-1">
                <Hash size={12} /> Channel
              </label>
              <div className="relative">
                <select
                  value={project}
                  disabled={isReadOnly}
                  onChange={(e) => setProject(e.target.value)}
                  className={`w-full px-4 py-2.5 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-200/60 dark:border-gray-700/60 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-gray-700 dark:text-gray-200 appearance-none font-medium transition-all shadow-sm ${initialData?.status === "Completed" ? "cursor-default opacity-80" : "hover:bg-gray-100 dark:hover:bg-gray-700/50"}`}
                >
                  <option value="">Select Channel</option>
                  {channels.length > 0 ? channels.map((ch) => (
                    <option key={ch.id} value={ch.label}>{ch.label}</option>
                  )) : (
                    <>
                      <option value="General">General</option>
                      <option value="Development">Development</option>
                      <option value="Design">Design</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {/* Due Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5 ml-1">
                <Calendar size={12} /> Deadline
              </label>
              <input
                type="date"
                readOnly={isReadOnly}
                className={`w-full px-4 py-2.5 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-200/60 dark:border-gray-700/60 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-gray-700 dark:text-gray-200 font-medium shadow-sm transition-all ${isReadOnly ? "cursor-default opacity-80" : "hover:bg-gray-100 dark:hover:bg-gray-700/50"}`}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0]}
                max="2100-12-31"
              />
            </div>
          </div>

          {/* Assignment Type */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5 ml-1">
              <User size={12} /> Assign To
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "self", icon: User, label: "Me" },
                { id: "individual", icon: Users, label: "Member(s)" },
                { id: "channel", icon: Hash, label: "Full Channel" }
              ].map((type) => (
                <button
                  key={type.id}
                  type="button"
                  disabled={isReadOnly}
                  onClick={() => {
                    if (type.id === "self") setSelectedMembers([]);
                    if (type.id === "channel") setSelectedMembers([]);
                    setAssignmentType(type.id);
                  }}
                  className={`px-3 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 border ${assignmentType === type.id
                    ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30 scale-[1.02]"
                    : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    } ${isReadOnly && assignmentType !== type.id ? "hidden" : ""} ${isReadOnly && assignmentType === type.id ? "w-full col-span-3 cursor-default" : ""}`}
                >
                  <type.icon size={16} /> {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Individual Assignment - Multi-select */}
          {assignmentType === "individual" && (
            <div className="space-y-2 max-h-36 overflow-y-auto border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-3 bg-gray-50/30 dark:bg-gray-800/30 custom-scrollbar shadow-inner">
              {loadingMembers ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2 font-medium animate-pulse">Loading directory...</p>
              ) : availableMembers.length > 0 ? (
                availableMembers.map((member) => {
                  const memberId = member._id || member.id;
                  const isSelected = selectedMembers.includes(memberId);
                  return (
                    <label
                      key={memberId}
                      className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all ${isSelected ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800" : "hover:bg-white dark:hover:bg-gray-700 hover:shadow-sm border border-transparent"}`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? "bg-blue-500 border-blue-500" : "bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"}`}>
                        {isSelected && <CheckCircle2 size={12} className="text-white" />}
                      </div>
                      <input
                        type="checkbox"
                        disabled={isReadOnly}
                        checked={isSelected}
                        onChange={() => toggleMemberSelection(memberId)}
                        className="hidden"
                      />
                      <span className={`text-xs font-medium ${isSelected ? "text-blue-700 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"}`}>{member.username || member.email}</span>
                    </label>
                  );
                })
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">No team members available</p>
              )}
            </div>
          )}

          {/* Channel Assignment */}
          {assignmentType === "channel" && (
            <div className="space-y-2 p-3 bg-blue-50/30 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-800/30 rounded-2xl">
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm"
                disabled={initialData?.status === "Completed" || (!!project && channels.some(ch => ch.label === project || ch.id === project))}
              >
                <option value="">Select Target Channel</option>
                {channels.length > 0 ? channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>{ch.label}</option>
                )) : (
                  <>
                    <option value="general">General</option>
                    <option value="dev">Development</option>
                  </>
                )}
              </select>
              {selectedChannel && (
                <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1.5 px-1 font-medium">
                  <Users size={12} /> Everyone in this channel will be notified.
                </p>
              )}
            </div>
          )}

          {/* Priority */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5 ml-1">
              <Flag size={12} /> Urgency Level
            </label>
            <div className="relative">
              <select
                value={priority}
                disabled={initialData?.status === "Completed"}
                onChange={(e) => setPriority(e.target.value)}
                className={`w-full px-4 py-2.5 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-200/60 dark:border-gray-700/60 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none font-medium transition-all shadow-sm ${priority === "Emergency" ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50" :
                  priority === "High" ? "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/50" :
                    "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                  } ${initialData?.status === "Completed" ? "cursor-default opacity-80" : ""}`}
              >
                {priorities.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Attachments Section */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5 ml-1">
              <Paperclip size={12} /> Resources
            </label>
            <div className="space-y-2 bg-gray-50/30 dark:bg-gray-800/30 p-3 rounded-2xl border border-gray-200/50 dark:border-gray-700/50">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Paste URL (e.g., https://figma.com/...)"
                  value={newAttachmentUrl}
                  onChange={e => setNewAttachmentUrl(e.target.value)}
                  className="flex-1 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm text-gray-900 dark:text-white"
                />
                <button
                  onClick={() => {
                    if (!newAttachmentUrl) return;
                    setAttachments([...attachments, { name: newAttachmentUrl, url: newAttachmentUrl, type: 'link' }]);
                    setNewAttachmentUrl("");
                  }}
                  className="p-2 bg-gray-900 dark:bg-gray-700 text-white rounded-xl hover:bg-gray-800 dark:hover:bg-gray-600 transition-all shadow-lg shadow-gray-900/20 active:scale-95"
                >
                  <Plus size={18} />
                </button>
              </div>

              {attachments.length > 0 && (
                <div className="flex flex-col gap-2">
                  {attachments.map((att, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm p-2 bg-white dark:bg-gray-800 border border-blue-100 dark:border-gray-700 rounded-xl shadow-sm text-blue-700 dark:text-blue-400 hover:shadow-md transition-shadow group">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <LinkIcon size={14} className="shrink-0 text-blue-400" />
                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="truncate font-medium hover:underline">
                          {att.name || att.url}
                        </a>
                      </div>
                      <button onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))} className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-all">
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50/80 dark:bg-gray-800/80 backdrop-blur-md border-t border-gray-200/60 dark:border-gray-700/60 flex justify-between gap-4 sticky bottom-0 z-10">
          {/* Status (Hidden unless editing) */}
          {/* If needed, status dropdown could go here, but usually managed in dashboard */}
          <div></div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl text-gray-600 dark:text-gray-300 font-bold text-sm hover:bg-gray-200/80 dark:hover:bg-gray-700/80 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              className={`px-6 py-2.5 rounded-xl bg-gradient-to-r from-gray-900 to-gray-800 dark:from-blue-600 dark:to-blue-700 text-white font-bold text-sm shadow-xl shadow-gray-900/20 dark:shadow-blue-900/40 hover:shadow-gray-900/30 hover:scale-[1.02] transition-all active:scale-95 flex items-center gap-2 ${isReadOnly ? "hidden" : ""}`}
            >
              {isEditing ? "Update Task" : "Create Task"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
