import { useState, useRef, useEffect } from "react";
import { Rnd } from "react-rnd";
import {
  Send, Mic, Image, FileText, X, Plus, History, Info,
  Copy, Edit2, CornerUpLeft, Monitor, List, MessageSquare, CheckSquare
} from "lucide-react";

const ChttrixAIChat = ({ onClose, isSidebar = false }) => {
  // State
  const [messages, setMessages] = useState([
    { id: 1, sender: "ai", text: "Hi, I'm ChttrixAI. How can I help you today?", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
  ]);
  const [chatHistory, setChatHistory] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [chatTitle, setChatTitle] = useState("Chttrix AI"); // Dynamic Title
  const [replyingTo, setReplyingTo] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animation after mount
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const attachMenuRef = useRef(null);
  const attachButtonRef = useRef(null);

  // Auto-scroll
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages, isTyping]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px'; // Cap height
    }
  }, [input]);

  // Click outside handler for attachment menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showAttachMenu &&
        attachMenuRef.current &&
        !attachMenuRef.current.contains(event.target) &&
        attachButtonRef.current &&
        !attachButtonRef.current.contains(event.target)
      ) {
        setShowAttachMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showAttachMenu]);

  // --- Handlers ---

  const handleSend = (text = input) => {
    if (!text.trim()) return;

    const newMessage = {
      id: Date.now(),
      sender: "user",
      text,
      replyTo: replyingTo, // Store reply context
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, newMessage]);
    setInput("");
    setReplyingTo(null); // Clear reply
    setIsTyping(true);

    // Update title if it's the first user message
    if (messages.length === 1) {
      setChatTitle(text.substring(0, 25) + (text.length > 25 ? "..." : ""));
    }

    // Simulate AI response
    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: "ai",
          text: "I'm processing your request. As an AI, I can help with code, summaries, and more!",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
      ]);
    }, 1500);
  };

  const handleSaveEdit = (id, newText) => {
    setMessages(prev => prev.map(msg =>
      msg.id === id ? { ...msg, text: newText } : msg
    ));
    setEditingMessageId(null);
  };

  const handleNewChat = () => {
    // Archive current chat if it has user messages
    if (messages.length > 1) {
      const newHistoryItem = {
        id: Date.now(),
        title: chatTitle,
        messages: [...messages],
        date: new Date().toLocaleDateString()
      };
      setChatHistory(prev => [newHistoryItem, ...prev]);
    }

    // Reset
    setMessages([{ id: Date.now(), sender: "ai", text: "Hi, I'm ChttrixAI. How can I help you today?", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    setChatTitle("Chttrix AI");
    setShowHistory(false);
  };

  const loadChatFromHistory = (chat) => {
    // Save current if needed
    if (messages.length > 1) {
      const currentHistoryItem = {
        id: Date.now(),
        title: chatTitle,
        messages: [...messages],
        date: new Date().toLocaleDateString()
      };
      setChatHistory(prev => [currentHistoryItem, ...prev]);
    }

    setMessages(chat.messages);
    setChatTitle(chat.title);
    setShowHistory(false);
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
  };

  const handleReply = (msg) => {
    setReplyingTo(msg);
    textareaRef.current?.focus();
  };

  const handleEdit = (msg) => {
    setEditingMessageId(msg.id);
  };

  const QuickAction = ({ icon: Icon, label, onClick }) => (
    <button
      onClick={onClick}
      className="flex items-center space-x-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-md text-xs text-gray-600 transition-colors border border-transparent hover:border-gray-200 whitespace-nowrap"
    >
      <Icon size={14} className="text-gray-500" />
      <span>{label}</span>
    </button>
  );

  const renderContent = () => (
    <div className={`flex flex-col h-full bg-white relative transition-all duration-300 ease-out transform ${isVisible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"
      } ${!isSidebar && "shadow-2xl rounded-xl border border-gray-200 overflow-hidden"}`}>

      {/* --- Info Modal --- */}
      {showInfoModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl border border-gray-100 w-[85%] max-w-sm p-6 relative">
            <button onClick={() => setShowInfoModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>

            <div className="text-center mb-6">
              <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-600">
                <Info size={20} />
              </div>
              <h3 className="text-base font-semibold text-gray-900">About Chttrix AI</h3>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Capabilities</h4>
                <ul className="text-xs text-gray-600 space-y-1.5 list-disc pl-4">
                  <li>Answer questions & summarize chats</li>
                  <li>Help debug code & write snippets</li>
                  <li>Draft emails & organize tasks</li>
                  <li>Analyze screen content (Vision)</li>
                </ul>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Precautions</h4>
                <ul className="text-xs text-gray-600 space-y-1.5 list-disc pl-4">
                  <li>I may occasionally generate incorrect info.</li>
                  <li>Verify important data manually.</li>
                  <li>Do not share sensitive personal info.</li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => setShowInfoModal(false)}
              className="w-full mt-6 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* --- History Sidebar Overlay --- */}
      {showHistory && (
        <div className="absolute inset-0 z-20 flex">
          <div className="w-64 bg-white border-r border-gray-100 shadow-lg flex flex-col animate-fade-in-left">
            <div className="p-4 border-b border-gray-50 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900 text-sm">History</h3>
              <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {chatHistory.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400">No history yet</div>
              ) : (
                chatHistory.map(chat => (
                  <button
                    key={chat.id}
                    onClick={() => loadChatFromHistory(chat)}
                    className="w-full text-left px-3 py-2.5 text-xs text-gray-700 hover:bg-gray-50 rounded-md transition-colors truncate group"
                  >
                    <div className="font-medium truncate group-hover:text-blue-600 transition-colors">{chat.title}</div>
                    <div className="text-[9px] text-gray-400 mt-0.5">{chat.date}</div>
                  </button>
                ))
              )}
            </div>
          </div>
          <div className="flex-1 bg-white/60 backdrop-blur-sm" onClick={() => setShowHistory(false)}></div>
        </div>
      )}

      {/* --- Header --- */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img src="/assets/Logoat.jpg" alt="AI" className="w-6 h-6 rounded-md object-cover" />
            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 border-2 border-white rounded-full"></span>
          </div>
          <div className="flex flex-col">
            <h3 className="font-semibold text-gray-900 text-sm leading-tight">{chatTitle}</h3>
            {chatTitle === "Chttrix AI" && <span className="text-[10px] text-gray-400 font-medium">Assistant</span>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowInfoModal(true)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md transition-colors" title="Info">
            <Info size={16} />
          </button>
          <button onClick={() => setShowHistory(!showHistory)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md transition-colors" title="History">
            <History size={16} />
          </button>
          <button onClick={handleNewChat} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-md transition-colors" title="New Chat">
            <Plus size={16} />
          </button>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-red-500 rounded-md transition-colors" title="Close">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* --- Messages Area --- */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
        {/* Welcome / Empty State */}
        {messages.length === 1 && (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 animate-fade-in">
            <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mb-4 text-gray-400">
              <Monitor size={24} />
            </div>
            <h4 className="text-gray-900 font-medium text-sm mb-1">Chttrix AI</h4>
            <p className="text-gray-500 text-xs">How can I help you today?</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={msg.id || i} className={`flex w-full ${msg.sender === "ai" ? "justify-start" : "justify-end"} animate-fade-in-up group`}>
            <div className={`flex flex-col max-w-[85%] ${msg.sender === "user" ? "items-end" : "items-start"}`}>

              {/* Reply Context */}
              {msg.replyTo && (
                <div className={`mb-1 px-3 py-1 text-xs rounded-lg border-l-2 bg-gray-50 text-gray-500 truncate max-w-full ${msg.sender === "user" ? "border-blue-500 self-end" : "border-gray-400 self-start"}`}>
                  <span className="font-semibold block text-[10px]">{msg.replyTo.sender === "user" ? "You" : "Chttrix AI"}</span>
                  {msg.replyTo.text.substring(0, 50)}...
                </div>
              )}

              {editingMessageId === msg.id ? (
                <div className="flex flex-col gap-2 w-full min-w-[200px] bg-gray-100 text-gray-900 rounded-lg p-3 shadow-sm">
                  <textarea
                    className="w-full text-sm text-gray-900 bg-transparent border-none outline-none focus:outline-none focus:ring-0 resize-none p-0 leading-relaxed placeholder-gray-500"
                    defaultValue={msg.text}
                    autoFocus
                    rows={Math.max(2, Math.ceil(msg.text.length / 30))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSaveEdit(msg.id, e.target.value);
                      }
                      if (e.key === "Escape") setEditingMessageId(null);
                    }}
                  />
                  <div className="flex justify-end gap-2 mt-1">
                    <button onClick={() => setEditingMessageId(null)} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Cancel</button>
                    <button onClick={(e) => handleSaveEdit(msg.id, e.target.parentElement.previousSibling.value)} className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-800 px-2 py-0.5 rounded transition-colors font-medium">Save</button>
                  </div>
                </div>
              ) : (
                <div
                  className={`px-3 py-2 text-sm leading-relaxed ${msg.sender === "ai"
                    ? "text-gray-800"
                    : "bg-gray-100 text-gray-900 rounded-lg"
                    }`}
                >
                  {msg.text}
                </div>
              )}

              {/* Message Actions */}
              {editingMessageId !== msg.id && (
                <div className={`flex gap-2 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${msg.sender === "user" ? "mr-1" : "ml-1"}`}>
                  <button onClick={() => handleReply(msg)} className="text-gray-400 hover:text-gray-600 transition-colors" title="Reply">
                    <CornerUpLeft size={12} />
                  </button>
                  <button onClick={() => handleCopy(msg.text)} className="text-gray-400 hover:text-gray-600 transition-colors" title="Copy">
                    <Copy size={12} />
                  </button>
                  {msg.sender === "user" && (
                    <button onClick={() => handleEdit(msg)} className="text-gray-400 hover:text-gray-600 transition-colors" title="Edit">
                      <Edit2 size={12} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start animate-pulse pl-1">
            <span className="text-xs text-gray-400">Thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* --- Quick Actions --- */}
      {messages.length < 3 && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
          <QuickAction icon={Monitor} label="Screen Context" onClick={() => handleSend("Analyze what's currently on my screen")} />
          <QuickAction icon={List} label="Summarize" onClick={() => handleSend("Summarize the recent messages")} />
          <QuickAction icon={MessageSquare} label="Draft Msg" onClick={() => handleSend("Help me draft a message")} />
          <QuickAction icon={CheckSquare} label="Add Task" onClick={() => handleSend("Add a new task to my list")} />
        </div>
      )}

      {/* --- Input Area --- */}
      <div className="p-3 bg-white border-t border-gray-100 relative">
        {/* Reply Preview Banner */}
        {replyingTo && (
          <div className="flex items-center justify-between bg-gray-50 border-l-4 border-blue-500 px-3 py-2 mb-2 rounded-r-lg animate-fade-in-up">
            <div className="flex flex-col overflow-hidden">
              <span className="text-xs font-bold text-blue-600">{replyingTo.sender === "user" ? "You" : "Chttrix AI"}</span>
              <span className="text-xs text-gray-500 truncate">{replyingTo.text}</span>
            </div>
            <button onClick={() => setReplyingTo(null)} className="text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Attachment Menu */}
        {showAttachMenu && (
          <div
            ref={attachMenuRef}
            className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-100 overflow-hidden animate-fade-in-up z-20 w-32"
          >
            <button className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 text-xs text-gray-700 transition-colors">
              <Image size={14} /> Photo
            </button>
            <button className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 text-xs text-gray-700 transition-colors">
              <FileText size={14} /> File
            </button>
          </div>
        )}

        <div className="flex items-end gap-2 bg-white border border-gray-200 rounded-xl px-2 py-2 focus-within:ring-1 focus-within:ring-gray-300 focus-within:border-gray-300 transition-all shadow-sm">
          <button
            ref={attachButtonRef}
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            className={`p-1.5 text-gray-400 hover:text-gray-600 rounded-md transition-colors ${showAttachMenu ? "text-gray-800 bg-gray-100" : ""}`}
            title="Attach"
          >
            <Plus size={18} />
          </button>

          <textarea
            ref={textareaRef}
            className="flex-1 bg-transparent border-none focus:ring-0 outline-none focus:outline-none text-sm text-gray-700 max-h-32 resize-none py-1 placeholder-gray-400 w-full"
            placeholder={isListening ? "Listening..." : "Message Chttrix AI..."}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsListening(!isListening)}
              className={`p-1.5 rounded-md transition-all ${isListening ? "text-red-500 animate-pulse" : "text-gray-400 hover:text-gray-600"}`}
              title="Voice Input"
            >
              <Mic size={18} />
            </button>
            <button
              className={`p-1.5 rounded-md transition-all ${input.trim()
                ? "text-blue-600 hover:bg-blue-50"
                : "text-gray-300 cursor-not-allowed"
                }`}
              onClick={() => handleSend()}
              disabled={!input.trim()}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
        <div className="text-center mt-1.5">
          <p className="text-[9px] text-gray-400">AI can make mistakes. Check important info.</p>
        </div>
      </div>
    </div>
  );

  if (isSidebar) {
    return renderContent();
  }

  return (
    <Rnd
      default={{
        x: window.innerWidth - 420,
        y: 80,
        width: 380,
        height: 600,
      }}
      minWidth={320}
      minHeight={400}
      bounds="window"
      className="z-50"
      enableResizing={true}
      dragHandleClassName="cursor-move"
    >
      {renderContent()}
    </Rnd>
  );
};

export default ChttrixAIChat;
