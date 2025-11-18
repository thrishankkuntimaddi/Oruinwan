// src/components/ChatWindow.jsx
import React, { useEffect, useRef, useState } from "react";

export default function ChatWindow({ chat, onClose, contacts = [] }) {
  const [messages, setMessages] = useState([
    { id: 1, sender: "them", text: `Hello from ${chat.name}!`, time: "10:00 AM" },
    { id: 2, sender: "you", text: "Hi there!", time: "10:02 AM" },
  ]);

  const [newMessage, setNewMessage] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAttach, setShowAttach] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [recording, setRecording] = useState(false);
  const [showContactInfo, setShowContactInfo] = useState(false);

  const messagesRef = useRef(null);
  const textareaRef = useRef(null);
  const searchRef = useRef(null);

  const EMOJIS = ["😀", "😁", "😂", "😊", "😍", "🤔", "👍", "🙏", "🔥", "🎉", "😅", "🙌"];

  const isDM = chat.type === "dm";
  const isChannel = chat.type === "channel";

  // Auto-scroll messages
  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Global ESC & click outside
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") {
        setShowMenu(false);
        setShowAttach(false);
        setShowEmoji(false);
        setShowSearch(false);
        setShowContactInfo(false);
        if (!showMenu && !showAttach && !showEmoji && !showSearch) onClose();
      }
    };

    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearch(false);
      }
    };

    window.addEventListener("keydown", handleKey);
    window.addEventListener("click", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("click", handleClickOutside);
    };
  }, [onClose, showMenu, showAttach, showEmoji, showSearch]);

  const sendMessage = () => {
    if (!newMessage.trim() || blocked) return;
    const nextMsg = {
      id: Date.now(),
      sender: "you",
      text: newMessage,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, nextMsg]);
    setNewMessage("");
    setShowEmoji(false);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleTextareaInput = (e) => {
    setNewMessage(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(200, ta.scrollHeight) + "px";
  };

  const toggleSelect = (id) => {
    setSelectedIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deleteSelected = () => {
    if (selectedIds.size === 0) return;
    setMessages((prev) => prev.filter((m) => !selectedIds.has(m.id)));
    setSelectedIds(new Set());
    setSelectMode(false);
  };

  const handleAttach = async (type) => {
    setShowAttach(false);
    if (type === "photo") {
      const file = await selectFile("image/*");
      if (!file) return;
      setMessages((prev) => [...prev, { id: Date.now(), sender: "you", text: `[Photo] ${file.name}`, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
    } else if (type === "file") {
      const file = await selectFile(".pdf,.doc,.docx,.xls,.xlsx");
      if (!file) return;
      setMessages((prev) => [...prev, { id: Date.now(), sender: "you", text: `[File] ${file.name}`, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
    } else if (type === "contact") {
      const contact = contacts[0]; // For simplicity, first contact
      if (!contact) return;
      setMessages((prev) => [...prev, { id: Date.now(), sender: "you", text: `[Contact] ${contact.name}`, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
    }
  };

  const selectFile = (accept) =>
    new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = accept;
      input.onchange = () => resolve(input.files[0]);
      input.click();
    });

  const visibleMessages = searchQuery
    ? messages.filter((m) => m.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  const muteLabel = muted ? "Unmute" : "Mute";
  const blockLabel = blocked ? "Unblock" : "Block";

  return (
    <div className="flex flex-col h-full w-full border rounded-lg shadow-md">
      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-[#f9fafb] gap-2 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {chat.image ? (
            <img src={chat.image} alt={chat.name} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600">
              {chat.name?.charAt(0)?.toUpperCase() || "?"}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-base font-medium truncate">{chat.name}</p>
            <p className="text-xs text-gray-500 truncate">{chat.status}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* DM Actions */}
          {isDM && (
            <>
              <button title="Voice Call" className="p-2 rounded hover:bg-gray-100">📞</button>
              <button title="Video Call" className="p-2 rounded hover:bg-gray-100">🎥</button>
            </>
          )}

          {/* Channel Actions */}
          {isChannel && (
            <>
              <button title="Meeting" className="p-2 rounded hover:bg-gray-100">🧑‍💻</button>
              <button title="Discussion" className="p-2 rounded hover:bg-gray-100">💬</button>
              <button title="Poll" className="p-2 rounded hover:bg-gray-100">📊</button>
              <button title="Pin Message" className="p-2 rounded hover:bg-gray-100">📌</button>
            </>
          )}

          {/* Common Actions */}
          <div className="relative" ref={searchRef}>
            <button onClick={(e) => { e.stopPropagation(); setShowSearch(!showSearch); setShowMenu(false); }} className="p-2 rounded hover:bg-gray-100">🔎</button>
            {showSearch && (
              <div className="absolute right-0 mt-2 w-64 bg-white border rounded shadow-md p-2 z-30">
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search messages..." className="w-full px-3 py-2 border rounded text-sm" />
                <p className="text-xs text-gray-500 mt-2">Press Esc to close</p>
              </div>
            )}
          </div>

          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); setShowSearch(false); }} className="p-2 rounded hover:bg-gray-100">⋯</button>
            {showMenu && (
              <div className="absolute right-0 mt-2 w-44 bg-white border rounded shadow-md p-2 z-30 text-sm">
                <button className="w-full text-left px-2 py-1 hover:bg-gray-50 rounded" onClick={() => { setShowContactInfo(true); setShowMenu(false); }}>Contact Info</button>
                <button className="w-full text-left px-2 py-1 hover:bg-gray-50 rounded" onClick={() => setSelectMode(true)}>Select Messages</button>
                <button className="w-full text-left px-2 py-1 hover:bg-gray-50 rounded" onClick={() => setMuted(!muted)}>{muteLabel}</button>
                <button className="w-full text-left px-2 py-1 hover:bg-gray-50 rounded" onClick={() => setBlocked(!blocked)}>{blockLabel}</button>
                <div className="border-t my-1" />
                <button className="w-full text-left px-2 py-1 hover:bg-gray-50 rounded text-red-600" onClick={onClose}>Close</button>
              </div>
            )}
          </div>

          <button onClick={onClose} className="ml-2 text-sm text-blue-500 hover:underline">Close</button>
        </div>
      </div>

      {/* CONTACT INFO MODAL */}
      {showContactInfo && (
        <div className="absolute top-0 left-0 w-full h-full bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white w-80 rounded shadow-lg p-4 relative">
            <h3 className="font-semibold text-lg mb-2">{chat.name}</h3>
            <p><strong>Phone:</strong> {chat.phone || "N/A"}</p>
            <p><strong>Email:</strong> {chat.email || "N/A"}</p>
            <p><strong>About:</strong> {chat.about || "N/A"}</p>
            <button onClick={() => setShowContactInfo(false)} className="absolute top-2 right-2 text-gray-500 hover:text-red-500">✖</button>
          </div>
        </div>
      )}

      {/* MESSAGES AREA */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div ref={messagesRef} className={`flex-1 overflow-y-auto p-4 flex flex-col gap-2 ${selectMode ? "pl-12" : "pl-4"}`}>
          {visibleMessages.length === 0 && <div className="text-gray-400 text-center mt-8">No messages</div>}
          {visibleMessages.map((msg) => {
            const me = msg.sender === "you";
            const selected = selectedIds.has(msg.id);
            return (
              <div key={msg.id} className="flex w-full">
                <div className={`relative max-w-[70%] px-4 py-2 rounded-lg break-words ${me ? "ml-auto bg-blue-100" : "mr-auto bg-gray-100"} ${selectMode ? "cursor-pointer" : ""}`} onClick={() => selectMode && toggleSelect(msg.id)}>
                  {selectMode && <input type="checkbox" checked={selected} onChange={() => toggleSelect(msg.id)} className="absolute left-[-2.5rem] top-1 w-4 h-4" />}
                  <div className="flex justify-between items-end">
                    <span>{msg.text}</span>
                    <span className="text-xs text-gray-400 ml-2">{msg.time}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selection toolbar */}
        {selectMode && (
          <div className="border-t p-2 bg-gray-50 flex items-center justify-between">
            <div className="text-sm text-gray-600">{selectedIds.size} selected</div>
            <div className="flex gap-2">
              <button onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }} className="px-2 py-1 text-sm rounded hover:bg-gray-100">Cancel</button>
              <button onClick={deleteSelected} className="px-2 py-1 text-sm rounded bg-red-500 text-white hover:bg-red-600">Delete</button>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div className="border-t p-2 flex items-end gap-2 bg-white">
          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); setShowAttach(!showAttach); setShowEmoji(false); }} className="p-2 rounded hover:bg-gray-100">＋</button>
            {showAttach && (
              <div className="absolute bottom-12 left-0 bg-white border rounded shadow-md p-2 text-sm flex flex-col z-30">
                <button className="px-2 py-1 hover:bg-gray-50 rounded" onClick={() => handleAttach("photo")}>Photo / Video</button>
                <button className="px-2 py-1 hover:bg-gray-50 rounded" onClick={() => handleAttach("file")}>File</button>
                <button className="px-2 py-1 hover:bg-gray-50 rounded" onClick={() => handleAttach("contact")}>Contact</button>
              </div>
            )}
          </div>

          <div className="flex-1">
            <textarea
              ref={textareaRef}
              rows={1}
              value={newMessage}
              onChange={handleTextareaInput}
              onKeyDown={(e) => { if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); sendMessage(); } }}
              placeholder={blocked ? "Cannot send messages" : "Type a message..."}
              disabled={blocked}
              className="w-full resize-none overflow-hidden px-4 py-2 border rounded-lg text-sm focus:outline-none"
            />
          </div>

          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); setShowEmoji(!showEmoji); setShowAttach(false); }} className="p-2 rounded hover:bg-gray-100">😊</button>
            {showEmoji && (
              <div className="absolute bottom-12 right-0 bg-white border rounded shadow-md p-2 grid grid-cols-6 gap-1 z-30 max-h-48 overflow-y-auto">
                {EMOJIS.map((em) => (
                  <button key={em} onClick={() => { setNewMessage((m) => m + em); setShowEmoji(false); }} className="p-1 text-lg">{em}</button>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => { if(!blocked){ setRecording(!recording); if(recording){ setMessages((m)=>[...m,{id:Date.now(),sender:"you",text:"[Voice message]",time:new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}]); } } }} className={`p-2 rounded ${recording?"bg-red-100":"hover:bg-gray-100"}`} title="Voice">🎤</button>
          <button onClick={sendMessage} className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm">➤</button>
        </div>
      </div>
    </div>
  );
}
