import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import { aiHistoryKey, readAiHistory, writeAiHistory } from "../../../utils/aiChatHistoryStorage";
import { aiService, aiErrorMessage } from "../../../services/aiService";
import { useWorkspace } from "../../../contexts/WorkspaceContext";
import { useAIContext } from "../../../contexts/AIContext";
import { useToast } from "../../../contexts/ToastContext";
import { Rnd } from "react-rnd";
import {
  Send, X, Plus, History, Info, Copy, Edit2, CornerUpLeft, Sparkles, List,
  MessageSquare, CheckSquare, Zap, Monitor, ChevronRight, ListChecks, Languages, ArrowDownToLine, Check,
} from "lucide-react";

const WELCOME = () => ({ id: 1, sender: "ai", text: "Hi, I'm Chttrix AI. Ask me anything about your workspace, or use a quick action below.", time: now() });
function now() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const ACTION_LABELS = {
  get_current_workspace: 'looked up workspace', get_user_channels: 'listed channels', get_workspace_members: 'listed members',
  send_message_to_channel: 'sent channel message', send_direct_message: 'sent direct message', create_task: 'created task',
  list_my_tasks: 'listed tasks', update_task_status: 'updated task', create_note: 'created note', list_recent_notes: 'listed notes',
  search_workspace: 'searched workspace', schedule_meeting: 'scheduled meeting',
};

const ChttrixAIChat = ({ onClose, isSidebar = false }) => {
  const { activeWorkspace } = useWorkspace();
  const aiCtx = useAIContext();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const workspaceId = activeWorkspace?.id || activeWorkspace?._id || null;

  const [messages, setMessages] = useState([WELCOME()]);
  const { user } = useAuth() || {};
  const historyKey = aiHistoryKey(user?._id || user?.id || null);
  // History is stored with the key it belongs to so a user switch never
  // writes one user's history under another user's key.
  const [historyState, setHistoryState] = useState(() => ({ key: historyKey, items: readAiHistory(historyKey) }));
  const chatHistory = historyState.key === historyKey ? historyState.items : [];
  const setChatHistory = useCallback((updater) => {
    setHistoryState(prev => {
      const base = prev.key === historyKey ? prev.items : [];
      const items = typeof updater === 'function' ? updater(base) : updater;
      return { key: historyKey, items };
    });
  }, [historyKey]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [chatTitle, setChatTitle] = useState("Chttrix AI");
  const [replyingTo, setReplyingTo] = useState(null);
  const [visible, setVisible] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const endRef = useRef(null);
  const textRef = useRef(null);

  useEffect(() => {
    if (historyState.key !== historyKey) {
      setHistoryState({ key: historyKey, items: readAiHistory(historyKey) });
    }
  }, [historyKey, historyState.key]);

  useEffect(() => { writeAiHistory(historyState.key, historyState.items); }, [historyState]);
  useEffect(() => { setTimeout(() => setVisible(true), 10); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isTyping]);
  useEffect(() => {
    if (textRef.current) {
      textRef.current.style.height = "auto";
      textRef.current.style.height = Math.min(textRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  const conversation = aiCtx?.conversation || null;
  const note = aiCtx?.note || null;
  const task = aiCtx?.task || null;
  const contextLabel = conversation
    ? (conversation.type === 'dm' ? `DM ${conversation.name || ''}`.trim() : `#${String(conversation.name || 'conversation').replace(/^#+/, '')}`)
    : note ? `Note: ${note.title || 'Untitled'}` : task ? `Task: ${task.title}` : null;

  const pushAI = (payload) => setMessages(p => [...p, { id: Date.now() + Math.random(), sender: "ai", time: now(), ...payload }]);
  const pushUser = (text) => {
    const userMsg = { id: Date.now(), sender: "user", text, replyTo: replyingTo, time: now() };
    setMessages(p => [...p, userMsg]);
    if (messages.length === 1) setChatTitle(text.slice(0, 28) + (text.length > 28 ? "…" : ""));
    setReplyingTo(null);
    return userMsg;
  };

  const handleSend = async (text = input) => {
    if (!text.trim()) return;
    const userMsg = pushUser(text);
    const next = [...messages, userMsg];
    setInput(""); setIsTyping(true);
    try {
      const history = next.filter(m => !(m.id === 1 && m.sender === "ai") && !m.isError && !m.kind)
        .map(m => ({ sender: m.sender, text: m.text }));
      const data = await aiService.chat(text, history.slice(0, -1), workspaceId, aiCtx?.snapshot?.());
      setIsTyping(false);
      const wantsInsert = /\b(draft|write|reply|respond|compose|rephrase|reword|message)\b/i.test(text);
      pushAI({ text: data.text || '(no reply)', actions: data.actionsExecuted || null, kind: wantsInsert && !data.actionsExecuted ? 'draft' : undefined });
    } catch (err) {
      setIsTyping(false);
      pushAI({ text: aiErrorMessage(err, "Sorry, I'm having trouble connecting. Please try again."), isError: true });
    }
  };

  /* ── Quick actions: real endpoints, not canned prompts ────────────── */
  const runQuick = async (label, fn) => {
    pushUser(label);
    setIsTyping(true);
    try {
      const payload = await fn();
      setIsTyping(false);
      pushAI(payload);
    } catch (err) {
      setIsTyping(false);
      pushAI({ text: aiErrorMessage(err), isError: true });
    }
  };

  const transcript = () => (conversation?.getMessages?.() || []);

  const quickActions = [
    conversation && {
      icon: List, label: "Summarize",
      run: () => runQuick(`Summarize ${contextLabel}`, async () => {
        const msgs = transcript();
        if (!msgs.length) return { text: "There are no readable messages in this conversation yet." };
        const r = await aiService.conversation({ workspaceId, messages: msgs, mode: 'bullets', title: conversation.name });
        return { text: r.text };
      }),
    },
    conversation && {
      icon: ListChecks, label: "Action items",
      run: () => runQuick(`Action items in ${contextLabel}`, async () => {
        const msgs = transcript();
        if (!msgs.length) return { text: "There are no readable messages in this conversation yet." };
        const r = await aiService.conversation({ workspaceId, messages: msgs, mode: 'action_items', title: conversation.name });
        return { text: r.text, kind: 'action_items', items: r.items || [] };
      }),
    },
    conversation && {
      icon: MessageSquare, label: "Draft reply",
      run: () => runQuick(`Draft a reply in ${contextLabel}`, async () => {
        const r = await aiService.draft({ workspaceId, instruction: 'Write the most helpful next reply from me in this conversation.', messages: transcript().slice(-20) });
        return { text: r.draft, kind: 'draft' };
      }),
    },
    !conversation && { icon: MessageSquare, label: "Draft message", run: () => { setInput("Draft a message that "); textRef.current?.focus(); } },
    { icon: CheckSquare, label: "Add task", run: () => { setInput("Create a task: "); textRef.current?.focus(); } },
    { icon: Monitor, label: "What's on screen", run: () => handleSend("Briefly tell me what I'm looking at right now and what you can help with here.") },
  ].filter(Boolean);

  /* ── Result actions (insert draft, create tasks, translate) ───────── */
  const insertDraft = (text) => {
    const ok = aiCtx?.insertIntoComposer?.(text);
    if (ok) showToast('Inserted into the message box', 'success');
    else { navigator.clipboard?.writeText(text); showToast('Copied — open a conversation to insert it', 'info'); }
  };

  const createTasksFromItems = async (msgId, items) => {
    try {
      const text = items.map(i => `${i.title}${i.owner ? ` (owner: ${i.owner})` : ''}${i.due ? ` due ${i.due}` : ''} [${i.priority}]`).join('\n');
      const r = await aiService.extractTasks({ workspaceId, text, create: true, max: items.length });
      setMessages(p => p.map(m => m.id === msgId ? { ...m, created: r.created } : m));
      showToast(`${r.created.length} task${r.created.length === 1 ? '' : 's'} created`, 'success');
    } catch (err) {
      showToast(aiErrorMessage(err, 'Could not create tasks'), 'error');
    }
  };

  const translateReply = async (msgId, text) => {
    const lang = window.prompt('Translate to which language? (e.g. en, es, hi)', 'en');
    if (!lang) return;
    try {
      const r = await aiService.translate({ text, targetLang: lang.trim(), workspaceId });
      setMessages(p => p.map(m => m.id === msgId ? { ...m, translated: r.translated } : m));
    } catch (err) {
      showToast(aiErrorMessage(err, 'Translation failed'), 'error');
    }
  };

  const copyText = async (id, text) => {
    try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 1200); } catch { /* ignore */ }
  };

  const handleNewChat = () => {
    if (messages.length > 1)
      setChatHistory(p => [{ id: Date.now(), title: chatTitle, messages: [...messages], date: new Date().toLocaleDateString() }, ...p]);
    setMessages([WELCOME()]); setChatTitle("Chttrix AI"); setShowHistory(false);
    aiService.clearMemory(workspaceId).catch(() => {});
  };

  const loadChat = (chat) => {
    if (messages.length > 1)
      setChatHistory(p => [{ id: Date.now(), title: chatTitle, messages: [...messages], date: new Date().toLocaleDateString() }, ...p]);
    setMessages(chat.messages); setChatTitle(chat.title); setShowHistory(false);
  };

  const handleClose = () => {
    if (messages.length > 1 && chatTitle !== "Chttrix AI") {
      const item = { id: Date.now(), title: chatTitle, messages: [...messages], date: new Date().toLocaleDateString() };
      if (!chatHistory.find(h => h.title === chatTitle && h.date === item.date)) setChatHistory(p => [item, ...p]);
    }
    onClose();
  };

  const handleSaveEdit = (id, text) => {
    setMessages(p => p.map(m => m.id === id ? { ...m, text } : m));
    setEditingId(null);
  };

  const iconBtn = { padding: '6px', color: 'var(--text-muted)', background: 'none', border: 'none', borderRadius: '2px', cursor: 'pointer', display: 'flex', transition: '150ms ease' };
  const smallBtn = { display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', fontSize: '11px', fontWeight: 600, background: 'var(--bg-active)', border: '1px solid var(--border-accent)', borderRadius: '2px', color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'var(--font)' };

  const panel = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'var(--font)', transition: 'opacity 300ms ease, transform 300ms ease', opacity: visible ? 1 : 0, transform: isSidebar ? (visible ? 'translateX(0)' : 'translateX(32px)') : (visible ? 'scale(1)' : 'scale(0.95)') }}
      className={!isSidebar ? 'border border-[var(--border-default)]' : ''}>

      {showInfoModal && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', width: '85%', maxWidth: '320px', padding: '20px', position: 'relative' }}>
            <button onClick={() => setShowInfoModal(false)} style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16} /></button>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '16px', textAlign: 'center' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '2px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                <Sparkles size={18} style={{ color: 'var(--accent)' }} />
              </div>
              <h3 style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px', margin: '0 0 4px' }}>About Chttrix Intelligence</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>Workspace-aware · provider set in Settings → AI</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>What I can do</p>
                <ul style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '5px', paddingLeft: 0, listStyle: 'none', margin: 0 }}>
                  {['Summarize the open conversation and pull out action items', 'Draft replies and insert them into the message box', 'Create and update tasks, notes and meetings', 'Send messages on your behalf (only when you ask)', 'Answer questions from your knowledge pages'].map(c => (
                    <li key={c} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, display: 'inline-block' }} />{c}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>Privacy</p>
                <ul style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '5px', paddingLeft: 0, listStyle: 'none', margin: 0 }}>
                  {['Messages are end-to-end encrypted; only what your device can read is sent to the model', 'May make mistakes — verify important information'].map(c => (
                    <li key={c} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--border-accent)', flexShrink: 0, display: 'inline-block' }} />{c}</li>
                  ))}
                </ul>
              </div>
            </div>
            <button onClick={() => setShowInfoModal(false)} style={{ width: '100%', marginTop: '16px', padding: '8px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', borderRadius: '2px', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>Got it</button>
          </div>
        </div>
      )}

      {showHistory && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex' }}>
          <div style={{ width: '220px', background: 'var(--bg-surface)', borderRight: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>History</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {chatHistory.length > 0 && (
                  <button onClick={() => { if (window.confirm('Clear all history?')) { setChatHistory([]); if (historyKey) localStorage.removeItem(historyKey); } }}
                    style={{ fontSize: '10px', color: 'var(--state-danger)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}>Clear</button>
                )}
                <button onClick={() => setShowHistory(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}><X size={14} /></button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
              {chatHistory.length === 0 ? (
                <div style={{ padding: '32px 12px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>No history yet</div>
              ) : chatHistory.map(chat => (
                <button key={chat.id} onClick={() => loadChat(chat)}
                  style={{ width: '100%', textAlign: 'left', padding: '8px 10px', fontSize: '12px', color: 'var(--text-secondary)', background: 'none', border: 'none', borderRadius: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font)' }}>
                  <MessageSquare size={12} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{chat.title}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{chat.date}</div>
                  </div>
                  <ChevronRight size={11} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowHistory(false)} />
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', height: '48px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '2px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Sparkles size={14} style={{ color: 'var(--accent)' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chatTitle}</h3>
            <span style={{ fontSize: '10px', color: contextLabel ? 'var(--accent)' : 'var(--text-muted)', display: 'block', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {contextLabel ? `Context: ${contextLabel}` : 'Chttrix Intelligence · ⌘⇧A'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          {[
            { icon: Info, title: 'About', fn: () => setShowInfoModal(true) },
            { icon: History, title: 'History', fn: () => setShowHistory(v => !v) },
            { icon: Plus, title: 'New chat', fn: handleNewChat },
            { icon: X, title: 'Close', fn: handleClose },
          ].map(({ icon: Icon, title, fn }) => (
            <button key={title} onClick={fn} title={title} style={iconBtn}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
              <Icon size={15} />
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }} className="custom-scrollbar">
        {messages.length === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '32px 16px', userSelect: 'none' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '2px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
              <Sparkles size={22} style={{ color: 'var(--accent)' }} />
            </div>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px' }}>Chttrix Intelligence</h4>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '220px', lineHeight: 1.6, margin: '0 0 14px' }}>
              {contextLabel ? `I can see ${contextLabel}. Ask about it, summarize it, or draft a reply.` : 'Open a conversation, note or task and I can work on it — or just ask.'}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-muted)' }}>
              <Zap size={10} style={{ color: 'var(--accent)' }} /> Workspace-aware assistant
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={msg.id || i} className={`flex ${msg.sender === "ai" ? "justify-start" : "justify-end"} group`}>
            <div className={`flex flex-col max-w-[92%] ${msg.sender === "user" ? "items-end" : "items-start"}`}>
              {msg.replyTo && (
                <div style={{ marginBottom: '4px', padding: '4px 10px', fontSize: '11px', borderLeft: '2px solid var(--accent)', background: 'var(--bg-active)', color: 'var(--text-muted)', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {msg.replyTo.text.slice(0, 60)}…
                </div>
              )}

              {editingId === msg.id ? (
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', padding: '10px', minWidth: '180px' }}>
                  <textarea style={{ width: '100%', background: 'transparent', fontSize: '13px', color: 'var(--text-primary)', border: 'none', outline: 'none', resize: 'none', fontFamily: 'var(--font)' }}
                    defaultValue={msg.text} autoFocus rows={Math.max(2, Math.ceil(msg.text.length / 35))}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(msg.id, e.target.value); handleSend(e.target.value); }
                      if (e.key === 'Escape') setEditingId(null);
                    }} />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                    <button onClick={() => setEditingId(null)} style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '10px 12px', fontSize: '13px', lineHeight: 1.6, borderRadius: '2px', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  background: msg.sender === 'ai' ? 'var(--bg-surface)' : 'var(--bg-active)', color: 'var(--text-primary)',
                  border: `1px solid ${msg.isError ? 'var(--state-danger)' : msg.sender === 'ai' ? 'var(--border-default)' : 'var(--border-accent)'}` }}>
                  {msg.text}
                  {msg.translated && (
                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Translation</span>{msg.translated}
                    </div>
                  )}
                </div>
              )}

              {editingId !== msg.id && (
                <div className={`flex items-center gap-2 mt-1 ${msg.sender === "user" ? "flex-row-reverse" : ""}`}>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', padding: '0 4px' }}>{msg.time}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setReplyingTo(msg)} style={{ ...iconBtn, padding: '3px' }} title="Reply"><CornerUpLeft size={11} /></button>
                    <button onClick={() => copyText(msg.id, msg.text)} style={{ ...iconBtn, padding: '3px' }} title="Copy">{copiedId === msg.id ? <Check size={11} /> : <Copy size={11} />}</button>
                    {msg.sender === "user" && <button onClick={() => setEditingId(msg.id)} style={{ ...iconBtn, padding: '3px' }} title="Edit"><Edit2 size={11} /></button>}
                    {msg.sender === "ai" && !msg.isError && <button onClick={() => translateReply(msg.id, msg.text)} style={{ ...iconBtn, padding: '3px' }} title="Translate"><Languages size={11} /></button>}
                  </div>
                </div>
              )}

              {/* Result actions */}
              {msg.sender === 'ai' && !msg.isError && msg.kind === 'draft' && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                  <button onClick={() => insertDraft(msg.text)} style={smallBtn}><ArrowDownToLine size={11} /> Insert into message box</button>
                </div>
              )}
              {msg.kind === 'action_items' && msg.items?.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '4px', alignItems: 'center' }}>
                  {msg.created ? (
                    <span style={{ fontSize: '11px', color: 'var(--state-success)' }}>✓ {msg.created.length} task{msg.created.length === 1 ? '' : 's'} created</span>
                  ) : (
                    <button onClick={() => createTasksFromItems(msg.id, msg.items)} style={smallBtn}><CheckSquare size={11} /> Create {msg.items.length} task{msg.items.length === 1 ? '' : 's'}</button>
                  )}
                  {msg.created?.length > 0 && workspaceId && (
                    <button onClick={() => navigate(`/workspace/${workspaceId}/tasks`)} style={{ ...smallBtn, background: 'none', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>Open tasks</button>
                  )}
                </div>
              )}
              {msg.actions?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {msg.actions.map((act, j) => {
                    const ok = act.result?.success !== false;
                    return (
                      <span key={j} title={act.result?.error || JSON.stringify(act.parameters || {})}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', padding: '2px 8px', borderRadius: '99px', border: `1px solid ${ok ? 'rgba(90,186,138,0.35)' : 'rgba(224,82,82,0.4)'}`, color: ok ? 'var(--state-success)' : 'var(--state-danger)', background: ok ? 'rgba(90,186,138,0.08)' : 'rgba(224,82,82,0.08)' }}>
                        {ok ? '✓' : '✕'} {ACTION_LABELS[act.function] || act.function.replace(/_/g, ' ')}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              {[0, 1, 2].map(k => (
                <span key={k} style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', opacity: 0.7, animation: 'bounce 1s infinite', animationDelay: `${k * 120}ms`, display: 'inline-block' }} />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Quick actions */}
      {messages.length < 3 && (
        <div style={{ padding: '0 10px 8px', display: 'flex', gap: '6px', overflowX: 'auto', flexShrink: 0 }} className="no-scrollbar">
          {quickActions.map(({ icon: Icon, label, run }) => (
            <button key={label} onClick={run}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'var(--font)', transition: '150ms ease' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
              <Icon size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <div style={{ padding: '8px 12px 12px', flexShrink: 0, background: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)' }}>
        {replyingTo && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-active)', borderLeft: '2px solid var(--accent)', padding: '6px 10px', marginBottom: '8px', borderRadius: '0 2px 2px 0' }}>
            <div style={{ overflow: 'hidden' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent)', display: 'block' }}>{replyingTo.sender === 'user' ? 'You' : 'Chttrix AI'}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{replyingTo.text.slice(0, 60)}</span>
            </div>
            <button onClick={() => setReplyingTo(null)} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', marginLeft: '8px', display: 'flex' }}><X size={12} /></button>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '2px', padding: '8px 10px', transition: '150ms ease' }}
          onFocusCapture={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
          onBlurCapture={e => e.currentTarget.style.borderColor = 'var(--border-default)'}>
          <textarea ref={textRef} rows={1} value={input} onChange={e => setInput(e.target.value)}
            placeholder={contextLabel ? `Ask about ${contextLabel}…` : 'Message Chttrix AI…'}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '13px', color: 'var(--text-primary)', resize: 'none', padding: '1px 0', maxHeight: '112px', fontFamily: 'var(--font)' }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} />
          <button onClick={() => handleSend()} disabled={!input.trim() || isTyping}
            style={{ padding: '5px', background: input.trim() ? 'var(--accent-dim)' : 'none', border: `1px solid ${input.trim() ? 'var(--accent)' : 'transparent'}`, borderRadius: '2px', color: input.trim() ? 'var(--accent)' : 'var(--text-muted)', cursor: input.trim() ? 'pointer' : 'not-allowed', display: 'flex', transition: '150ms ease' }}>
            <Send size={14} />
          </button>
        </div>
        <p style={{ textAlign: 'center', fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px' }}>AI can make mistakes. Check important info.</p>
      </div>
    </div>
  );

  if (isSidebar) return panel;

  return (
    <Rnd default={{ x: window.innerWidth - 420, y: 80, width: 380, height: 620 }} minWidth={320} minHeight={400} bounds="window" className="z-50" enableResizing dragHandleClassName="cursor-move">
      {panel}
    </Rnd>
  );
};

export default ChttrixAIChat;
