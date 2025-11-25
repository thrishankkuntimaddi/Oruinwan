import { useState, useRef, useEffect } from "react";
import { Rnd } from "react-rnd";

const ChttrixAIChat = ({ onClose, isSidebar = false }) => {
  const [messages, setMessages] = useState([
    { sender: "ai", text: "Hi, I'm ChttrixAI. How can I help you today?", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages, isTyping]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [input]);

  const handleSend = (text = input) => {
    if (!text.trim()) return;

    const newMessage = { sender: "user", text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setMessages(prev => [...prev, newMessage]);
    setInput("");
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        { sender: "ai", text: "I'm processing your request. As an AI, I can help with code, summaries, and more!", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      ]);
    }, 1500);
  };

  const handleNewChat = () => {
    setMessages([{ sender: "ai", text: "Hi, I'm ChttrixAI. How can I help you today?", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    setShowHistory(false);
  };

  const QuickAction = ({ icon, label, onClick }) => (
    <button
      onClick={onClick}
      className="group flex items-center space-x-2 px-4 py-2 bg-white border border-gray-100 rounded-full text-xs font-medium text-gray-600 hover:border-blue-200 hover:text-blue-600 hover:shadow-md transition-all whitespace-nowrap"
    >
      <span className="group-hover:scale-110 transition-transform">{icon}</span>
      <span>{label}</span>
    </button>
  );

  const renderContent = () => (
    <div className={`flex flex-col h-full bg-gray-50/50 relative ${!isSidebar && "shadow-2xl rounded-2xl border border-gray-200/80 overflow-hidden backdrop-blur-sm"}`}>

      {/* History Sidebar Overlay */}
      {showHistory && (
        <div className="absolute inset-0 z-20 flex">
          <div className="w-64 bg-white border-r border-gray-200 shadow-xl flex flex-col animate-fade-in-left">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900 text-sm">Chat History</h3>
              <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              <div className="text-[10px] font-bold text-gray-400 uppercase px-3 py-2">Today</div>
              <button className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors truncate">
                Project Alpha Discussion
              </button>
              <button className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors truncate">
                React Component Help
              </button>
              <div className="text-[10px] font-bold text-gray-400 uppercase px-3 py-2 mt-2">Yesterday</div>
              <button className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors truncate">
                Marketing Email Draft
              </button>
            </div>
          </div>
          <div className="flex-1 bg-black/20 backdrop-blur-sm" onClick={() => setShowHistory(false)}></div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100 bg-white/90 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-indigo-500/20">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></span>
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm tracking-tight">Chttrix AI</h3>
            <div className="text-[10px] text-gray-500 font-medium leading-none">Always active</div>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="History"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </button>
          <button
            onClick={handleNewChat}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
            title="New Chat"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
          </button>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Close">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-gradient-to-b from-gray-50 to-white">
        {/* Welcome / Empty State */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 animate-fade-in">
            <div className="w-16 h-16 bg-white rounded-2xl shadow-lg border border-gray-100 flex items-center justify-center mb-4 transform hover:scale-110 transition-transform duration-300">
              <span className="text-3xl">✨</span>
            </div>
            <h4 className="text-gray-900 font-bold text-lg mb-2">Welcome to Chttrix AI</h4>
            <p className="text-gray-500 text-sm max-w-xs leading-relaxed">I'm your personal assistant. Ask me to write code, summarize chats, or brainstorm ideas.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex w-full ${msg.sender === "ai" ? "justify-start" : "justify-end"} animate-fade-in-up`}>
            <div className={`flex flex-col max-w-[85%] ${msg.sender === "user" ? "items-end" : "items-start"}`}>
              <div
                className={`px-4 py-2 pb-5 text-sm shadow-sm leading-relaxed relative min-w-[80px] ${msg.sender === "ai"
                  ? "bg-white text-gray-700 border border-gray-100 rounded-2xl rounded-tl-none"
                  : "bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl rounded-tr-none"
                  }`}
              >
                {msg.text}
                <span className={`absolute bottom-1 right-3 text-[9px] font-medium ${msg.sender === "ai" ? "text-gray-400" : "text-blue-100 opacity-80"}`}>
                  {msg.time}
                </span>
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start animate-pulse">
            <div className="bg-white border border-gray-100 px-3 py-2 rounded-2xl rounded-tl-none shadow-sm flex items-center space-x-1.5">
              <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-1.5 h-1.5 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions (Horizontal Scroll) */}
      {messages.length < 3 && (
        <div className="px-5 py-3 bg-white/50 backdrop-blur-sm border-t border-gray-100 overflow-x-auto flex space-x-3 custom-scrollbar no-scrollbar">
          <QuickAction icon="📝" label="Summarize" onClick={() => handleSend("Summarize the last conversation")} />
          <QuickAction icon="🐛" label="Debug Code" onClick={() => handleSend("Help me debug this code snippet")} />
          <QuickAction icon="💡" label="Brainstorm" onClick={() => handleSend("Give me some ideas for...")} />
          <QuickAction icon="📧" label="Draft Email" onClick={() => handleSend("Draft a professional email")} />
        </div>
      )}

      {/* Input Area */}
      <div className="p-3 bg-white border-t border-gray-100">
        <div className="flex items-end gap-2 bg-gray-50 rounded-xl p-1.5 transition-all duration-300">
          <button className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Attach file">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
          </button>

          <textarea
            ref={textareaRef}
            className="flex-1 bg-transparent border-none focus:ring-0 outline-none focus:outline-none text-sm text-gray-700 max-h-32 resize-none py-2 placeholder-gray-400 w-full"
            placeholder="Ask Chttrix AI anything..."
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
            <button className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Voice Input">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            </button>
            <button
              className={`p-1.5 rounded-lg transition-all duration-300 ${input.trim()
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md hover:shadow-lg transform hover:scale-105"
                : "bg-gray-100 text-gray-300 cursor-not-allowed"
                }`}
              onClick={() => handleSend()}
              disabled={!input.trim()}
            >
              <svg className="w-5 h-5 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
          </div>
        </div>
        <div className="text-center mt-2">
          <p className="text-[10px] text-gray-400 font-medium">AI can make mistakes. Please verify important information.</p>
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
        x: window.innerWidth - 450,
        y: 80,
        width: 400,
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
