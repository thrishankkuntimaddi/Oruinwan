import { useState } from "react";
import { Rnd } from "react-rnd";

const ChttrixAIChat = ({ onClose }) => {
  const [messages, setMessages] = useState([
    { sender: "ai", text: "Hi, I'm ChttrixAI. How can I help you today?" },
  ]);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages([...messages, { sender: "user", text: input }]);
    setInput("");
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { sender: "ai", text: "I'll get back to you on that!" },
      ]);
    }, 1000);
  };

  return (
    <Rnd
      default={{
        x: 850,
        y: 80,
        width: 420,
        height: 520,
      }}
      minWidth={320}
      minHeight={320}
      bounds="window"
      className="z-50"
    >
      <div className="flex flex-col h-full bg-white shadow-2xl rounded-lg border border-gray-200">
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-3 bg-[#0c77f2] text-white font-semibold text-sm rounded-t-lg">
          <span>🤖 ChttrixAI </span>
          <button onClick={onClose} className="text-white hover:text-red-300">✖</button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.sender === "ai" ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-xs px-4 py-2 rounded-lg text-sm ${
                  msg.sender === "ai"
                    ? "bg-gray-200 text-gray-800"
                    : "bg-blue-500 text-white"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        {/* Input Area */}
        <div className="p-3 border-t flex items-center gap-2 bg-white">
          {/* Attach Button */}
          <button
            className="text-xl text-gray-500 hover:text-gray-700"
            title="Attach files"
            onClick={() => alert("Attach clicked")}
          >
            ➕
          </button>

          {/* Input */}
          <input
            className="flex-1 border px-3 py-2 rounded-md text-sm focus:outline-none"
            placeholder="Message Chttrix AI..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />

          {/* Send Button */}
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
            onClick={handleSend}
          >
            Send
          </button>

          {/* Voice Button */}
          <button
            className="text-xl text-gray-500 hover:text-gray-700"
            title="Voice message"
            onClick={() => alert("Voice input")}
          >
            🎤
          </button>
        </div>
      </div>
    </Rnd>
  );
};

export default ChttrixAIChat;
