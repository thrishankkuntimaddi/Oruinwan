// src/components/messageComp/chatWindow/chatWindow.jsx
import React, { useState } from "react";
import "./chatWindow.css";

import Header from "./header/header.jsx";
import PinnedMessage from "./pinned/pinnedMessage.jsx";
import ContactInfoModal from "./modals/contactInfoModal.jsx";
import ContactShareModal from "./modals/contactShareModal.jsx";
import MessagesContainer from "./messages/messagesContainer.jsx";
import SelectionToolbar from "./toolbar/selectionToolbar.jsx";
import ReplyPreview from "./messages/replyPreview.jsx";
import FooterInput from "./footer/footerInput.jsx";

import { pickFile, formatTime as fmtTime } from "./helpers/helpers.js";

export default function ChatWindow({ chat, onClose, contacts = [] }) {
  const [messages, setMessages] = useState([
    { id: 1, sender: "them", text: `Hello from ${chat.name}!`, ts: new Date(Date.now() - 86400000).toISOString() },
    { id: 2, sender: "you", text: "Hi there!", ts: new Date().toISOString() },
  ]);

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

  const [openMsgMenuId, setOpenMsgMenuId] = useState(null);
  const [reactions, setReactions] = useState({});

  // small helpers here to pass down
  const formatTime = (iso) => fmtTime(iso);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
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
  };

  function shareContact(c) {
    setShowContactShare(false);
    setMessages((prev) => [...prev, { id: Date.now(), sender: "you", text: `[Contact] ${c.name}`, ts: new Date().toISOString() }]);
  }

  function pinMessage(id) {
    setPinnedId((prev) => (prev === id ? null : id));
    setOpenMsgMenuId(null);
  }
  function replyToMessage(id) {
    const m = messages.find((x) => x.id === id);
    if (!m) return;
    setReplyingTo(m);
    setOpenMsgMenuId(null);
  }
  function forwardMessage(id) {
    setShowContactShare(true);
    setOpenMsgMenuId(null);
  }
  function copyMessage(id) {
    const m = messages.find((x) => x.id === id);
    if (m && navigator.clipboard) navigator.clipboard.writeText(m.text);
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

  function addReaction(id, emoji) {
    setReactions((prev) => {
      const next = { ...prev };
      next[id] = { ...(next[id] || {}) };
      next[id][emoji] = (next[id][emoji] || 0) + 1;
      return next;
    });
    setOpenMsgMenuId(null);
  }

  function toggleMsgMenu(e, id) {
    e.stopPropagation();
    setOpenMsgMenuId((prev) => (prev === id ? null : id));
  }

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
  }

  return (
    <div className="flex flex-col h-full w-full bg-white border rounded shadow-sm relative" style={{ overflowX: "hidden" }}>
      <Header
        chat={chat}
        onClose={onClose}
        showSearch={showSearch}
        setShowSearch={setShowSearch}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        showMenu={showMenu}
        setShowMenu={setShowMenu}
        setSelectMode={setSelectMode}
        setShowContactInfo={setShowContactInfo}
        muted={muted}
        setMuted={setMuted}
        blocked={blocked}
        setBlocked={setBlocked}
      />

      <PinnedMessage pinned={messages.find((m) => m.id === pinnedId)} onUnpin={() => setPinnedId(null)} />

      {showContactInfo && <ContactInfoModal chat={chat} onClose={() => setShowContactInfo(false)} />}

      {showContactShare && <ContactShareModal contacts={contacts} onShare={shareContact} onClose={() => setShowContactShare(false)} />}

      <div className="flex-1 flex flex-col overflow-hidden">
        <MessagesContainer
          messages={messages}
          searchQuery={searchQuery}
          setOpenMsgMenuId={setOpenMsgMenuId}
          openMsgMenuId={openMsgMenuId}
          toggleMsgMenu={toggleMsgMenu}
          selectMode={selectMode}
          selectedIds={selectedIds}
          toggleSelect={toggleSelect}
          reactions={reactions}
          formatTime={formatTime}
          addReaction={addReaction}
          pinMessage={pinMessage}
          replyToMessage={replyToMessage}
          forwardMessage={forwardMessage}
          copyMessage={copyMessage}
          deleteMessage={deleteMessage}
          infoMessage={infoMessage}
        />

        {selectMode && <SelectionToolbar selectedCount={selectedIds.size} onCancel={() => { setSelectMode(false); setSelectedIds(new Set()); }} onDelete={deleteSelected} />}

        <ReplyPreview replyingTo={replyingTo} onCancel={() => setReplyingTo(null)} />

        <FooterInput
          newMessage={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onSend={sendMessage}
          onAttach={handleAttach}
          showAttach={showAttach}
          setShowAttach={setShowAttach}
          showEmoji={showEmoji}
          setShowEmoji={setShowEmoji}
          onPickEmoji={(em) => setNewMessage((m) => m + em)}
          recording={recording}
          setRecording={setRecording}
          blocked={blocked}
        />
      </div>
    </div>
  );
}
