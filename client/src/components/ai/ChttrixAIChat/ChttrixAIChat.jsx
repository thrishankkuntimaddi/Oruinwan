import { useState, useRef, useEffect } from "react";
import { aiService } from "../../../services/aiService";
import { useWorkspace } from "../../../contexts/WorkspaceContext";
import { Rnd } from "react-rnd";
import {
  Send, Mic, FileText, X, Plus, History, Info,
  Copy, Edit2, CornerUpLeft, Sparkles, List,
  MessageSquare, CheckSquare, Zap, Monitor,
  Image, ChevronRight
} from "lucide-react";

/* ─── helpers ──────────────────────────────────────────────── */
const WELCOME = () => ({
  id: 1, sender: "ai",
  text: "Hi, I'm ChttrixAI. How can I help you today?",
  time: now(),
});
function now() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
const QUICK_ACTIONS = [
  { icon: Monitor,       label: "Screen Context", prompt: "Analyze what's currently on my screen" },
  { icon: List,          label: "Summarize",       prompt: "Summarize the recent messages" },
  { icon: MessageSquare, label: "Draft Msg",       prompt: "Help me draft a message" },
  { icon: CheckSquare,   label: "Add Task",        prompt: "Add a new task to my list" },
];

/* ─── component ────────────────────────────────────────────── */
const ChttrixAIChat = ({ onClose, isSidebar = false }) => {
  const { activeWorkspace } = useWorkspace();

  const [messages, setMessages]           = useState([WELCOME()]);
  const [chatHistory, setChatHistory]     = useState(() => {
    try { return JSON.parse(localStorage.getItem("chttrixai_chat_history") ?? "[]"); }
    catch { return []; }
  });
  const [input, setInput]                 = useState("");
  const [isTyping, setIsTyping]           = useState(false);
  const [showHistory, setShowHistory]     = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [editingId, setEditingId]         = useState(null);
  const [chatTitle, setChatTitle]         = useState("Chttrix AI");
  const [replyingTo, setReplyingTo]       = useState(null);
  const [showAttach, setShowAttach]       = useState(false);
  const [visible, setVisible]             = useState(false);

  const endRef       = useRef(null);
  const textRef      = useRef(null);
  const attachRef    = useRef(null);
  const attachBtnRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem("chttrixai_chat_history", JSON.stringify(chatHistory)); }
    catch {}
  }, [chatHistory]);

  useEffect(() => { setTimeout(() => setVisible(true), 10); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isTyping]);
  useEffect(() => {
    if (textRef.current) {
      textRef.current.style.height = "auto";
      textRef.current.style.height = Math.min(textRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  useEffect(() => {
    const fn = (e) => {
      if (showAttach && attachRef.current && !attachRef.current.contains(e.target)
        && attachBtnRef.current && !attachBtnRef.current.contains(e.target))
        setShowAttach(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [showAttach]);

  /* ─── handlers ─────────────────────────────────────────── */
  const handleSend = async (text = input) => {
    if (!text.trim()) return;
    const userMsg = { id: Date.now(), sender: "user", text, replyTo: replyingTo, time: now() };
    const next    = [...messages, userMsg];
    setMessages(next);
    setInput(""); setReplyingTo(null); setIsTyping(true);
    if (messages.length === 1) setChatTitle(text.slice(0, 28) + (text.length > 28 ? "…" : ""));

    try {
      const history = next.filter(m => !(m.id === 1 && m.sender === "ai") && !m.isError)
        .map(m => ({ sender: m.sender, text: m.text }));
      const data = await aiService.chat(text, history.slice(0, -1), activeWorkspace?._id);
      setIsTyping(false);
      setMessages(p => [...p, { id: Date.now() + 1, sender: "ai", text: data.text, actions: data.actionsExecuted || null, time: now() }]);
    } catch {
      setIsTyping(false);
      setMessages(p => [...p, { id: Date.now() + 1, sender: "ai", text: "Sorry, I'm having trouble connecting. Please try again.", isError: true, time: now() }]);
    }
  };

  const handleNewChat = () => {
    if (messages.length > 1)
      setChatHistory(p => [{ id: Date.now(), title: chatTitle, messages: [...messages], date: new Date().toLocaleDateString() }, ...p]);
    setMessages([WELCOME()]); setChatTitle("Chttrix AI"); setShowHistory(false);
  };

  const loadChat = (chat) => {
    if (messages.length > 1)
      setChatHistory(p => [{ id: Date.now(), title: chatTitle, messages: [...messages], date: new Date().toLocaleDateString() }, ...p]);
    setMessages(chat.messages); setChatTitle(chat.title); setShowHistory(false);
  };

  const handleClose = () => {
    if (messages.length > 1 && chatTitle !== "Chttrix AI") {
      const item = { id: Date.now(), title: chatTitle, messages: [...messages], date: new Date().toLocaleDateString() };
      if (!chatHistory.find(h => h.title === chatTitle && h.date === item.date))
        setChatHistory(p => [item, ...p]);
    }
    onClose();
  };

  const handleSaveEdit = (id, text) => {
    setMessages(p => p.map(m => m.id === id ? { ...m, text } : m));
    setEditingId(null);
  };

  /* ─── render ─────────────────────────────────────────────── */
  const panel = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'var(--font)', transition: 'opacity 300ms ease, transform 300ms ease', opacity: isSidebar ? (visible ? 1 : 0) : (visible ? 1 : 0), transform: isSidebar ? (visible ? 'translateX(0)' : 'translateX(32px)') : (visible ? 'scale(1)' : 'scale(0.95)') }}
      className={!isSidebar ? 'border border-[var(--border-default)]' : ''}>


      {/* ── Info modal ── */}
      {showInfoModal && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', width: '85%', maxWidth: '320px', padding: '20px', position: 'relative' }}>
            <button onClick={() => setShowInfoModal(false)} style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={16} />
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '16px', textAlign: 'center' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '2px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                <Sparkles size={18} style={{ color: 'var(--accent)' }} />
              </div>
              <h3 style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px', margin: '0 0 4px' }}>About Chttrix Intelligence</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>Powered by Gemini · Workspace-aware</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>What I can do</p>
                <ul style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '5px', paddingLeft: 0, listStyle: 'none', margin: 0 }}>
                  {['Answer questions & summarize chats', 'Help debug code & write snippets', 'Draft emails & organize tasks', 'Analyze screen content (Vision)'].map(c => (
                    <li key={c} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, display: 'inline-block' }} />{c}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>Limitations</p>
                <ul style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '5px', paddingLeft: 0, listStyle: 'none', margin: 0 }}>
                  {['May occasionally generate incorrect info', 'Verify important data manually', "Don't share sensitive personal info"].map(c => (
                    <li key={c} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--border-accent)', flexShrink: 0, display: 'inline-block' }} />{c}</li>
                  ))}
                </ul>
              </div>
            </div>
            <button onClick={() => setShowInfoModal(false)}
              style={{ width: '100%', marginTop: '16px', padding: '8px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', borderRadius: '2px', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', transition: '150ms ease' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--text-muted)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
            >Got it</button>
          </div>
        </div>
      )}

      {/* ── History panel ── */}
      {showHistory && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex' }}>
          <div style={{ width: '220px', background: 'var(--bg-surface)', borderRight: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>History</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {chatHistory.length > 0 && (
                  <button onClick={() => { if (window.confirm('Clear all history?')) { setChatHistory([]); localStorage.removeItem('chttrixai_chat_history'); } }}
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
                  style={{ width: '100%', textAlign: 'left', padding: '8px 10px', fontSize: '12px', color: 'var(--text-secondary)', background: 'none', border: 'none', borderRadius: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: '150ms ease', fontFamily: 'var(--font)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >
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

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', height: '48px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ position: 'relative' }}>
            <img src="/assets/ChttrixAI-logo.png" alt="Chttrix AI"
              style={{ width: '28px', height: '28px', borderRadius: '2px', objectFit: 'cover' }}
              onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
            />
            <div style={{ width: '28px', height: '28px', borderRadius: '2px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', alignItems: 'center', justifyContent: 'center', display: 'none' }}>
              <Sparkles size={14} style={{ color: 'var(--accent)' }} />
            </div>
            <span style={{ position: 'absolute', bottom: '-1px', right: '-1px', width: '8px', height: '8px', background: 'var(--state-success)', border: '2px solid var(--bg-base)', borderRadius: '50%' }} />
          </div>
          <div>
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2, margin: 0 }}>{chatTitle}</h3>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginTop: '1px' }}>Chttrix Intelligence · ⌘⇧A</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          {[
            { icon: Info, title: 'About', fn: () => setShowInfoModal(true) },
            { icon: History, title: 'History', fn: () => setShowHistory(v => !v) },
            { icon: Plus, title: 'New chat', fn: handleNewChat },
            { icon: X, title: 'Close', fn: handleClose },
          ].map(({ icon: Icon, title, fn }) => (
            <button key={title} onClick={fn} title={title}
              style={{ padding: '6px', color: 'var(--text-muted)', background: 'none', border: 'none', borderRadius: '2px', cursor: 'pointer', display: 'flex', transition: '150ms ease' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              <Icon size={15} />
            </button>
          ))}
        </div>
      </div>

      {/* ── Messages ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }} className="custom-scrollbar">
        {messages.length === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '32px 16px', userSelect: 'none' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '2px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
              <Sparkles size={22} style={{ color: 'var(--accent)' }} />
            </div>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px' }}>Chttrix Intelligence</h4>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '180px', lineHeight: 1.6, margin: '0 0 14px' }}>Your AI assistant for messages, tasks, and workspace intelligence</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-muted)' }}>
              <Zap size={10} style={{ color: 'var(--accent)' }} />
              Powered by Gemini AI
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={msg.id || i} className={`flex ${msg.sender === "ai" ? "justify-start" : "justify-end"} group`}>
            <div className={`flex flex-col max-w-[88%] ${msg.sender === "user" ? "items-end" : "items-start"}`}>

              {/* Reply preview */}
              {msg.replyTo && (
                <div className={`mb-1.5 px-3 py-1.5 text-xs rounded-lg border-l-2 bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 truncate max-w-full
                  ${msg.sender === "user" ? "border-violet-500 self-end" : "border-gray-300 dark:border-gray-600"}`}>
                  <span className="font-semibold block text-[10px] text-gray-400">{msg.replyTo.sender === "user" ? "You" : "Chttrix AI"}</span>
                  {msg.replyTo.text.slice(0, 60)}…
                </div>
              )}

              {/* Bubble */}
              {editingId === msg.id ? (
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', padding: '10px', minWidth: '180px' }}>
                  <textarea
                    style={{ width: '100%', background: 'transparent', fontSize: '13px', color: 'var(--text-primary)', border: 'none', outline: 'none', resize: 'none', fontFamily: 'var(--font)' }}
                    defaultValue={msg.text} autoFocus
                    rows={Math.max(2, Math.ceil(msg.text.length / 35))}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(msg.id, e.target.value); }
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                    <button onClick={() => setEditingId(null)} style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}>Cancel</button>
                    <button onClick={e => handleSaveEdit(msg.id, e.target.closest('div').previousSibling.value)}
                      style={{ fontSize: '11px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', borderRadius: '2px', color: 'var(--text-primary)', padding: '2px 10px', cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 600 }}>Save</button>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '10px 12px', fontSize: '13px', lineHeight: 1.6, borderRadius: '2px',
                  background: msg.sender === 'ai' ? 'var(--bg-surface)' : 'var(--bg-active)',
                  color: msg.sender === 'ai' ? 'var(--text-primary)' : 'var(--text-primary)',
                  border: `1px solid ${msg.isError ? 'var(--state-danger)' : msg.sender === 'ai' ? 'var(--border-default)' : 'var(--border-accent)'}`,
                }}>
                  {msg.text}
                </div>
              )}

              {/* Timestamp + actions */}
              {editingId !== msg.id && (
                <div className={`flex items-center gap-2 mt-1 ${msg.sender === "user" ? "flex-row-reverse" : ""}`}>
                  <span className="text-[9px] text-gray-400 px-1">{msg.time}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setReplyingTo(msg)} className="p-1 text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-white/8 transition-all" title="Reply"><CornerUpLeft size={11} /></button>
                    <button onClick={() => navigator.clipboard.writeText(msg.text)} className="p-1 text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-white/8 transition-all" title="Copy"><Copy size={11} /></button>
                    {msg.sender === "user" && (
                      <button onClick={() => setEditingId(msg.id)} className="p-1 text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-white/8 transition-all" title="Edit"><Edit2 size={11} /></button>
                    )}
                  </div>
                </div>
              )}

              {/* Action badges */}
              {msg.actions?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {msg.actions.map((act, j) => (
                    <span key={j} className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/30">
                      <span>✓</span>{act.function.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing dots */}
        {isTyping && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', opacity: 0.7, animation: 'bounce 1s infinite', animationDelay: `${i * 120}ms`, display: 'inline-block' }} />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* ── Quick actions ── */}
      {messages.length < 3 && (
        <div style={{ padding: '0 10px 8px', display: 'flex', gap: '6px', overflowX: 'auto', flexShrink: 0 }} className="no-scrollbar">
          {QUICK_ACTIONS.map(({ icon: Icon, label, prompt }) => (
            <button key={label} onClick={() => handleSend(prompt)}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'var(--font)', transition: '150ms ease' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <Icon size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── Input area ── */}
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

        {showAttach && (
          <div ref={attachRef} style={{ position: 'absolute', bottom: '60px', left: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', overflow: 'hidden', zIndex: 20, width: '110px' }}>
            {[{ icon: Image, label: 'Photo' }, { icon: FileText, label: 'File' }].map(({ icon: Icon, label }) => (
              <button key={label} onClick={() => setShowAttach(false)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', background: 'none', border: 'none', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font)', transition: '150ms ease' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <Icon size={12} style={{ color: 'var(--text-muted)' }} />{label}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '2px', padding: '8px 10px', transition: '150ms ease' }}
          onFocusCapture={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
          onBlurCapture={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
        >
          <button ref={attachBtnRef} onClick={() => setShowAttach(v => !v)}
            style={{ padding: '3px', borderRadius: '2px', color: showAttach ? 'var(--accent)' : 'var(--text-muted)', background: showAttach ? 'var(--accent-dim)' : 'none', border: 'none', cursor: 'pointer', display: 'flex', transition: '150ms ease' }}
            onMouseEnter={e => { if (!showAttach) e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { if (!showAttach) e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <Plus size={16} />
          </button>
          <textarea ref={textRef} rows={1} value={input} onChange={e => setInput(e.target.value)}
            placeholder="Message Chttrix AI…"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '13px', color: 'var(--text-primary)', resize: 'none', padding: '1px 0', maxHeight: '112px', fontFamily: 'var(--font)' }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button style={{ padding: '4px', color: 'var(--text-muted)', background: 'none', border: 'none', borderRadius: '2px', cursor: 'pointer', display: 'flex', transition: '150ms ease' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            ><Mic size={15} /></button>
            <button onClick={() => handleSend()} disabled={!input.trim()}
              style={{ padding: '5px', background: input.trim() ? 'var(--accent-dim)' : 'none', border: `1px solid ${input.trim() ? 'var(--accent)' : 'transparent'}`, borderRadius: '2px', color: input.trim() ? 'var(--accent)' : 'var(--text-muted)', cursor: input.trim() ? 'pointer' : 'not-allowed', display: 'flex', transition: '150ms ease' }}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
        <p style={{ textAlign: 'center', fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px' }}>AI can make mistakes. Check important info.</p>
      </div>
    </div>
  );

  if (isSidebar) return panel;

  return (
    <Rnd
      default={{ x: window.innerWidth - 420, y: 80, width: 380, height: 620 }}
      minWidth={320} minHeight={400} bounds="window"
      className="z-50" enableResizing dragHandleClassName="cursor-move"
    >
      {panel}
    </Rnd>
  );
};

export default ChttrixAIChat;
