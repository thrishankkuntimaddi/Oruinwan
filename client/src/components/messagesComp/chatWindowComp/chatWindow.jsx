// client/src/components/messagesComp/chatWindowComp/chatWindow.jsx

import React, { useEffect, useRef, useState } from "react";
import "./chatWindow.css";

import Header from "./header/header.jsx";
import PinnedMessage from "./pinned/pinnedMessage.jsx";
import ContactInfoModal from "./modals/contactInfoModal.jsx";
import ContactShareModal from "./modals/contactShareModal.jsx";
import ChannelManagementModal from "../ChannelManagementModal.jsx";
import ThreadPanel from "./ThreadPanel.jsx";
import MessagesContainer from "./messages/messagesContainer.jsx";
import SelectionToolbar from "./toolbar/selectionToolbar.jsx";
import ReplyPreview from "./messages/replyPreview.jsx";
import FooterInput from "./footer/footerInput.jsx";

import { pickFile, formatTime as fmtTime } from "./helpers/helpers.js";

import { io } from "socket.io-client";
import axios from "axios";
import { jwtDecode } from "jwt-decode";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function ChatWindow({ chat, onClose, contacts = [] }) {
  /* ---------------------------------------------------------
      STATE
  --------------------------------------------------------- */
  const [messages, setMessages] = useState([]);
  const pendingMessagesRef = useRef({});

  const [newMessage, setNewMessage] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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
  const [showChannelManagement, setShowChannelManagement] = useState(false);

  const [activeThreadId, setActiveThreadId] = useState(null);
  const [threadCounts, setThreadCounts] = useState({});

  const [openMsgMenuId, setOpenMsgMenuId] = useState(null);
  const [reactions, setReactions] = useState({});

  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [connected, setConnected] = useState(false);

  const currentUserIdRef = useRef(null);

  /* ---------------------------------------------------------
      HELPERS
  --------------------------------------------------------- */
  const formatTime = (iso) => fmtTime(iso);

  const getAccessToken = () => {
    const t = localStorage.getItem("accessToken");
    if (t) return t;

    const match = document.cookie.match(/(^| )accessToken=([^;]+)/);
    if (match) return match[2];

    return null;
  };

  const mapBackendMsgToUI = (m) => {
    const senderId =
      typeof m.senderId === "object"
        ? m.senderId._id || m.senderId.id || m.senderId
        : m.senderId;

    const me = senderId === currentUserIdRef.current;

    return {
      id: m._id,
      sender: me ? "you" : "them",
      text: m.text || "",
      ts: m.createdAt,
      repliedToId: m.replyTo?._id || m.replyTo || null,
      backend: m,
    };
  };

  const generateTempId = () => `temp-${crypto.randomUUID()}`;

  /* ---------------------------------------------------------
      LOAD CURRENT USER FROM TOKEN
  --------------------------------------------------------- */
  useEffect(() => {
    const t = getAccessToken();
    if (!t) return;

    try {
      const d = jwtDecode(t);
      currentUserIdRef.current =
        d.sub || d.id || d.userId || null;
    } catch { }
  }, []);

  /* ---------------------------------------------------------
      LOAD CHAT HISTORY
  --------------------------------------------------------- */
  useEffect(() => {
    if (!chat) return;

    let mounted = true;

    async function loadMessages() {
      const token = getAccessToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      let url =
        chat.type === "dm"
          ? `${API_BASE}/api/messages/dm/${chat.id}`
          : `${API_BASE}/api/messages/channel/${chat.id}`;

      try {
        const res = await axios.get(url, { headers });
        const msgs = res.data.messages.map(mapBackendMsgToUI);

        if (mounted) setMessages(msgs);

        // Trigger read receipts
        if (socketRef.current?.connected) {
          socketRef.current.emit("mark-chat-read", {
            type: chat.type,
            id: chat.id,
          });
        }
      } catch (err) {
        console.error("Load messages error:", err);
      }
    }

    loadMessages();
    return () => (mounted = false);
  }, [chat]);

  /* ---------------------------------------------------------
      SOCKET SETUP
  --------------------------------------------------------- */
  useEffect(() => {
    const token = getAccessToken();

    const socket = io(API_BASE, {
      auth: { token },
      transports: ["websocket"],
    });

    socketRef.current = socket;

    /* --- Connection --- */
    socket.on("connect", () => {
      setConnected(true);

      if (!chat) return;

      if (chat.type === "dm") {
        socket.emit("join-dm", { otherUserId: chat.id });
      } else {
        socket.emit("join-channel", { channelId: chat.id });
      }
    });

    socket.on("disconnect", () => setConnected(false));

    /* --- NEW MESSAGE --- */
    socket.on("new-message", ({ message, clientTempId }) => {
      const realMsg = mapBackendMsgToUI(message);

      // Replace optimistic message
      if (clientTempId && pendingMessagesRef.current[clientTempId]) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === clientTempId
              ? { ...realMsg, sending: false, temp: false }
              : m
          )
        );

        delete pendingMessagesRef.current[clientTempId];
        return;
      }

      // Normal incoming message
      setMessages((prev) => {
        if (prev.some((x) => x.id === realMsg.id)) return prev;
        return [...prev, realMsg];
      });
    });

    /* --- SEND ERROR --- */
    socket.on("send-error", ({ clientTempId }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === clientTempId ? { ...m, sending: false, failed: true } : m
        )
      );
    });

    /* --- READ RECEIPTS --- */
    socket.on("read-update", ({ readerId, messageIds }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (!m.backend) return m;

          if (messageIds.includes(m.backend._id?.toString())) {
            const readBy = new Set(m.backend.readBy || []);
            readBy.add(readerId);

            return {
              ...m,
              backend: { ...m.backend, readBy: Array.from(readBy) },
            };
          }
          return m;
        })
      );
    });

    /* --- TYPING --- */
    socket.on("typing", ({ from }) => {
      if (!from) return;
      setTypingUsers((prev) =>
        prev.includes(from) ? prev : [...prev, from]
      );

      setTimeout(() => {
        setTypingUsers((prev) => prev.filter((u) => u !== from));
      }, 3000);
    });

    /* --- THREAD REPLIES --- */
    socket.on("thread-reply", ({ parentId }) => {
      // Update thread count for the parent message
      setThreadCounts((prev) => ({
        ...prev,
        [parentId]: (prev[parentId] || 0) + 1,
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, [chat]);

  /* ---------------------------------------------------------
      SEND MESSAGE
  --------------------------------------------------------- */
  const onInputChange = (e) => {
    setNewMessage(e.target.value);

    if (typingTimeoutRef.current)
      clearTimeout(typingTimeoutRef.current);

    const socket = socketRef.current;
    if (socket && connected) {
      socket.emit("typing", {
        receiverId: chat.type === "dm" ? chat.id : null,
        channelId: chat.type === "channel" ? chat.id : null,
      });
    }

    typingTimeoutRef.current = setTimeout(() => { }, 2000);
  };

  const sendMessage = () => {
    if (!newMessage.trim() || blocked) return;

    const socket = socketRef.current;
    if (!socket || !connected) return;

    const clientTempId = generateTempId();

    // Show optimistic UI message
    const uiMsg = {
      id: clientTempId,
      sender: "you",
      text: newMessage.trim(),
      ts: new Date().toISOString(),
      temp: true,
      sending: true,
      repliedToId:
        replyingTo?.backend?._id ?? replyingTo?.id ?? null,
    };

    setMessages((prev) => [...prev, uiMsg]);
    pendingMessagesRef.current[clientTempId] = uiMsg;

    socket.emit("send-message", {
      text: newMessage.trim(),
      attachments: [],
      replyTo: uiMsg.repliedToId,
      clientTempId,
      receiverId: chat.type === "dm" ? chat.id : null,
      channelId: chat.type === "channel" ? chat.id : null,
    });

    setNewMessage("");
    setReplyingTo(null);
  };

  /* ---------------------------------------------------------
      ATTACHMENTS
  --------------------------------------------------------- */
  const handleAttach = async (type) => {
    setShowAttach(false);

    const socket = socketRef.current;
    if (!socket) return;

    if (type === "photo") {
      const f = await pickFile("image/*");
      if (!f) return;

      socket.emit("send-message", {
        text: `[Photo] ${f.name}`,
        attachments: [
          { type: "image", url: URL.createObjectURL(f), name: f.name },
        ],
        receiverId: chat.type === "dm" ? chat.id : null,
        channelId: chat.type === "channel" ? chat.id : null,
      });
    }

    if (type === "file") {
      const f = await pickFile(".pdf,.doc,.docx,.xls,.xlsx");
      if (!f) return;

      socket.emit("send-message", {
        text: `[File] ${f.name}`,
        attachments: [
          { type: "file", url: URL.createObjectURL(f), name: f.name },
        ],
        receiverId: chat.type === "dm" ? chat.id : null,
        channelId: chat.type === "channel" ? chat.id : null,
      });
    }

    if (type === "contact") {
      setShowContactShare(true);
    }
  };

  const shareContact = (c) => {
    setShowContactShare(false);

    const socket = socketRef.current;
    if (!socket) return;

    socket.emit("send-message", {
      text: `[Contact] ${c.name}`,
      attachments: [{ type: "contact", url: "", name: c.name }],
      receiverId: chat.type === "dm" ? chat.id : null,
      channelId: chat.type === "channel" ? chat.id : null,
    });
  };

  /* ---------------------------------------------------------
      MESSAGE MENU ACTIONS
  --------------------------------------------------------- */
  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const set = new Set(prev);
      set.has(id) ? set.delete(id) : set.add(id);
      return set;
    });
  };

  const deleteSelected = () => {
    setMessages((prev) =>
      prev.filter((m) => !selectedIds.has(m.id))
    );
    setSelectedIds(new Set());
    setSelectMode(false);
  };

  const pinMessage = (id) => {
    setPinnedId((p) => (p === id ? null : id));
    setOpenMsgMenuId(null);
  };

  const replyToMessage = (id) => {
    setReplyingTo(messages.find((m) => m.id === id));
    setOpenMsgMenuId(null);
  };

  const addReaction = (id, emoji) => {
    setReactions((prev) => {
      const next = { ...prev };
      next[id] = next[id] || {};
      next[id][emoji] = (next[id][emoji] || 0) + 1;
      return next;
    });
  };

  /* ---------------------------------------------------------
      RENDER
  --------------------------------------------------------- */
  return (
    <div className="flex flex-col h-full w-full bg-white border rounded shadow-sm relative">

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
        setShowChannelManagement={setShowChannelManagement}
        muted={muted}
        setMuted={setMuted}
        blocked={blocked}
        setBlocked={setBlocked}
      />

      <PinnedMessage
        pinned={messages.find((m) => m.id === pinnedId)}
        onUnpin={() => setPinnedId(null)}
      />

      {showContactInfo && (
        <ContactInfoModal chat={chat} onClose={() => setShowContactInfo(false)} />
      )}

      {showContactShare && (
        <ContactShareModal
          contacts={contacts}
          onShare={shareContact}
          onClose={() => setShowContactShare(false)}
        />
      )}

      {showChannelManagement && chat.type === "channel" && (
        <ChannelManagementModal
          channel={chat}
          currentUserId={currentUserIdRef.current}
          onClose={() => setShowChannelManagement(false)}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">

        <MessagesContainer
          messages={messages}
          searchQuery={searchQuery}
          selectMode={selectMode}
          selectedIds={selectedIds}
          toggleSelect={toggleSelect}
          openMsgMenuId={openMsgMenuId}
          setOpenMsgMenuId={setOpenMsgMenuId}
          toggleMsgMenu={(e, id) => {
            e.stopPropagation();
            setOpenMsgMenuId((prev) => (prev === id ? null : id));
          }}
          reactions={reactions}
          formatTime={formatTime}
          addReaction={addReaction}
          pinMessage={pinMessage}
          replyToMessage={replyToMessage}
          forwardMessage={() => setShowContactShare(true)}
          copyMessage={(id) => {
            const m = messages.find((x) => x.id === id);
            if (m) navigator.clipboard.writeText(m.text);
          }}
          deleteMessage={(id) =>
            setMessages((prev) => prev.filter((m) => m.id !== id))
          }
          infoMessage={(id) => {
            const m = messages.find((x) => x.id === id);
            if (!m) return;
            alert(`Message info:\n${m.text}`);
          }}
          onOpenThread={(msgId) => setActiveThreadId(msgId)}
          threadCounts={threadCounts}
          currentUserId={currentUserIdRef.current}
        />

        {selectMode && (
          <SelectionToolbar
            selectedCount={selectedIds.size}
            onCancel={() => {
              setSelectMode(false);
              setSelectedIds(new Set());
            }}
            onDelete={deleteSelected}
          />
        )}

        <ReplyPreview
          replyingTo={replyingTo}
          onCancel={() => setReplyingTo(null)}
        />

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="px-4 py-1 text-sm text-gray-500">
            {typingUsers.length === 1 ? "Typing..." : `${typingUsers.length} typing...`}
          </div>
        )}

        <FooterInput
          newMessage={newMessage}
          onChange={onInputChange}
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

      {/* Thread Panel */}
      {activeThreadId && (
        <ThreadPanel
          parentMessageId={activeThreadId}
          onClose={() => setActiveThreadId(null)}
          socket={socketRef.current}
          currentUserId={currentUserIdRef.current}
        />
      )}
    </div>
  );
}
