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
        <div style={{ position: 'absolute', zIndex: 50, marginTop: '6px', ...(align === 'right' ? { right: 0 } : { left: 0 }), minWidth: '160px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', boxShadow: '0 12px 40px rgba(0,0,0,0.2)', padding: '4px 0', overflow: 'hidden' }}>
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
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', maxWidth: 860, maxHeight: "90vh", width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
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
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Banner alerts ── */}
        {isEditing && !isReadOnly && isAssigner && initialData?.status !== "Completed" && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 20px', background: 'rgba(59,130,246,0.08)', borderBottom: '1px solid rgba(59,130,246,0.15)', color: '#3b82f6', fontSize: '12px', fontWeight: 500, flexShrink: 0 }}>
            <Shield size={13} style={{ flexShrink: 0 }} />
            You are the assigner — you have full editing access.
          </div>
        )}
        {isEditing && isReadOnly && initialData?.status !== "Completed" && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 20px', background: 'rgba(184,149,106,0.08)', borderBottom: '1px solid rgba(184,149,106,0.2)', color: '#b8956a', fontSize: '12px', fontWeight: 500, flexShrink: 0 }}>
            <Eye size={13} style={{ flexShrink: 0 }} />
            View-only. Only <strong style={{ marginLeft: '4px' }}>{initialData?.assigner || "the assigner"}</strong>&nbsp;can edit this task.
          </div>
        )}
        {initialData?.status === "Completed" && initialData?.completionNote && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 20px', background: 'rgba(52,211,153,0.07)', borderBottom: '1px solid rgba(52,211,153,0.18)', flexShrink: 0 }}>
            <CheckCircle2 size={14} style={{ color: '#34d399', flexShrink: 0, marginTop: '1px' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#34d399', marginBottom: '2px' }}>Completion note</p>
              <p style={{ fontSize: '11px', color: 'rgba(52,211,153,0.8)', fontStyle: 'italic' }}>&#34;{initialData.completionNote}&#34;</p>
            </div>
            {initialData.completedAt && (
              <span style={{ fontSize: '10px', color: '#34d399', fontWeight: 700, whiteSpace: 'nowrap' }}>
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
                style={{ width: '100%', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', background: 'transparent', outline: 'none', border: 'none', borderBottom: `2px solid ${isReadOnly ? 'transparent' : 'var(--border-default)'}`, paddingBottom: '6px', fontFamily: 'Inter, system-ui, sans-serif', cursor: isReadOnly ? 'default' : 'text', boxSizing: 'border-box' }}
                onFocus={e => { if (!isReadOnly) e.target.style.borderBottomColor = '#b8956a'; }}
                onBlur={e => { if (!isReadOnly) e.target.style.borderBottomColor = 'var(--border-default)'; }}
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
                style={{ width: '100%', padding: '10px 12px', fontSize: '13px', color: 'var(--text-primary)', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', outline: 'none', resize: 'none', lineHeight: 1.6, fontFamily: 'Inter, system-ui, sans-serif', opacity: isReadOnly ? 0.7 : 1, cursor: isReadOnly ? 'default' : 'text', boxSizing: 'border-box', colorScheme: 'light' }}
                onFocus={e => { if (!isReadOnly) e.target.style.borderColor = 'rgba(184,149,106,0.4)'; }}
                onBlur={e => { if (!isReadOnly) e.target.style.borderColor = 'var(--border-default)'; }}
              />
            </div>

            {/* Attachments / Resources */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px', fontFamily: 'monospace' }}>
                <Paperclip size={11} /> Resources
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {!isReadOnly && (
                  <div style={{ display: 'flex', gap: '8px' }}>
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
                      style={{ flex: 1, padding: '7px 12px', fontSize: '12px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box' }}
                      onFocus={e => e.target.style.borderColor = 'rgba(184,149,106,0.5)'}
                      onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                    />
                    <button
                      onClick={() => {
                        if (!newAttachmentUrl.trim()) return;
                        setAttachments([...attachments, { name: newAttachmentUrl, url: newAttachmentUrl, type: "link" }]);
                        setNewAttachmentUrl("");
                      }}
                      style={{ padding: '7px 12px', background: '#b8956a', border: 'none', color: '#0c0c0c', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', transition: 'opacity 150ms ease' }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                )}
                {attachments.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {attachments.map((att, i) => (
                      <div key={i} className="group" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', transition: 'border-color 150ms ease' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-default)'}>
                        <LinkIcon size={12} style={{ color: '#60a5fa', flexShrink: 0 }} />
                        <a href={att.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, fontSize: '12px', color: '#60a5fa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500, textDecoration: 'none' }}
                          onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                          onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>
                          {att.name || att.url}
                        </a>
                        {!isReadOnly && (
                          <button onClick={() => setAttachments(attachments.filter((_, j) => j !== i))} style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', transition: 'color 150ms ease', flexShrink: 0, opacity: 0 }} className="group-hover:opacity-100"
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--state-danger)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', paddingLeft: '4px' }}>No resources added yet.</p>
                )}
              </div>
            </div>

            {/* Member multi-select section — shown inline on left for individual type */}
            {assignmentType === "individual" && (
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px', fontFamily: 'monospace' }}>
                  <Users size={11} /> Assign Members
                </label>
                <div style={{ border: '1px solid var(--border-default)', overflow: 'hidden' }}>
                  {/* search */}
                  {!isReadOnly && (
                    <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <input
                        type="text"
                        placeholder="Search members…"
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        style={{ width: '100%', fontSize: '12px', background: 'transparent', outline: 'none', color: 'var(--text-primary)', border: 'none', fontFamily: 'Inter, system-ui, sans-serif' }}
                      />
                    </div>
                  )}
                  <div style={{ maxHeight: '176px', overflowY: 'auto', scrollbarWidth: 'thin' }}>
                    {loadingMembers ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '12px' }}>
                        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading members…
                      </div>
                    ) : filteredMembers.length === 0 ? (
                      <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', padding: '20px 0' }}>No members found.</p>
                    ) : filteredMembers.map((m) => {
                      const id = m._id || m.id;
                      const sel = selectedMembers.includes(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          disabled={isReadOnly}
                          onClick={() => toggleMember(id)}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', textAlign: 'left', background: sel ? 'rgba(59,130,246,0.08)' : 'transparent', border: 'none', borderBottom: '1px solid var(--border-subtle)', cursor: isReadOnly ? 'default' : 'pointer', transition: 'background 150ms ease', fontFamily: 'Inter, system-ui, sans-serif' }}
                          onMouseEnter={e => { if (!sel && !isReadOnly) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                          onMouseLeave={e => { if (!sel) e.currentTarget.style.background = sel ? 'rgba(59,130,246,0.08)' : 'transparent'; }}
                        >
                          <Avatar name={m.username || m.email} size="sm" />
                          <span style={{ flex: 1, fontSize: '12px', fontWeight: 500, color: sel ? '#3b82f6' : 'var(--text-primary)' }}>
                            {m.username || m.email}
                          </span>
                          <div style={{ width: '16px', height: '16px', border: `2px solid ${sel ? '#3b82f6' : 'var(--border-accent)'}`, background: sel ? '#3b82f6' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 150ms ease' }}>
                            {sel && <Check size={10} style={{ color: '#ffffff' }} strokeWidth={3} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected summary */}
                {selectedMembers.length > 0 && (
                  <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', marginLeft: '-8px' }}>
                      {selectedMembers.slice(0, 4).map((id) => {
                        const m = availableMembers.find((x) => (x._id || x.id) === id);
                        return m ? <Avatar key={id} name={m.username || m.email} size="sm" /> : null;
                      })}
                      {selectedMembers.length > 4 && (
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--bg-active)', border: '2px solid var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>
                          +{selectedMembers.length - 4}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {selectedMembers.length} member{selectedMembers.length > 1 ? "s" : ""} selected
                    </span>
                  </div>
                )}

                {/* Task mode toggle for multiple assigns */}
                {selectedMembers.length > 1 && !isReadOnly && (
                  <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#3b82f6', marginBottom: '8px' }}>Task Mode</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      {[{ id: "split", emoji: "📋", label: "Split", sub: "Each gets their own copy" }, { id: "shared", emoji: "🤝", label: "Shared", sub: "Collaborate together" }].map((m) => (
                        <button key={m.id} type="button" onClick={() => setTaskMode(m.id)}
                          style={{ padding: '10px', border: `1px solid ${taskMode === m.id ? '#3b82f6' : 'var(--border-default)'}`, background: taskMode === m.id ? '#3b82f6' : 'var(--bg-hover)', cursor: 'pointer', textAlign: 'left', transition: 'all 150ms ease', fontFamily: 'Inter, system-ui, sans-serif' }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: taskMode === m.id ? '#ffffff' : 'var(--text-primary)' }}>{m.emoji} {m.label}</div>
                          <div style={{ fontSize: '10px', marginTop: '2px', color: taskMode === m.id ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)' }}>{m.sub}</div>
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
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px', fontFamily: 'monospace' }}>
                  <Hash size={11} /> Full Channel
                </label>
                <select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value)}
                  disabled={isReadOnly || (!!project && channels.some((c) => c.label === project || c.id === project))}
                  style={{ width: '100%', padding: '8px 10px', fontSize: '13px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box', opacity: (isReadOnly || (!!project && channels.some((c) => c.label === project || c.id === project))) ? 0.6 : 1, cursor: (isReadOnly || (!!project && channels.some((c) => c.label === project || c.id === project))) ? 'not-allowed' : 'pointer' }}
                >
                  <option value="">Select target channel</option>
                  {channels.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                {selectedChannel && (
                  <p style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '11px', color: '#3b82f6', fontWeight: 500 }}>
                    <Users size={11} /> All channel members will be notified.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* RIGHT – metadata sidebar */}
          <div style={{ width: '220px', flexShrink: 0, borderLeft: '1px solid var(--border-default)', background: 'var(--bg-surface)', padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px', scrollbarWidth: 'thin' }}>

            {/* Status */}
            {isEditing && (
              <div>
                <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '8px', fontFamily: 'monospace' }}>Status</p>
                {isReadOnly ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, padding: '4px 10px', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: statConf.dot?.replace('bg-', '') || '#888' }} />
                    {status}
                  </span>
                ) : (
                  <Dropdown
                    trigger={
                      <button style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '8px 10px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '13px' }}>{statConf.icon}</span>
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
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', fontSize: '12px', fontWeight: 500, background: status === s ? 'rgba(59,130,246,0.08)' : 'transparent', color: status === s ? '#3b82f6' : 'var(--text-primary)', border: 'none', cursor: 'pointer', transition: 'background 150ms ease' }}
                          onMouseEnter={e => { if (status !== s) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                          onMouseLeave={e => { if (status !== s) e.currentTarget.style.background = 'transparent'; }}>
                          <span style={{ fontSize: '13px' }}>{c.icon}</span>
                          {s}
                          {status === s && <Check size={11} style={{ marginLeft: 'auto', color: '#3b82f6' }} />}
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
                        onMouseEnter={e => { if (priority !== p) e.currentTarget.style.background = 'var(--bg-hover)'; }}
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
              <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '8px', fontFamily: 'monospace' }}>Channel</p>
              {isReadOnly ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  <Hash size={11} style={{ color: 'var(--text-muted)' }} />{project || "—"}
                </span>
              ) : (
                <select
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', fontSize: '12px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', colorScheme: 'light', cursor: 'pointer', boxSizing: 'border-box' }}
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
              <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '8px', fontFamily: 'monospace' }}>Due Date</p>
              {isReadOnly ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    <Calendar size={11} style={{ color: 'var(--text-muted)' }} />
                    {dueDate ? new Date(dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                  </span>
                  {dueDateLabel && <p style={{ fontSize: '10px', fontWeight: 700, marginLeft: '16px', color: dueDateLabel.color?.includes('red') ? 'var(--state-danger)' : dueDateLabel.color?.includes('orange') ? '#fb923c' : dueDateLabel.color?.includes('amber') ? '#f59e0b' : 'var(--text-muted)' }}>{dueDateLabel.text}</p>}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    min={new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0]}
                    max="2100-12-31"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '12px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', colorScheme: 'light', boxSizing: 'border-box' }}
                  />
                  {dueDateLabel && <p style={{ fontSize: '10px', fontWeight: 700, color: dueDateLabel.color?.includes('red') ? 'var(--state-danger)' : dueDateLabel.color?.includes('orange') ? '#fb923c' : dueDateLabel.color?.includes('amber') ? '#f59e0b' : 'var(--text-muted)' }}>{dueDateLabel.text}</p>}
                </div>
              )}
            </div>

            {/* Assign to type */}
            <div>
              <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '8px', fontFamily: 'monospace' }}>Assignee</p>
              {isReadOnly ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {assignmentType === "self" && <><User size={11} style={{ color: 'var(--text-muted)' }} /> Me</>}
                  {assignmentType === "individual" && <><Users size={11} style={{ color: 'var(--text-muted)' }} /> {selectedMembers.length} member{selectedMembers.length !== 1 ? "s" : ""}</>}
                  {assignmentType === "channel" && <><Hash size={11} style={{ color: 'var(--text-muted)' }} /> Full Channel</>}
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
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', fontSize: '12px', fontWeight: 600, background: assignmentType === id ? 'rgba(184,149,106,0.12)' : 'var(--bg-hover)', border: `1px solid ${assignmentType === id ? 'rgba(184,149,106,0.35)' : 'var(--border-default)'}`, color: assignmentType === id ? '#b8956a' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 150ms ease', fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'left' }}
                      onMouseEnter={e => { if (assignmentType !== id) e.currentTarget.style.background = 'var(--bg-active)'; }}
                      onMouseLeave={e => { if (assignmentType !== id) e.currentTarget.style.background = 'var(--bg-hover)'; }}
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
                <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '8px', fontFamily: 'monospace' }}>People</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {initialData.assignees.map((a) => (
                    <div key={a._id} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', borderRadius: '999px', padding: '2px 10px 2px 2px' }}>
                      <Avatar name={a.username || a.email} size="sm" />
                      <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-primary)', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.username || a.email}</span>
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
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-default)'; }}
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
