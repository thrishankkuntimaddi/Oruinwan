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
    <div className={`
      flex flex-col h-full relative overflow-hidden
      bg-white dark:bg-[#0f1117]
      text-gray-900 dark:text-white
      transition-all duration-300 ease-out
      ${isSidebar
        ? (visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8")
        : (visible ? "opacity-100 scale-100" : "opacity-0 scale-95")}
      ${!isSidebar && "rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10"}
    `}>

      {/* gradient top accent — looks great in both modes */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-600 via-indigo-500 to-cyan-500" />

      {/* ── Info modal ── */}
      {showInfoModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-black/70 backdrop-blur-md">
          <div className="bg-white dark:bg-[#1a1d27] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl w-[85%] max-w-sm p-6 relative">
            <button onClick={() => setShowInfoModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors">
              <X size={18} />
            </button>
            <div className="flex flex-col items-center mb-5 text-center">
              <div className="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-600/20 border border-violet-200 dark:border-violet-500/30 flex items-center justify-center mb-3">
                <Sparkles size={22} className="text-violet-600 dark:text-violet-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white text-base">About Chttrix Intelligence</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Powered by Gemini · Workspace-aware</p>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">What I can do</p>
                <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1.5">
                  {["Answer questions & summarize chats", "Help debug code & write snippets", "Draft emails & organize tasks", "Analyze screen content (Vision)"].map(c => (
                    <li key={c} className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-violet-500 flex-shrink-0" />{c}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Limitations</p>
                <ul className="text-xs text-gray-400 dark:text-gray-400 space-y-1.5">
                  {["May occasionally generate incorrect info", "Verify important data manually", "Don't share sensitive personal info"].map(c => (
                    <li key={c} className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0" />{c}</li>
                  ))}
                </ul>
              </div>
            </div>
            <button onClick={() => setShowInfoModal(false)} className="w-full mt-5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors">Got it</button>
          </div>
        </div>
      )}

      {/* ── History panel ── */}
      {showHistory && (
        <div className="absolute inset-0 z-20 flex">
          <div className="w-64 bg-white dark:bg-[#13151e] border-r border-gray-200 dark:border-white/8 flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/8">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">History</span>
              <div className="flex items-center gap-2">
                {chatHistory.length > 0 && (
                  <button onClick={() => { if (window.confirm("Clear all history?")) { setChatHistory([]); localStorage.removeItem("chttrixai_chat_history"); } }}
                    className="text-[10px] text-red-500 hover:text-red-400 transition-colors">Clear</button>
                )}
                <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"><X size={15} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {chatHistory.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400">No history yet</div>
              ) : chatHistory.map(chat => (
                <button key={chat.id} onClick={() => loadChat(chat)}
                  className="w-full text-left px-3 py-2.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg transition-all group flex items-center gap-2">
                  <MessageSquare size={12} className="flex-shrink-0 text-gray-400 group-hover:text-violet-500 transition-colors" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{chat.title}</div>
                    <div className="text-[9px] text-gray-400 mt-0.5">{chat.date}</div>
                  </div>
                  <ChevronRight size={12} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 bg-black/20 dark:bg-black/40" onClick={() => setShowHistory(false)} />
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100 dark:border-white/8 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src="/assets/ChttrixAI-logo.png"
              alt="Chttrix AI"
              className="w-8 h-8 rounded-xl object-cover shadow-md"
              onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
            />
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 items-center justify-center shadow-lg hidden">
              <Sparkles size={16} className="text-white" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-white dark:border-[#0f1117] rounded-full" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-none">{chatTitle}</h3>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 block">Chttrix Intelligence · ⌘⇧A</span>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          {[
            { icon: Info,    title: "About",    fn: () => setShowInfoModal(true) },
            { icon: History, title: "History",  fn: () => setShowHistory(v => !v) },
            { icon: Plus,    title: "New chat", fn: handleNewChat },
            { icon: X,       title: "Close",    fn: handleClose },
          ].map(({ icon: Icon, title, fn }) => (
            <button key={title} onClick={fn} title={title}
              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/8 rounded-lg transition-all">
              <Icon size={16} />
            </button>
          ))}
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 custom-scrollbar bg-gray-50/50 dark:bg-transparent">
        {/* Welcome empty state */}
        {messages.length === 1 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12 select-none">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/10 dark:from-violet-600/30 dark:to-indigo-600/20 border border-violet-200 dark:border-violet-500/20 flex items-center justify-center mb-4">
              <Sparkles size={28} className="text-violet-500 dark:text-violet-400" />
            </div>
            <h4 className="text-gray-900 dark:text-white font-semibold text-base mb-1">Chttrix Intelligence</h4>
            <p className="text-gray-500 dark:text-gray-400 text-xs max-w-[200px] leading-relaxed">Your AI assistant for messages, tasks, and workspace intelligence</p>
            <div className="flex items-center gap-1.5 mt-4 text-[10px] text-gray-400">
              <Zap size={10} className="text-violet-500" />
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
                <div className="bg-gray-100 dark:bg-white/8 rounded-xl p-3 w-full min-w-[180px]">
                  <textarea
                    className="w-full bg-transparent text-sm text-gray-900 dark:text-white border-none outline-none resize-none placeholder-gray-400"
                    defaultValue={msg.text} autoFocus
                    rows={Math.max(2, Math.ceil(msg.text.length / 35))}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSaveEdit(msg.id, e.target.value); }
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">Cancel</button>
                    <button onClick={e => handleSaveEdit(msg.id, e.target.closest(".flex").previousSibling.value)}
                      className="text-xs bg-violet-600 hover:bg-violet-500 text-white px-3 py-0.5 rounded-lg transition-colors font-medium">Save</button>
                  </div>
                </div>
              ) : (
                <div className={`px-3.5 py-2.5 text-sm leading-relaxed rounded-2xl
                  ${msg.sender === "ai"
                    ? "bg-white dark:bg-white/6 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-transparent shadow-sm dark:shadow-none rounded-tl-sm"
                    : "bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-tr-sm shadow-md shadow-violet-500/20"
                  } ${msg.isError ? "!bg-red-50 dark:!bg-red-900/20 !text-red-600 dark:!text-red-400 border !border-red-200 dark:!border-red-800/30" : ""}`}
                >
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
          <div className="flex justify-start">
            <div className="bg-white dark:bg-white/6 border border-gray-100 dark:border-transparent rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5 shadow-sm dark:shadow-none">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-violet-500 opacity-60 animate-bounce"
                  style={{ animationDelay: `${i * 120}ms` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* ── Quick actions ── */}
      {messages.length < 3 && (
        <div className="px-3 pb-2 flex gap-1.5 overflow-x-auto no-scrollbar flex-shrink-0 bg-gray-50/50 dark:bg-transparent">
          {QUICK_ACTIONS.map(({ icon: Icon, label, prompt }) => (
            <button key={label} onClick={() => handleSend(prompt)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-white/5 hover:bg-violet-50 dark:hover:bg-white/10 border border-gray-200 dark:border-white/8 hover:border-violet-300 dark:hover:border-violet-500/40 rounded-lg text-xs text-gray-600 dark:text-gray-400 hover:text-violet-700 dark:hover:text-white transition-all whitespace-nowrap flex-shrink-0 shadow-sm dark:shadow-none">
              <Icon size={12} className="text-violet-500 flex-shrink-0" />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── Input area ── */}
      <div className="px-3 pb-3 flex-shrink-0 bg-white dark:bg-transparent border-t border-gray-100 dark:border-white/8 pt-2">
        {/* Reply banner */}
        {replyingTo && (
          <div className="flex items-center justify-between bg-violet-50 dark:bg-white/5 border-l-2 border-violet-500 px-3 py-2 mb-2 rounded-r-lg">
            <div className="overflow-hidden">
              <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 block">{replyingTo.sender === "user" ? "You" : "Chttrix AI"}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate block">{replyingTo.text.slice(0, 60)}</span>
            </div>
            <button onClick={() => setReplyingTo(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors ml-2"><X size={13} /></button>
          </div>
        )}

        {/* Attach menu */}
        {showAttach && (
          <div ref={attachRef} className="absolute bottom-16 left-3 bg-white dark:bg-[#1a1d27] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden z-20 w-32">
            {[{ icon: Image, label: "Photo" }, { icon: FileText, label: "File" }].map(({ icon: Icon, label }) => (
              <button key={label} onClick={() => setShowAttach(false)}
                className="flex items-center gap-2 w-full px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-white/6 text-xs text-gray-700 dark:text-gray-300 transition-colors">
                <Icon size={13} className="text-gray-400" />{label}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 bg-gray-100 dark:bg-white/6 border border-gray-200 dark:border-white/10 rounded-2xl px-3 py-2.5 focus-within:border-violet-400 dark:focus-within:border-violet-500/50 focus-within:bg-white dark:focus-within:bg-white/8 transition-all">
          <button ref={attachBtnRef} onClick={() => setShowAttach(v => !v)}
            className={`p-1 rounded-lg transition-all ${showAttach ? "text-violet-600 bg-violet-100 dark:text-violet-400 dark:bg-violet-500/20" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"}`}>
            <Plus size={17} />
          </button>
          <textarea ref={textRef} rows={1} value={input} onChange={e => setInput(e.target.value)}
            placeholder="Message Chttrix AI…"
            className="flex-1 bg-transparent border-none outline-none text-sm text-gray-900 dark:text-white placeholder-gray-400 resize-none py-0.5 max-h-28"
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
          <div className="flex items-center gap-1">
            <button className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-all"><Mic size={17} /></button>
            <button onClick={() => handleSend()} disabled={!input.trim()}
              className={`p-1.5 rounded-xl transition-all ${input.trim()
                ? "bg-violet-600 hover:bg-violet-500 text-white shadow-md shadow-violet-500/30"
                : "text-gray-300 dark:text-gray-600 cursor-not-allowed"}`}>
              <Send size={15} />
            </button>
          </div>
        </div>
        <p className="text-center text-[9px] text-gray-400 mt-1.5">AI can make mistakes. Check important info.</p>
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
