import React, { useState, useEffect, useRef } from "react";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import {
  X, Calendar, User, Flag, Briefcase, AlignLeft, Type,
  Users, Hash, Link as LinkIcon, Plus, CheckCircle2,
  Paperclip, ChevronDown, AlertCircle, AlertTriangle,
  Minus, ArrowDown, Clock, Zap, Tag, MoreHorizontal,
  Edit3, Eye, Shield, Check, Loader2
} from "lucide-react";
import api from '@services/api';

const priorities = ["Emergency", "High", "Medium", "Low"];

const statuses = ["To Do", "In Progress", "In Review", "Completed", "Blocked"];

const PRIORITY_CONFIG = {
  Emergency: {
    color: "text-red-600",
    bg: "bg-red-50 dark:bg-red-900/20",
    border: "border-red-200 dark:border-red-800/50",
    dot: "bg-red-500",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
    Icon: AlertCircle,
    iconColor: "text-red-500",
  },
  High: {
    color: "text-orange-600",
    bg: "bg-orange-50 dark:bg-orange-900/20",
    border: "border-orange-200 dark:border-orange-800/50",
    dot: "bg-orange-500",
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
    Icon: AlertTriangle,
    iconColor: "text-orange-500",
  },
  Medium: {
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    border: "border-amber-200 dark:border-amber-800/50",
    dot: "bg-amber-400",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
    Icon: Minus,
    iconColor: "text-amber-500",
  },
  Low: {
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-200 dark:border-blue-800/50",
    dot: "bg-blue-400",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
    Icon: ArrowDown,
    iconColor: "text-blue-500",
  },
};

const STATUS_CONFIG = {
  "To Do": {
    badge: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    dot: "bg-gray-400",
    icon: "○",
  },
  "In Progress": {
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
    dot: "bg-blue-500",
    icon: "◔",
  },
  "In Review": {
    badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
    dot: "bg-purple-500",
    icon: "◑",
  },
  Completed: {
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
    dot: "bg-emerald-500",
    icon: "●",
  },
  Blocked: {
    badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
    dot: "bg-red-500",
    icon: "⊘",
  },
};

function Avatar({ name, size = "sm", className = "" }) {
  const initials = (name || "?").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  const colors = [
    "from-blue-500 to-indigo-600",
    "from-emerald-500 to-teal-600",
    "from-purple-500 to-pink-600",
    "from-orange-500 to-red-600",
    "from-cyan-500 to-blue-600",
  ];
  const idx = (name || "").charCodeAt(0) % colors.length;
  const sz = size === "sm" ? "w-7 h-7 text-[10px]" : size === "md" ? "w-9 h-9 text-xs" : "w-11 h-11 text-sm";
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br ${colors[idx]} flex items-center justify-center text-white font-bold flex-shrink-0 ring-2 ring-white dark:ring-gray-900 shadow-sm ${className}`}>
      {initials}
    </div>
  );
}

function Dropdown({ children, trigger, align = 'left' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <div style={{ position: 'absolute', zIndex: 50, marginTop: '6px', ...(align === 'right' ? { right: 0 } : { left: 0 }), minWidth: '160px', background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 12px 40px rgba(0,0,0,0.6)', padding: '4px 0', overflow: 'hidden' }}>
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}

export default function TaskModal({ onClose, onAddTask, onUpdateTask, channels = [], teamMembers = [], initialData = null }) {
  const { showToast } = useToast();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [project, setProject] = useState("");
  const [assignmentType, setAssignmentType] = useState("self");
  const [taskMode, setTaskMode] = useState("split");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [newAttachmentUrl, setNewAttachmentUrl] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [status, setStatus] = useState("To Do");
  const [channelMembers, setChannelMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

  const isEditing = !!initialData;
  const isReadOnly = isEditing && (initialData?.status === "Completed" || String(initialData?.assignerId) !== String(user?._id));
  const isAssigner = isEditing && String(initialData?.assignerId) === String(user?._id);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || "");
      setDescription(initialData.description || "");
      setDueDate(initialData.dueDate ? initialData.dueDate.split("T")[0] : "");
      setPriority(initialData.priority || "Medium");
      setAttachments(initialData.attachments || []);
      setStatus(initialData.status || "To Do");

      if (initialData.visibility === "channel") {
        setAssignmentType("channel");
        setProject(initialData.project);
      } else if (initialData.assignees && initialData.assignees.length > 1) {
        setAssignmentType("individual");
        setSelectedMembers(initialData.assignees.map((u) => u._id));
      } else if (initialData.assignees && initialData.assignees.length === 1 && initialData.assignees[0]._id !== user._id) {
        setAssignmentType("individual");
        setSelectedMembers([initialData.assignees[0]._id]);
      } else {
        setAssignmentType("self");
      }
    }
  }, [initialData, user]);

  useEffect(() => {
    const fetch = async () => {
      if (!project) { setChannelMembers([]); setSelectedChannel(""); return; }
      const ch = channels.find((c) => c.label === project || c.id === project);
      if (ch) setSelectedChannel(ch.id); else setSelectedChannel("");
      if (!ch) { setChannelMembers(teamMembers); return; }
      try {
        setLoadingMembers(true);
        const res = await api.get(`/api/channels/${ch.id}/members`);
        setChannelMembers(res.data.members || []);
      } catch { setChannelMembers(teamMembers); }
      finally { setLoadingMembers(false); }
    };
    fetch();
  }, [project, channels, teamMembers]);

  const toggleMember = (id) =>
    setSelectedMembers((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleSubmit = async () => {
    if (!title.trim()) return showToast("Task title is required", "error");
    if (!project) return showToast("Please select a channel", "error");
    if (!dueDate) return showToast("Deadline is required", "error");

    const selectedDate = new Date(dueDate);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    if (!isEditing && selectedDate < tomorrow) return showToast("Due date must be at least tomorrow", "error");
    if (assignmentType === "individual" && selectedMembers.length === 0)
      return showToast("Please select at least one member", "error");

    const payload = { title, description, project, assignmentType, taskMode, assignedToIds: assignmentType === "individual" ? selectedMembers : [], channelId: assignmentType === "channel" ? selectedChannel : null, dueDate, priority, status, attachments };

    setSaving(true);
    try {
      if (isEditing && onUpdateTask) await onUpdateTask(initialData.id, payload);
      else await onAddTask(payload);
      onClose();
    } catch {
      showToast("Something went wrong", "error");
    } finally {
      setSaving(false);
    }
  };

  const availableMembers = channelMembers.length > 0 ? channelMembers : teamMembers;
  const filteredMembers = availableMembers.filter((m) =>
    (m.username || m.email || "").toLowerCase().includes(memberSearch.toLowerCase())
  );

  const prioConf = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.Medium;
  const statConf = STATUS_CONFIG[status] || STATUS_CONFIG["To Do"];
  const PrioIcon = prioConf.Icon;

  const getDueDateLabel = () => {
    if (!dueDate) return null;
    const d = new Date(dueDate);
    const now = new Date();
    const diff = Math.ceil((d - now) / 86400000);
    if (diff < 0) return { text: "Overdue", color: "text-red-500" };
    if (diff === 0) return { text: "Due today", color: "text-orange-500" };
    if (diff === 1) return { text: "Due tomorrow", color: "text-amber-500" };
    return { text: `${diff}d left`, color: "text-gray-400" };
  };
  const dueDateLabel = getDueDateLabel();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
    >
      <div
        style={{ background: 'var(--bg-surface)', border: '1px solid rgba(255,255,255,0.1)', maxWidth: 860, maxHeight: "90vh", width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        {/* ── Top bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', borderBottom: '1px solid var(--border-default)', background: 'var(--bg-surface)', flexShrink: 0 }}>
          {initialData?.issueKey && (
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', background: 'var(--bg-hover)', padding: '2px 8px', fontFamily: 'Inter, system-ui, sans-serif' }}>
              {initialData.issueKey}
            </span>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
            <div style={{ width: '32px', height: '32px', background: 'rgba(184,149,106,0.12)', border: '1px solid rgba(184,149,106,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Briefcase size={15} style={{ color: '#b8956a' }} />
            </div>
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Inter, system-ui, sans-serif' }}>
              {isEditing ? (isReadOnly ? "Task Details" : "Update Task") : "Create New Task"}
            </h2>
          </div>

          <button
            onClick={onClose}
            style={{ flexShrink: 0, width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'color 150ms ease' }}
            onMouseEnter={e => e.currentTarget.style.color = '#e4e4e4'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.4)'}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Banner alerts ── */}
        {isEditing && !isReadOnly && isAssigner && initialData?.status !== "Completed" && (
          <div className="flex items-center gap-2.5 px-5 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800/30 text-blue-700 dark:text-blue-400 text-xs font-medium flex-shrink-0">
            <Shield size={13} className="flex-shrink-0" />
            You are the assigner — you have full editing access.
          </div>
        )}
        {isEditing && isReadOnly && initialData?.status !== "Completed" && (
          <div className="flex items-center gap-2.5 px-5 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800/30 text-amber-700 dark:text-amber-400 text-xs font-medium flex-shrink-0">
            <Eye size={13} className="flex-shrink-0" />
            View-only. Only <strong className="ml-1">{initialData?.assigner || "the assigner"}</strong>&nbsp;can edit this task.
          </div>
        )}
        {initialData?.status === "Completed" && initialData?.completionNote && (
          <div className="flex items-start gap-2.5 px-5 py-3 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-100 dark:border-emerald-800/30 flex-shrink-0">
            <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-0.5">Completion note</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 italic">"{initialData.completionNote}"</p>
            </div>
            {initialData.completedAt && (
              <span className="text-[10px] text-emerald-500 font-semibold whitespace-nowrap">
                {new Date(initialData.completedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        )}

        {/* ── Body: two-column layout ── */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* LEFT – main content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px', minWidth: 0, scrollbarWidth: 'thin' }}>

            {/* Title */}
            <div>
              <input
                type="text"
                readOnly={isReadOnly}
                placeholder="Task title…"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ width: '100%', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', background: 'transparent', outline: 'none', border: 'none', borderBottom: `2px solid ${isReadOnly ? 'transparent' : 'rgba(255,255,255,0.08)'}`, paddingBottom: '6px', fontFamily: 'Inter, system-ui, sans-serif', cursor: isReadOnly ? 'default' : 'text', boxSizing: 'border-box' }}
                onFocus={e => { if (!isReadOnly) e.target.style.borderBottomColor = '#b8956a'; }}
                onBlur={e => { if (!isReadOnly) e.target.style.borderBottomColor = 'rgba(255,255,255,0.08)'; }}
              />
            </div>

            {/* Description */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px', fontFamily: 'monospace' }}>
                <AlignLeft size={11} /> Description
              </label>
              <textarea
                readOnly={isReadOnly}
                placeholder="Add context, requirements, acceptance criteria…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                style={{ width: '100%', padding: '10px 12px', fontSize: '13px', color: 'var(--text-primary)', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', outline: 'none', resize: 'none', lineHeight: 1.6, fontFamily: 'Inter, system-ui, sans-serif', opacity: isReadOnly ? 0.7 : 1, cursor: isReadOnly ? 'default' : 'text', boxSizing: 'border-box', colorScheme: 'dark' }}
                onFocus={e => { if (!isReadOnly) e.target.style.borderColor = 'rgba(184,149,106,0.4)'; }}
                onBlur={e => { if (!isReadOnly) e.target.style.borderColor = 'rgba(255,255,255,0.08)'; }}
              />
            </div>

            {/* Attachments / Resources */}
            <div>
              <label className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
                <Paperclip size={11} /> Resources
              </label>
              <div className="space-y-2">
                {!isReadOnly && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Paste a URL (Figma, Notion, GitHub…)"
                      value={newAttachmentUrl}
                      onChange={(e) => setNewAttachmentUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newAttachmentUrl.trim()) {
                          setAttachments([...attachments, { name: newAttachmentUrl, url: newAttachmentUrl, type: "link" }]);
                          setNewAttachmentUrl("");
                        }
                      }}
                      className="flex-1 px-3.5 py-2 text-[12.5px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-800 dark:text-white placeholder-gray-300 dark:placeholder-gray-600 transition-all"
                    />
                    <button
                      onClick={() => {
                        if (!newAttachmentUrl.trim()) return;
                        setAttachments([...attachments, { name: newAttachmentUrl, url: newAttachmentUrl, type: "link" }]);
                        setNewAttachmentUrl("");
                      }}
                      className="px-3 py-2 bg-gray-900 dark:bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-gray-800 dark:hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-1"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                )}
                {attachments.length > 0 ? (
                  <div className="space-y-1.5">
                    {attachments.map((att, i) => (
                      <div key={i} className="group flex items-center gap-2.5 px-3 py-2 bg-white dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700/50 rounded-xl hover:border-blue-200 dark:hover:border-blue-700/50 transition-all">
                        <LinkIcon size={12} className="text-blue-400 flex-shrink-0" />
                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex-1 text-[12px] text-blue-600 dark:text-blue-400 truncate hover:underline font-medium">
                          {att.name || att.url}
                        </a>
                        {!isReadOnly && (
                          <button onClick={() => setAttachments(attachments.filter((_, j) => j !== i))} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all p-0.5">
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11.5px] text-gray-300 dark:text-gray-600 italic px-1">No resources added yet.</p>
                )}
              </div>
            </div>

            {/* Member multi-select section — shown inline on left for individual type */}
            {assignmentType === "individual" && (
              <div>
                <label className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
                  <Users size={11} /> Assign Members
                </label>
                <div className="border border-gray-200 dark:border-gray-700/60 rounded-xl overflow-hidden">
                  {/* search */}
                  {!isReadOnly && (
                    <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
                      <input
                        type="text"
                        placeholder="Search members…"
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        className="w-full text-[12px] bg-transparent outline-none text-gray-700 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-600"
                      />
                    </div>
                  )}
                  <div className="max-h-44 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800/60" style={{ scrollbarWidth: "thin" }}>
                    {loadingMembers ? (
                      <div className="flex items-center gap-2 justify-center py-6 text-gray-400 text-xs">
                        <Loader2 size={14} className="animate-spin" /> Loading members…
                      </div>
                    ) : filteredMembers.length === 0 ? (
                      <p className="text-center text-[12px] text-gray-400 py-5">No members found.</p>
                    ) : filteredMembers.map((m) => {
                      const id = m._id || m.id;
                      const sel = selectedMembers.includes(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          disabled={isReadOnly}
                          onClick={() => toggleMember(id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all ${sel ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-800/60"} ${isReadOnly ? "cursor-default" : ""}`}
                        >
                          <Avatar name={m.username || m.email} size="sm" />
                          <span className={`flex-1 text-[12.5px] font-medium ${sel ? "text-blue-700 dark:text-blue-300" : "text-gray-700 dark:text-gray-200"}`}>
                            {m.username || m.email}
                          </span>
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${sel ? "bg-blue-600 border-blue-600" : "border-gray-300 dark:border-gray-600"}`}>
                            {sel && <Check size={10} className="text-white" strokeWidth={3} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected summary */}
                {selectedMembers.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {selectedMembers.slice(0, 4).map((id) => {
                        const m = availableMembers.find((x) => (x._id || x.id) === id);
                        return m ? <Avatar key={id} name={m.username || m.email} size="sm" /> : null;
                      })}
                      {selectedMembers.length > 4 && (
                        <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-500 ring-2 ring-white dark:ring-gray-900">
                          +{selectedMembers.length - 4}
                        </div>
                      )}
                    </div>
                    <span className="text-[11.5px] text-gray-400">
                      {selectedMembers.length} member{selectedMembers.length > 1 ? "s" : ""} selected
                    </span>
                  </div>
                )}

                {/* Task mode toggle for multiple assigns */}
                {selectedMembers.length > 1 && !isReadOnly && (
                  <div className="mt-3 p-3 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-xl">
                    <p className="text-[10.5px] font-bold uppercase tracking-widest text-blue-500 mb-2">Task Mode</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[{ id: "split", emoji: "📋", label: "Split", sub: "Each gets their own copy" }, { id: "shared", emoji: "🤝", label: "Shared", sub: "Collaborate together" }].map((m) => (
                        <button key={m.id} type="button" onClick={() => setTaskMode(m.id)}
                          className={`px-3 py-2.5 rounded-xl border text-left transition-all ${taskMode === m.id ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/25" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-blue-300"}`}>
                          <div className="text-sm font-bold">{m.emoji} {m.label}</div>
                          <div className={`text-[10px] mt-0.5 ${taskMode === m.id ? "text-blue-200" : "text-gray-400"}`}>{m.sub}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Channel assignment */}
            {assignmentType === "channel" && (
              <div>
                <label className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
                  <Hash size={11} /> Full Channel
                </label>
                <select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value)}
                  disabled={isReadOnly || (!!project && channels.some((c) => c.label === project || c.id === project))}
                  className="w-full px-3.5 py-2.5 text-[13px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-700 dark:text-gray-200 font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="">Select target channel</option>
                  {channels.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                {selectedChannel && (
                  <p className="flex items-center gap-1.5 mt-1.5 text-[11.5px] text-blue-500 font-medium">
                    <Users size={11} /> All channel members will be notified.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* RIGHT – metadata sidebar */}
          <div style={{ width: '220px', flexShrink: 0, borderLeft: '1px solid var(--border-default)', background: 'rgba(255,255,255,0.02)', padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px', scrollbarWidth: 'thin' }}>

            {/* Status */}
            {isEditing && (
              <div>
                <p className="text-[9.5px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Status</p>
                {isReadOnly ? (
                  <span className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-lg ${statConf.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statConf.dot}`} />
                    {status}
                  </span>
                ) : (
                  <Dropdown
                    trigger={
                      <button className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border text-[12px] font-semibold cursor-pointer transition-all hover:shadow-sm ${statConf.badge} border-transparent`}>
                        <span className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${statConf.dot}`} />
                          {status}
                        </span>
                        <ChevronDown size={12} />
                      </button>
                    }
                  >
                    {(close) => statuses.map((s) => {
                      const c = STATUS_CONFIG[s];
                      return (
                        <button key={s} onClick={() => { setStatus(s); close(); }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] font-medium transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/60 ${status === s ? "text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400" : "text-gray-700 dark:text-gray-200"}`}>
                          <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                          {s}
                          {status === s && <Check size={11} className="ml-auto text-blue-500" />}
                        </button>
                      );
                    })}
                  </Dropdown>
                )}
              </div>
            )}

            {/* Priority */}
            <div>
              <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '8px', fontFamily: 'monospace' }}>Priority</p>
              {isReadOnly ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, padding: '4px 10px', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}>
                  <PrioIcon size={11} className={prioConf.iconColor} />
                  {priority}
                </span>
              ) : (
                <Dropdown
                  trigger={
                    <button style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '8px 10px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <PrioIcon size={11} className={prioConf.iconColor} />
                        {priority}
                      </span>
                      <ChevronDown size={12} />
                    </button>
                  }
                >
                  {(close) => priorities.map((p) => {
                    const c = PRIORITY_CONFIG[p];
                    const PI = c.Icon;
                    return (
                      <button key={p} onClick={() => { setPriority(p); close(); }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', fontSize: '12px', fontWeight: 500, background: priority === p ? 'rgba(184,149,106,0.1)' : 'transparent', color: 'var(--text-primary)', border: 'none', cursor: 'pointer', transition: 'background 150ms ease' }}
                        onMouseEnter={e => { if (priority !== p) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                        onMouseLeave={e => { if (priority !== p) e.currentTarget.style.background = 'transparent'; }}>
                        <PI size={13} className={c.iconColor} />
                        {p}
                        {priority === p && <Check size={11} style={{ marginLeft: 'auto', color: '#b8956a' }} />}
                      </button>
                    );
                  })}
                </Dropdown>
              )}
            </div>

            {/* Channel */}
            <div>
              <p className="text-[9.5px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Channel</p>
              {isReadOnly ? (
                <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-gray-700 dark:text-gray-200">
                  <Hash size={11} className="text-gray-400" />{project || "—"}
                </span>
              ) : (
                <select
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', fontSize: '12px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', colorScheme: 'dark', cursor: 'pointer', boxSizing: 'border-box' }}
                >
                  <option value="">Select channel</option>
                  {channels.length > 0 ? channels.map((c) => <option key={c.id} value={c.label}>{c.label}</option>) : (
                    <>
                      <option value="General">General</option>
                      <option value="Development">Development</option>
                    </>
                  )}
                </select>
              )}
            </div>

            {/* Due date */}
            <div>
              <p className="text-[9.5px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Due Date</p>
              {isReadOnly ? (
                <div className="space-y-0.5">
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-gray-700 dark:text-gray-200">
                    <Calendar size={11} className="text-gray-400" />
                    {dueDate ? new Date(dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                  </span>
                  {dueDateLabel && <p className={`text-[10.5px] font-semibold ml-4 ${dueDateLabel.color}`}>{dueDateLabel.text}</p>}
                </div>
              ) : (
                <div className="space-y-1">
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    min={new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0]}
                    max="2100-12-31"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '12px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', colorScheme: 'dark', boxSizing: 'border-box' }}
                  />
                  {dueDateLabel && <p className={`text-[10.5px] font-semibold ${dueDateLabel.color}`}>{dueDateLabel.text}</p>}
                </div>
              )}
            </div>

            {/* Assign to type */}
            <div>
              <p className="text-[9.5px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Assignee</p>
              {isReadOnly ? (
                <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-gray-700 dark:text-gray-200">
                  {assignmentType === "self" && <><User size={11} className="text-gray-400" /> Me</>}
                  {assignmentType === "individual" && <><Users size={11} className="text-gray-400" /> {selectedMembers.length} member{selectedMembers.length !== 1 ? "s" : ""}</>}
                  {assignmentType === "channel" && <><Hash size={11} className="text-gray-400" /> Full Channel</>}
                </span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {[
                    { id: 'self', Icon: User, label: 'Me' },
                    { id: 'individual', Icon: Users, label: 'Member(s)' },
                    { id: 'channel', Icon: Hash, label: 'Full Channel' },
                  ].map(({ id, Icon: BtnIcon, label }) => (
                    <button key={id} type="button"
                      onClick={() => {
                        if (id === 'self' || id === 'channel') setSelectedMembers([]);
                        setAssignmentType(id);
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', fontSize: '12px', fontWeight: 600, background: assignmentType === id ? 'rgba(184,149,106,0.12)' : '#161616', border: `1px solid ${assignmentType === id ? 'rgba(184,149,106,0.35)' : 'rgba(255,255,255,0.08)'}`, color: assignmentType === id ? '#b8956a' : 'rgba(228,228,228,0.45)', cursor: 'pointer', transition: 'all 150ms ease', fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'left' }}
                      onMouseEnter={e => { if (assignmentType !== id) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                      onMouseLeave={e => { if (assignmentType !== id) e.currentTarget.style.background = '#161616'; }}
                    >
                      <BtnIcon size={13} /> {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Assignees avatars (read mode) */}
            {isEditing && initialData?.assignees?.length > 0 && (
              <div>
                <p className="text-[9.5px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">People</p>
                <div className="flex flex-wrap gap-1.5">
                  {initialData.assignees.map((a) => (
                    <div key={a._id} className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-full pr-2.5 pl-0.5 py-0.5">
                      <Avatar name={a.username || a.email} size="sm" />
                      <span className="text-[11px] font-medium text-gray-700 dark:text-gray-200 max-w-[80px] truncate">{a.username || a.email}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '12px 20px', borderTop: '1px solid var(--border-default)', background: 'var(--bg-surface)', flexShrink: 0 }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {isEditing && initialData?.updatedAt && (
              <>Last updated&nbsp;{new Date(initialData.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={onClose}
              style={{ padding: '7px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border-default)', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 150ms ease' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#e4e4e4'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(228,228,228,0.4)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
            >
              Cancel
            </button>
            {!isReadOnly && (
              <button
                onClick={handleSubmit}
                disabled={saving}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 20px', background: '#b8956a', border: 'none', color: '#0c0c0c', fontSize: '13px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Inter, system-ui, sans-serif', opacity: saving ? 0.6 : 1, transition: 'opacity 150ms ease' }}
                onMouseEnter={e => { if (!saving) e.currentTarget.style.opacity = '0.85'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : (isEditing ? <Edit3 size={14} /> : <Plus size={14} />)}
                {saving ? "Saving…" : isEditing ? "Update Task" : "Create Task"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
