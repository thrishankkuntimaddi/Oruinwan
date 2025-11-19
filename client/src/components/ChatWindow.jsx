// src/components/ChatWindow.jsx
import React, { useEffect, useRef, useState } from "react";

/**
 * ChatWindow — final cleaned implementation
 *
 * Props:
 * - chat: { name, type: 'dm'|'channel', image?, status?, phone?, email?, about? }
 * - onClose: function
 * - contacts: optional array of contacts [{ name, phone, email }]
 *
 * Notes:
 * - This is UI-first. Replace stubs (alerts) with backend calls as needed.
 * - All helper functions are defined before return to avoid duplicate declarations.
 */

export default function ChatWindow({ chat, onClose, contacts = [] }) {
  // Messages format: { id, sender: 'you'|'them', text, ts, repliedToId? }
  const [messages, setMessages] = useState([
    { id: 1, sender: "them", text: `Hello from ${chat.name}!`, ts: new Date(Date.now() - 86400000).toISOString() }, // yesterday
    { id: 2, sender: "you", text: "Hi there!", ts: new Date().toISOString() },
  ]);

  // UI state
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const [showAttach, setShowAttach] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [recording, setRecording] = useState(false);

  const [pinnedId, setPinnedId] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);

  const [showContactInfo, setShowContactInfo] = useState(false);
  const [showContactShare, setShowContactShare] = useState(false);

  // per-message menus
  const [openMsgMenuId, setOpenMsgMenuId] = useState(null);

  // reactions stored separately: { messageId: { emoji: count } }
  const [reactions, setReactions] = useState({});

  // refs
  const containerRef = useRef(null);
  const messagesRef = useRef(null);
  const textareaRef = useRef(null);
  const searchRef = useRef(null);

  const CHECKBOX_COL_W = 50;
  const EMOJI_SHORTCUTS = ["👍", "❤️", "😂", "😊", "🔥", "🙏"];
  const EMOJIS = [
    "😀","😁","😂","🤣","😅","😊","😍","😘","😎","🤔","🤩","🙌",
    "👍","👎","👏","🙏","🔥","🎉","😢","😮","😴","🤯","🤝","💯"
  ];

  // ------------------------
  // Helper functions (defined before return)
  // ------------------------

  // Time / date helpers
  const formatTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const isSameDay = (aIso, bIso) => new Date(aIso).toDateString() === new Date(bIso).toDateString();
  const isToday = (iso) => isSameDay(iso, new Date().toISOString());
  const isYesterday = (iso) => {
    const d = new Date(iso);
    const t = new Date();
    t.setDate(t.getDate() - 1);
    return d.toDateString() === t.toDateString();
  };
  const dateLabel = (iso) => {
    if (isToday(iso)) return "TODAY";
    if (isYesterday(iso)) return "YESTERDAY";
    const d = new Date(iso);
    return d.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
  };

  // group messages by date for separators
  const groupedMessages = (() => {
    const sorted = [...messages].sort((a, b) => new Date(a.ts) - new Date(b.ts));
    const groups = [];
    sorted.forEach((m) => {
      const label = dateLabel(m.ts);
      const last = groups[groups.length - 1];
      if (!last || last.label !== label) groups.push({ label, items: [m] });
      else last.items.push(m);
    });
    return groups;
  })();

  // File picker helper that returns a File or null
  const pickFile = (accept) =>
    new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = accept;
      input.onchange = () => resolve(input.files[0] ?? null);
      input.click();
    });

  // Attach handlers
  async function handleAttach(type) {
    setShowAttach(false);
    if (type === "photo") {
      const f = await pickFile("image/*");
      if (!f) return;
      setMessages((prev) => [...prev, { id: Date.now(), sender: "you", text: `[Photo] ${f.name}`, ts: new Date().toISOString() }]);
    } else if (type === "file") {
      const f = await pickFile(".pdf,.doc,.docx,.xls,.xlsx");
      if (!f) return;
      setMessages((prev) => [...prev, { id: Date.now(), sender: "you", text: `[File] ${f.name}`, ts: new Date().toISOString() }]);
    } else if (type === "contact") {
      setShowContactShare(true);
    }
  }

  // Share contact into chat
  function shareContact(c) {
    setShowContactShare(false);
    setMessages((prev) => [...prev, { id: Date.now(), sender: "you", text: `[Contact] ${c.name}`, ts: new Date().toISOString() }]);
  }

  // Message actions: pin, reply, forward (opens contact share), copy, delete, info
  function pinMessage(id) {
    setPinnedId(id === pinnedId ? null : id);
    setOpenMsgMenuId(null);
  }
  function replyToMessage(id) {
    const m = messages.find((x) => x.id === id);
    if (!m) return;
    setReplyingTo(m);
    setOpenMsgMenuId(null);
    // focus input
    setTimeout(() => textareaRef.current?.focus(), 0);
  }
  function forwardMessage(id) {
    // open contact share modal and we'll use shareContact to send forwarded message
    setShowContactShare(true);
    setOpenMsgMenuId(null);
  }
  function copyMessage(id) {
    const m = messages.find((x) => x.id === id);
    if (m && navigator.clipboard) {
      navigator.clipboard.writeText(m.text);
    }
    setOpenMsgMenuId(null);
  }
  function deleteMessage(id) {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    setOpenMsgMenuId(null);
  }
  function infoMessage(id) {
    const m = messages.find((x) => x.id === id);
    if (!m) return alert(`Message info:\nText: ${m.text}\nSent: ${formatTime(m.ts)}`);
    setOpenMsgMenuId(null);
  }

  // reactions (stored separately)
  function addReaction(id, emoji) {
    setReactions((prev) => {
      const next = { ...prev };
      next[id] = { ...(next[id] || {}) };
      next[id][emoji] = (next[id][emoji] || 0) + 1;
      return next;
    });
    setOpenMsgMenuId(null);
  }

  // selection helpers
  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }
  function deleteSelected() {
    if (selectedIds.size === 0) return;
    setMessages((prev) => prev.filter((m) => !selectedIds.has(m.id)));
    setSelectedIds(new Set());
    setSelectMode(false);
  }

  // send message (handles reply metadata)
  function sendMessage() {
    if (!newMessage.trim() || blocked) return;
    const msg = {
      id: Date.now(),
      sender: "you",
      text: newMessage,
      ts: new Date().toISOString(),
      repliedToId: replyingTo?.id ?? null,
    };
    setMessages((prev) => [...prev, msg]);
    setNewMessage("");
    setReplyingTo(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  // message menu toggle (stop propagation)
  function toggleMsgMenu(e, id) {
    e.stopPropagation();
    setOpenMsgMenuId((prev) => (prev === id ? null : id));
  }

  // auto scroll when messages change
  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // global outside-click and ESC handling to close popups
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") {
        setShowAttach(false);
        setShowEmoji(false);
        setShowMenu(false);
        setOpenMsgMenuId(null);
        setShowContactInfo(false);
        setShowContactShare(false);
        // if nothing open, close chat
        if (!showAttach && !showEmoji && !showMenu) onClose();
      }
    }
    function onClick(e) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target)) {
        setShowAttach(false);
        setShowEmoji(false);
        setShowMenu(false);
        setOpenMsgMenuId(null);
        setShowContactInfo(false);
        setShowContactShare(false);
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
    };
  }, [onClose, showAttach, showEmoji, showMenu]);

  // textarea auto-grow
  function onTextareaInput(e) {
    setNewMessage(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(200, ta.scrollHeight) + "px";
  }

  // prevent horizontal overflow
  const containerStyle = { overflowX: "hidden" };

  // ------------------------
  // JSX
  // ------------------------
  return (
    <div ref={containerRef} className="flex flex-col h-full w-full bg-white border rounded shadow-sm relative" style={containerStyle}>
      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-[#f9fafb]">
        <div className="flex items-center gap-3 min-w-0">
          {chat.image ? (
            <img src={chat.image} alt={chat.name} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600">
              {chat.name?.charAt(0)?.toUpperCase() ?? "?"}
            </div>
          )}

          <div className="min-w-0">
            <div className="text-base font-medium truncate">{chat.name}</div>
            <div className="text-xs text-gray-500 truncate">{chat.status}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {chat.type === "dm" && (
            <>
              <button title="Voice Call" className="p-2 rounded hover:bg-gray-100">📞</button>
              <button title="Video Call" className="p-2 rounded hover:bg-gray-100">🎥</button>
            </>
          )}

          {chat.type === "channel" && (
            <>
              <button title="Meeting" className="p-2 rounded hover:bg-gray-100">🧑‍💻</button>
              <button title="Poll" className="p-2 rounded hover:bg-gray-100">📊</button>
            </>
          )}

          {/* Search */}
          <div className="relative" ref={searchRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSearch((s) => !s);
                setShowMenu(false);
              }}
              className="p-2 rounded hover:bg-gray-100"
              title="Search messages"
            >
              🔎
            </button>

            {showSearch && (
              <div onClick={(e) => e.stopPropagation()} className="absolute right-0 mt-2 w-72 bg-white border rounded shadow-md p-2 z-40">
                <input
                  className="w-full px-3 py-2 border rounded text-sm"
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-2">Press Esc to close</p>
              </div>
            )}
          </div>

          {/* Global menu */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu((s) => !s);
                setShowSearch(false);
              }}
              className="p-2 rounded hover:bg-gray-100"
              title="More"
            >
              ⋯
            </button>

            {showMenu && (
              <div onClick={(e) => e.stopPropagation()} className="absolute right-0 mt-2 w-48 bg-white border rounded shadow-md p-2 z-40 text-sm">
                <button className="w-full text-left px-2 py-1 hover:bg-gray-50 rounded" onClick={() => { setShowContactInfo(true); setShowMenu(false); }}>
                  Contact Info
                </button>
                <button className="w-full text-left px-2 py-1 hover:bg-gray-50 rounded" onClick={() => { setSelectMode(true); setShowMenu(false); }}>
                  Select Messages
                </button>
                <button className="w-full text-left px-2 py-1 hover:bg-gray-50 rounded" onClick={() => setMuted((m) => !m)}>
                  {muted ? "Unmute" : "Mute"}
                </button>
                <button className="w-full text-left px-2 py-1 hover:bg-gray-50 rounded" onClick={() => setBlocked((b) => !b)}>
                  {blocked ? "Unblock" : "Block"}
                </button>
                <div className="border-t my-1" />
                <button className="w-full text-left px-2 py-1 hover:bg-gray-50 rounded text-red-600" onClick={onClose}>
                  Close
                </button>
              </div>
            )}
          </div>

          <button onClick={onClose} className="ml-2 text-sm text-blue-500 hover:underline">
            Close
          </button>
        </div>
      </div>

      {/* PINNED (if any) */}
      {pinnedId && (() => {
        const p = messages.find((m) => m.id === pinnedId);
        if (!p) return null;
        return (
          <div className="border-b bg-yellow-50 px-4 py-2 flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-600">Pinned</div>
              <div className="font-medium text-sm">{p.text}</div>
            </div>
            <button onClick={() => setPinnedId(null)} className="text-sm text-gray-600 hover:text-red-500">Unpin</button>
          </div>
        );
      })()}

      {/* Contact Info Modal */}
      {showContactInfo && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white w-80 rounded shadow-lg p-4 relative">
            <h3 className="font-semibold text-lg mb-2">{chat.name}</h3>
            <p><strong>Phone:</strong> {chat.phone || "N/A"}</p>
            <p><strong>Email:</strong> {chat.email || "N/A"}</p>
            <p><strong>About:</strong> {chat.about || "N/A"}</p>
            <button onClick={() => setShowContactInfo(false)} className="absolute top-2 right-2 text-gray-500 hover:text-red-500">✖</button>
          </div>
        </div>
      )}

      {/* Contact Share Modal */}
      {showContactShare && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white w-96 rounded shadow-lg p-4 relative max-h-[70vh] overflow-y-auto">
            <h4 className="font-semibold mb-2">Share Contact</h4>
            {(contacts.length ? contacts : [
              { name: "John Doe", phone: "999-111-222" },
              { name: "Sarah Lee", phone: "999-222-333" },
              { name: "Ethan Carter", phone: "999-333-444" },
            ]).map((c, i) => (
              <div key={i} className="p-2 flex items-center justify-between border rounded mb-2">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-gray-500">{c.phone}</div>
                </div>
                <button onClick={() => shareContact(c)} className="px-3 py-1 bg-blue-600 text-white rounded">Share</button>
              </div>
            ))}
            <button onClick={() => setShowContactShare(false)} className="absolute top-2 right-2 text-gray-500 hover:text-red-500">✖</button>
          </div>
        </div>
      )}

      {/* MAIN: messages area + footer */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* MESSAGES */}
        <div ref={messagesRef} className="flex-1 overflow-y-auto p-4" style={{ overflowX: "hidden" }}>
          {groupedMessages.map((grp) => (
            <div key={grp.label} className="mb-4">
              <div className="flex justify-center mb-3">
                <div className="text-xs text-gray-500 px-3 py-1 bg-gray-100 rounded-full">{grp.label}</div>
              </div>

              <div className="space-y-3">
                {grp.items
                  .filter((m) => (searchQuery ? m.text.toLowerCase().includes(searchQuery.toLowerCase()) : true))
                  .map((msg) => {
                    const me = msg.sender === "you";
                    const checked = selectedIds.has(msg.id);
                    return (
                      <div key={msg.id} className="flex items-start">
                        {/* checkbox column */}
                        <div style={{ width: CHECKBOX_COL_W }} className="flex items-start justify-center">
                          {selectMode ? (
                            <input type="checkbox" checked={checked} onChange={() => toggleSelect(msg.id)} className="mt-2" />
                          ) : (
                            <div style={{ width: 18 }} />
                          )}
                        </div>

                        {/* bubble */}
                        <div
                          className={`relative max-w-[65%] px-3 py-2 rounded-lg break-words ${me ? "ml-auto bg-blue-100 text-black" : "mr-auto bg-gray-100 text-black"} group`}
                          onClick={() => selectMode && toggleSelect(msg.id)}
                        >
                          {/* arrow top-right (visible on hover) */}
                          <div className="absolute -right-8 -top-1 opacity-0 group-hover:opacity-100 transition">
                            <button onClick={(e) => toggleMsgMenu(e, msg.id)} className="p-1 rounded hover:bg-gray-200">▾</button>
                          </div>

                          {/* reply preview */}
                          {msg.repliedToId && (() => {
                            const ref = messages.find((x) => x.id === msg.repliedToId);
                            if (!ref) return null;
                            return <div className="mb-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">{ref.text}</div>;
                          })()}

                          <div className="whitespace-pre-wrap">{msg.text}</div>

                          {/* reactions badges */}
                          {reactions[msg.id] && (
                            <div className="flex gap-1 mt-2 flex-wrap">
                              {Object.entries(reactions[msg.id]).map(([emoji, count]) => (
                                <div key={emoji} className="text-xs bg-white border px-2 py-0.5 rounded-full">{emoji} {count}</div>
                              ))}
                            </div>
                          )}

                          <div className="text-xs text-gray-400 mt-1 text-right">{formatTime(msg.ts)}</div>

                          {/* message menu */}
                          {openMsgMenuId === msg.id && (
                            <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-full mt-2 w-44 bg-white border rounded shadow-md z-40 p-1 text-sm">
                              <div className="flex items-center gap-1 p-1">
                                {EMOJI_SHORTCUTS.map((r) => (
                                  <button key={r} onClick={() => addReaction(msg.id, r)} className="p-1 text-lg rounded hover:bg-gray-100">{r}</button>
                                ))}
                              </div>
                              <div className="border-t my-1" />
                              <button className="w-full text-left px-2 py-1 hover:bg-gray-50 rounded" onClick={() => pinMessage(msg.id)}>Pin</button>
                              <button className="w-full text-left px-2 py-1 hover:bg-gray-50 rounded" onClick={() => replyToMessage(msg.id)}>Reply</button>
                              <button className="w-full text-left px-2 py-1 hover:bg-gray-50 rounded" onClick={() => forwardMessage(msg.id)}>Forward</button>
                              <button className="w-full text-left px-2 py-1 hover:bg-gray-50 rounded" onClick={() => copyMessage(msg.id)}>Copy</button>
                              <button className="w-full text-left px-2 py-1 hover:bg-gray-50 rounded" onClick={() => deleteMessage(msg.id)}>Delete</button>
                              <button className="w-full text-left px-2 py-1 hover:bg-gray-50 rounded" onClick={() => infoMessage(msg.id)}>Info</button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>

        {/* selection toolbar */}
        {selectMode && (
          <div className="border-t p-2 bg-gray-50 flex items-center justify-between">
            <div className="text-sm text-gray-600">{selectedIds.size} selected</div>
            <div className="flex gap-2">
              <button onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }} className="px-3 py-1 rounded hover:bg-gray-100">Cancel</button>
              <button onClick={deleteSelected} className="px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600">Delete</button>
            </div>
          </div>
        )}

        {/* reply preview */}
        {replyingTo && (
          <div className="px-4 py-2 border-t bg-gray-50 flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500">Replying to</div>
              <div className="font-medium text-sm">{replyingTo.text}</div>
            </div>
            <button onClick={() => setReplyingTo(null)} className="text-gray-500">✖</button>
          </div>
        )}

        {/* FOOTER */}
        <div className="border-t p-2 flex items-end gap-2 bg-white">
          {/* Attach */}
          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); setShowAttach((s) => !s); setShowEmoji(false); }} className="p-2 rounded hover:bg-gray-100">＋</button>
            {showAttach && (
              <div onClick={(e) => e.stopPropagation()} className="absolute bottom-12 left-0 bg-white border rounded shadow-md p-2 text-sm flex flex-col z-40">
                <button className="px-2 py-1 hover:bg-gray-50 rounded" onClick={() => handleAttach("photo")}>Photo / Video</button>
                <button className="px-2 py-1 hover:bg-gray-50 rounded" onClick={() => handleAttach("file")}>File</button>
                <button className="px-2 py-1 hover:bg-gray-50 rounded" onClick={() => handleAttach("contact")}>Contact</button>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              rows={1}
              value={newMessage}
              onChange={onTextareaInput}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={blocked ? "Cannot send messages" : "Type a message..."}
              className="w-full resize-none overflow-hidden px-4 py-2 border rounded-lg text-sm focus:outline-none"
            />
          </div>

          {/* Emoji picker */}
          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); setShowEmoji((s) => !s); setShowAttach(false); }} className="p-2 rounded hover:bg-gray-100">😊</button>
            {showEmoji && (
              <div onClick={(e) => e.stopPropagation()} className="absolute bottom-12 right-0 bg-white border rounded shadow-md p-3 w-72 max-h-56 overflow-y-auto grid grid-cols-8 gap-2 z-40">
                {EMOJIS.map((em) => (
                  <button key={em} onClick={() => { setNewMessage((m) => m + em); setShowEmoji(false); }} className="p-1 text-2xl rounded hover:bg-gray-100">{em}</button>
                ))}
              </div>
            )}
          </div>

          {/* Voice + Send */}
          <button onClick={() => { if (!blocked) { setRecording((r) => { const nr = !r; if (r) { setMessages((m) => [...m, { id: Date.now(), sender: "you", text: "[Voice message]", ts: new Date().toISOString() }]); } return nr; }); } }} className={`p-2 rounded ${recording ? "bg-red-100" : "hover:bg-gray-100"}`} title="Voice">🎤</button>

          <button onClick={sendMessage} className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm">➤</button>
        </div>
      </div>
    </div>
  );
}
