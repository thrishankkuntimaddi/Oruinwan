import React, { useState, useEffect, useMemo } from "react";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import {
  X, User, Users, Hash, Link as LinkIcon, Plus, Paperclip, AlignLeft, Briefcase, Check, Loader2, Edit3, Search,
} from "lucide-react";
import api from '@services/api';
import { PRIORITIES, PRIORITY_META, priorityLabel, statusLabel, TRANSITIONS, toDateInput } from '../../utils/taskMeta';
import { PriorityIcon, UserAvatar, tint, FONT } from './taskUi';

/** Statuses a new task can start in (blocked needs a reason, done/cancelled make no sense). */
const CREATE_STATUSES = ['backlog', 'todo', 'in_progress', 'review'];

const ASSIGN_OPTIONS = [
  { id: 'self', Icon: User, label: 'Me', hint: 'A private task for yourself.' },
  { id: 'individual', Icon: Users, label: 'Members', hint: 'Pick one or more workspace members.' },
  { id: 'channel', Icon: Hash, label: 'Full channel', hint: 'Everyone in the channel sees and can pick it up.' },
];

const labelStyle = { display: 'flex', alignItems: 'center', gap: '6px' };

/**
 * Create a task (or edit basic fields of one). Server values are used
 * throughout: status/priority keys come from utils/taskMeta.
 *
 * onAddTask(payload) / onUpdateTask(id, updates) receive
 * { title, description, assignmentType, assignedToIds, channelId, taskMode,
 *   status, blockedReason, priority, dueDate, attachments:[{name,url}] }.
 */
export default function TaskModal({ onClose, onAddTask, onUpdateTask, channels = [], teamMembers = [], initialData = null }) {
  const { showToast } = useToast();
  const { user } = useAuth();
  const currentUserId = String(user?._id || user?.id || '');
  const isEditing = !!initialData;

  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [channelId, setChannelId] = useState(initialData?.channelId || "");
  const [assignmentType, setAssignmentType] = useState("self");
  const [taskMode, setTaskMode] = useState("split");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [attachments, setAttachments] = useState(initialData?.attachments || []);
  const [newLink, setNewLink] = useState("");
  const [dueDate, setDueDate] = useState(toDateInput(initialData?.dueDate));
  const [priority, setPriority] = useState(initialData?.priority || "medium");
  const [status, setStatus] = useState(initialData?.status || "todo");
  const [blockedReason, setBlockedReason] = useState("");
  const [channelMembers, setChannelMembers] = useState(null);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  // Members of the chosen channel (for "Members" assignment inside a channel).
  useEffect(() => {
    let alive = true;
    if (!channelId) { setChannelMembers(null); return undefined; }
    setLoadingMembers(true);
    api.get(`/api/channels/${channelId}/members`)
      .then((res) => { if (alive) setChannelMembers(res.data.members || []); })
      .catch(() => { if (alive) setChannelMembers(null); })
      .finally(() => { if (alive) setLoadingMembers(false); });
    return () => { alive = false; };
  }, [channelId]);

  const availableMembers = useMemo(() => {
    const src = channelMembers && channelMembers.length ? channelMembers : teamMembers;
    return src.map((m) => ({ id: String(m._id || m.id || m.user?._id), username: m.username || m.user?.username || m.email, profilePicture: m.profilePicture || m.user?.profilePicture }))
      .filter((m) => m.id && m.id !== 'undefined');
  }, [channelMembers, teamMembers]);
  const filteredMembers = availableMembers.filter((m) => (m.username || '').toLowerCase().includes(memberSearch.toLowerCase()));
  const toggleMember = (id) => setSelectedMembers((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const today = toDateInput(new Date());
  const statusOptions = isEditing ? [initialData.status, ...(TRANSITIONS[initialData.status] || [])] : CREATE_STATUSES;

  const addLink = () => {
    const url = newLink.trim();
    if (!url) return;
    setAttachments((a) => [...a, { name: url, url }]);
    setNewLink("");
  };

  const handleSubmit = async () => {
    if (!title.trim()) return showToast("Task title is required", "error");
    if (!isEditing) {
      if (assignmentType === "channel" && !channelId) return showToast("Choose the channel to assign this task to", "error");
      if (assignmentType === "individual" && selectedMembers.length === 0) return showToast("Select at least one member", "error");
      if (dueDate && dueDate < today) return showToast("Due date can't be in the past", "error");
    }
    if (status === 'blocked' && status !== initialData?.status && !blockedReason.trim()) return showToast("Say what is blocking the task", "error");

    const pendingLink = newLink.trim();
    const allAttachments = pendingLink ? [...attachments, { name: pendingLink, url: pendingLink }] : attachments;
    const payload = {
      title: title.trim(),
      description,
      priority,
      dueDate: dueDate || null,
      attachments: allAttachments.map((a) => ({ name: a.name || a.url, url: a.url })),
    };

    setSaving(true);
    try {
      if (isEditing) {
        if (status !== initialData.status) {
          payload.status = status;
          if (status === 'blocked') payload.blockedReason = blockedReason.trim();
        }
        const ok = await onUpdateTask(initialData.id, payload);
        if (ok !== null && ok !== false) onClose();
      } else {
        const created = await onAddTask({
          ...payload,
          status,
          assignmentType,
          assignedToIds: assignmentType === "individual" ? selectedMembers : [],
          taskMode,
          channelId: channelId || null,
        });
        if (created) onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  const sidebarLabel = { fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', margin: '0 0 6px', fontFamily: FONT };

  return (
    <div className="tasks-ui" role="dialog" aria-modal="true" aria-label={isEditing ? 'Edit task' : 'Create task'}
      style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'var(--bg-overlay)', backdropFilter: 'blur(4px)', fontFamily: FONT }}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div style={{ width: '100%', maxWidth: 820, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-surface)', border: '1px solid var(--border-accent)', borderRadius: '2px', boxShadow: '0 24px 64px rgba(0,0,0,0.45)' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: '1px solid var(--border-default)', flexShrink: 0 }}>
          <span style={{ width: '34px', height: '34px', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-dim)', border: `1px solid ${tint('var(--accent)', 35)}`, flexShrink: 0 }}>
            <Briefcase size={16} style={{ color: 'var(--accent)' }} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.015em' }}>
              {isEditing ? 'Edit task' : 'Create task'}
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
              {isEditing ? (initialData.issueKey || 'Update the details below') : 'Only a title is required — everything else is optional.'}
            </p>
          </div>
          <button type="button" className="tk-icon-btn danger" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0, flexWrap: 'wrap', overflowY: 'auto' }}>
          {/* Main column */}
          <div style={{ flex: '1 1 380px', minWidth: 0, padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <input
              type="text"
              autoFocus
              placeholder="Task title…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              style={{ width: '100%', boxSizing: 'border-box', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', background: 'transparent', outline: 'none', border: 'none', borderBottom: '2px solid var(--border-default)', padding: '0 0 6px', fontFamily: FONT }}
              onFocus={(e) => { e.target.style.borderBottomColor = 'var(--accent)'; }}
              onBlur={(e) => { e.target.style.borderBottomColor = 'var(--border-default)'; }}
            />

            <div>
              <label className="tk-label" htmlFor="tk-desc"><AlignLeft size={11} /> Description</label>
              <textarea id="tk-desc" className="tk-field" rows={4} placeholder="Context, requirements, acceptance criteria…" value={description}
                onChange={(e) => setDescription(e.target.value)} style={{ resize: 'vertical', fontSize: '13px', lineHeight: 1.6 }} />
            </div>

            <div>
              <label className="tk-label" htmlFor="tk-link"><Paperclip size={11} /> Resources</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input id="tk-link" type="text" className="tk-field" placeholder="Paste a URL (Figma, Notion, GitHub…)" value={newLink}
                  onChange={(e) => setNewLink(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }} />
                <button type="button" className="tk-btn" onClick={addLink} disabled={!newLink.trim()} aria-label="Add resource"><Plus size={13} /></button>
              </div>
              {attachments.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                  {attachments.map((att, i) => (
                    <div key={`${att.url}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '2px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)' }}>
                      <LinkIcon size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                      <a href={att.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, minWidth: 0, fontSize: '12px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name || att.url}</a>
                      <button type="button" className="tk-icon-btn danger" style={{ width: 20, height: 20 }} onClick={() => setAttachments(attachments.filter((_, j) => j !== i))} aria-label="Remove resource"><X size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!isEditing && assignmentType === "individual" && (
              <div>
                <label className="tk-label"><Users size={11} /> Assign members {channelId && channelMembers ? '(channel members)' : ''}</label>
                <div style={{ border: '1px solid var(--border-default)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ position: 'relative', borderBottom: '1px solid var(--border-subtle)' }}>
                    <Search size={12} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                    <input type="text" className="tk-field" placeholder="Search members…" value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} style={{ border: 'none', paddingLeft: '28px', background: 'transparent' }} />
                  </div>
                  <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                    {loadingMembers ? (
                      <p style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', padding: '20px 0', margin: 0, color: 'var(--text-secondary)', fontSize: '12px' }}><Loader2 size={13} className="tk-spin" /> Loading members…</p>
                    ) : filteredMembers.length === 0 ? (
                      <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)', padding: '20px 0', margin: 0 }}>No members found.</p>
                    ) : filteredMembers.map((m) => {
                      const sel = selectedMembers.includes(m.id);
                      return (
                        <button key={m.id} type="button" onClick={() => toggleMember(m.id)} aria-pressed={sel}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', textAlign: 'left', background: sel ? 'var(--accent-dim)' : 'transparent', border: 'none', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', fontFamily: FONT }}>
                          <UserAvatar user={m} size={24} />
                          <span style={{ flex: 1, fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>{m.username}{m.id === currentUserId ? ' (you)' : ''}</span>
                          <span style={{ width: '15px', height: '15px', borderRadius: '2px', border: `1px solid ${sel ? 'var(--accent)' : 'var(--border-accent)'}`, background: sel ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {sel && <Check size={10} style={{ color: '#0c0c0c' }} strokeWidth={3} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {selectedMembers.length > 1 && (
                  <div style={{ marginTop: '12px' }}>
                    <p className="tk-label">Task mode</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      {[{ id: "split", label: "Split", sub: "Each member gets their own copy" }, { id: "shared", label: "Shared", sub: "One task, everyone collaborates" }].map((mode) => {
                        const on = taskMode === mode.id;
                        return (
                          <button key={mode.id} type="button" onClick={() => setTaskMode(mode.id)} aria-pressed={on}
                            style={{ padding: '10px', borderRadius: '2px', border: `1px solid ${on ? 'var(--accent)' : 'var(--border-default)'}`, background: on ? 'var(--accent-dim)' : 'var(--bg-base)', cursor: 'pointer', textAlign: 'left', fontFamily: FONT }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{mode.label}</div>
                            <div style={{ fontSize: '11px', marginTop: '2px', color: 'var(--text-secondary)' }}>{mode.sub}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Side column */}
          <div style={{ flex: '0 1 240px', minWidth: '220px', borderLeft: '1px solid var(--border-default)', background: 'var(--bg-base)', padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' }}>
            {!isEditing && (
              <div>
                <p style={sidebarLabel}>Assign to</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {ASSIGN_OPTIONS.map(({ id, Icon, label, hint }) => {
                    const on = assignmentType === id;
                    return (
                      <button key={id} type="button" title={hint} aria-pressed={on}
                        onClick={() => { setAssignmentType(id); if (id !== 'individual') setSelectedMembers([]); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '2px', fontSize: '12px', fontWeight: 600, background: on ? 'var(--accent-dim)' : 'transparent', border: `1px solid ${on ? 'var(--accent)' : 'var(--border-default)'}`, color: on ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: FONT, textAlign: 'left' }}>
                        <Icon size={13} style={{ color: on ? 'var(--accent)' : 'inherit' }} /> {label}
                      </button>
                    );
                  })}
                </div>
                <p style={{ margin: '6px 0 0', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{ASSIGN_OPTIONS.find((o) => o.id === assignmentType)?.hint}</p>
              </div>
            )}

            {!isEditing && (
              <div>
                <label style={{ ...sidebarLabel, ...labelStyle }} htmlFor="tk-channel">Channel{assignmentType === 'channel' ? ' *' : ''}</label>
                <select id="tk-channel" className="tk-field" value={channelId} onChange={(e) => setChannelId(e.target.value)}>
                  <option value="">{assignmentType === 'channel' ? 'Select channel' : 'Select channel (optional)'}</option>
                  {channels.map((c) => <option key={c.id} value={c.id}>#{c.label}</option>)}
                </select>
              </div>
            )}

            <div>
              <label style={sidebarLabel} htmlFor="tk-status">Status</label>
              <select id="tk-status" className="tk-field" value={status} onChange={(e) => setStatus(e.target.value)}>
                {statusOptions.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </select>
              {status === 'blocked' && status !== initialData?.status && (
                <input className="tk-field" style={{ marginTop: '6px' }} value={blockedReason} onChange={(e) => setBlockedReason(e.target.value)} placeholder="What is blocking it? (required)" />
              )}
            </div>

            <div>
              <p style={sidebarLabel}>Priority</p>
              <div role="radiogroup" aria-label="Priority" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {PRIORITIES.map((p) => {
                  const on = priority === p;
                  return (
                    <button key={p} type="button" role="radio" aria-checked={on} onClick={() => setPriority(p)}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px', borderRadius: '2px', fontSize: '12px', fontWeight: on ? 700 : 500, background: on ? tint(PRIORITY_META[p].color, 14) : 'transparent', border: `1px solid ${on ? tint(PRIORITY_META[p].color, 50) : 'transparent'}`, color: 'var(--text-primary)', cursor: 'pointer', fontFamily: FONT, textAlign: 'left' }}>
                      <PriorityIcon priority={p} size={13} /> {priorityLabel(p)}
                      {on && <Check size={11} style={{ marginLeft: 'auto', color: 'var(--accent)' }} />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label style={sidebarLabel} htmlFor="tk-due">Due date (optional)</label>
              <input id="tk-due" type="date" className="tk-field" value={dueDate} min={isEditing ? undefined : today} max="2100-12-31" onChange={(e) => setDueDate(e.target.value)} />
              {dueDate && <button type="button" className="tk-btn" style={{ marginTop: '6px', padding: '2px 8px', fontSize: '11px' }} onClick={() => setDueDate('')}>Clear date</button>}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', padding: '12px 20px', borderTop: '1px solid var(--border-default)', background: 'var(--bg-base)', flexShrink: 0 }}>
          <button type="button" className="tk-btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="tk-btn tk-btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 size={14} className="tk-spin" /> : (isEditing ? <Edit3 size={14} /> : <Plus size={14} />)}
            {saving ? "Saving…" : isEditing ? "Save changes" : "Create Task"}
          </button>
        </div>
      </div>
    </div>
  );
}
