import { useState, useRef, useEffect } from "react";
import { Rnd } from "react-rnd";

const ChttrixAIChat = ({ onClose, isSidebar = false }) => {
  const [messages, setMessages] = useState([
    { sender: "ai", text: "Hi, I'm ChttrixAI. How can I help you today?", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages, isTyping]);

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

  const QuickAction = ({ icon, label, onClick }) => (
    <button
      onClick={onClick}
      className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all shadow-sm whitespace-nowrap"
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );

  const Content = () => (
    <div className={`flex flex-col h-full bg-white ${!isSidebar && "shadow-2xl rounded-xl border border-gray-200 overflow-hidden"}`}>
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100 bg-white">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-md">
            AI
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 text-sm">Chttrix AI</h3>
            <div className="flex items-center">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></span>
              <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Online</span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors" title="Settings">
            ⚙️
          </button>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50 transition-colors" title="Close">
            ✕
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 custom-scrollbar">
        {/* Welcome / Empty State */}
        {messages.length === 0 && (
          <div className="text-center mt-8">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">👋</span>
            </div>
            <h4 className="text-gray-800 font-medium mb-1">Welcome to Chttrix AI</h4>
            <p className="text-gray-500 text-xs">Ask me anything or choose a quick action below.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.sender === "ai" ? "justify-start" : "justify-end"}`}>
            {msg.sender === "ai" && (
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 flex-shrink-0 flex items-center justify-center text-[10px] text-white font-bold mt-1 mr-2 shadow-sm">
                AI
              </div>
            )}
            <div className={`max-w-[80%] space-y-1 ${msg.sender === "user" ? "items-end flex flex-col" : ""}`}>
              <div
                className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm leading-relaxed ${msg.sender === "ai"
                    ? "bg-white text-gray-700 border border-gray-100 rounded-tl-none"
                    : "bg-blue-600 text-white rounded-tr-none"
                  }`}
              >
                {msg.text}
              </div>
              <span className="text-[10px] text-gray-400 px-1">
                {msg.time}
              </span>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 flex-shrink-0 flex items-center justify-center text-[10px] text-white font-bold mt-1 mr-2 shadow-sm">
              AI
            </div>
            <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center space-x-1">
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions (Horizontal Scroll) */}
      {messages.length < 3 && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 overflow-x-auto flex space-x-2 custom-scrollbar no-scrollbar">
          <QuickAction icon="📝" label="Summarize" onClick={() => handleSend("Summarize the last conversation")} />
          <QuickAction icon="🐛" label="Debug Code" onClick={() => handleSend("Help me debug this code snippet")} />
          <QuickAction icon="💡" label="Brainstorm" onClick={() => handleSend("Give me some ideas for...")} />
          <QuickAction icon="📧" label="Draft Email" onClick={() => handleSend("Draft a professional email")} />
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-100">
        <div className="flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-xl p-2 focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-400 transition-all">
          <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors" title="Attach file">
            📎
          </button>

          <textarea
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-gray-700 max-h-32 resize-none py-2"
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
            style={{ minHeight: '40px' }}
          />

          <div className="flex items-center gap-1">
            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors" title="Voice Input">
              🎤
            </button>
            <button
              className={`p-2 rounded-lg transition-all ${input.trim()
                  ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md transform hover:scale-105"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              onClick={() => handleSend()}
              disabled={!input.trim()}
            >
              ➤
            </button>
          </div>
        </div>
        <div className="text-center mt-2">
          <p className="text-[10px] text-gray-400">AI can make mistakes. Please verify important information.</p>
        </div>
      </div>
    </div>
  );

  if (isSidebar) {
    return <Content />;
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
      <Content />
    </Rnd>
  );
};

export default ChttrixAIChat;
