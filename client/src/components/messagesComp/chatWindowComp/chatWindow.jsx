// client/src/components/messagesComp/chatWindowComp/chatWindow.jsx

import React, { useEffect, useRef, useState } from "react";
import "./chatWindow.css";

import Header from "./header/header.jsx";
import PinnedMessage from "./pinned/pinnedMessage.jsx";
import ContactInfoModal from "./modals/contactInfoModal.jsx";
import ContactShareModal from "./modals/contactShareModal.jsx";
import Toast from "../../ui/Toast.jsx";
import ForwardMessageModal from "./modals/ForwardMessageModal.jsx";
import ChannelManagementModal from "../ChannelManagementModal.jsx";


import ThreadPanel from "./ThreadPanel.jsx";
import MessagesContainer from "./messages/messagesContainer.jsx";
import ReplyPreview from "./messages/replyPreview.jsx";
import FooterInput from "./footer/footerInput.jsx";

import { pickFile, formatTime as fmtTime } from "./helpers/helpers.js";

import { io } from "socket.io-client";
import axios from "axios";
import { jwtDecode } from "jwt-decode";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function ChatWindow({ chat, onClose, contacts = [], onDeleteChat }) {
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
  const [channelManagementTab, setChannelManagementTab] = useState(null); // null, "members", "settings"
  const [toast, setToast] = useState({ message: "", type: "success", visible: false });

  const showToast = (message, type = "success") => {
    setToast({ message, type, visible: true });
  };

  // ...



  const [activeThread, setActiveThread] = useState(null);
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
    const senderObj = typeof m.senderId === "object" ? m.senderId : {};
    const senderId = senderObj._id || senderObj.id || m.senderId;

    const me = String(senderId) === String(currentUserIdRef.current);

    return {
      id: m._id,
      sender: me ? "you" : "them",
      senderName: senderObj.username || (me ? "You" : "Unknown"),
      senderAvatar: senderObj.profilePicture || null,
      text: m.text || "",
      ts: m.createdAt,
      repliedToId: m.replyTo?._id || m.replyTo || null,
      isPinned: m.isPinned || false,
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
      try {
        const token = getAccessToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        let url = "";
        if (chat.type === "dm") {
          url = `${API_BASE}/api/messages/dm/${chat.id}`;
        } else {
          url = `${API_BASE}/api/messages/channel/${chat.id}`;
        }

        const res = await axios.get(url, { headers });
        let loadedMessages = res.data.messages.map(mapBackendMsgToUI);

        if (!mounted) return;
        setMessages(loadedMessages);

        // Mark as read
        if (chat.type === "dm") {
          axios.post(
            `${API_BASE}/api/messages/dm/read`,
            { otherUserId: chat.id },
            { headers }
          );
          // Emit read event
          const socket = socketRef.current;
          if (socket && connected) {
            socket.emit("read-messages", {
              readerId: currentUserIdRef.current,
              otherUserId: chat.id,
            });
          }
        }
      } catch (err) {
        console.error("Load messages error:", err);
        if (!mounted) return;
        setMessages([]);
      }
    }

    loadMessages();
    return () => (mounted = false);
  }, [chat, connected]);

  /* ---------------------------------------------------------
      OUTSIDE CLICK HANDLER
  --------------------------------------------------------- */
  useEffect(() => {
    const handleClickOutside = () => {
      setShowSearch(false);
      setShowMenu(false);
      setOpenMsgMenuId(null);
    };

    if (showSearch || showMenu || openMsgMenuId) {
      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [showSearch, showMenu, openMsgMenuId]);

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
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isPinned: !m.isPinned } : m))
    );
    setOpenMsgMenuId(null);
  };

  const replyToMessage = (id) => {
    setReplyingTo(messages.find((m) => m.id === id));
    setOpenMsgMenuId(null);
  };

  const [userReactions, setUserReactions] = useState({});

  const addReaction = (id, emoji) => {
    const previousEmoji = userReactions[id];

    if (previousEmoji === emoji) {
      // Toggle off
      setUserReactions(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setReactions(prev => {
        const next = { ...prev };
        if (next[id]) {
          next[id][emoji] = Math.max(0, (next[id][emoji] || 0) - 1);
          if (next[id][emoji] === 0) delete next[id][emoji];
        }
        return next;
      });
    } else {
      // Change or Add
      setUserReactions(prev => ({ ...prev, [id]: emoji }));
      setReactions(prev => {
        const next = { ...prev };
        next[id] = next[id] || {};

        if (previousEmoji) {
          next[id][previousEmoji] = Math.max(0, (next[id][previousEmoji] || 0) - 1);
          if (next[id][previousEmoji] === 0) delete next[id][previousEmoji];
        }

        next[id][emoji] = (next[id][emoji] || 0) + 1;
        return next;
      });
    }
  };

  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardingMsgId, setForwardingMsgId] = useState(null);

  const handleForward = (target) => {
    const msg = messages.find(m => m.id === forwardingMsgId);
    if (!msg) return;

    // Simulate forwarding
    console.log(`Forwarding message "${msg.text}" to ${target.label} (${target.type})`);

    if (target.id === chat.id) {
      const clientTempId = generateTempId();
      const uiMsg = {
        id: clientTempId,
        sender: "you",
        text: `[Forwarded] ${msg.text}`,
        ts: new Date().toISOString(),
        temp: true,
        sending: true,
      };
      setMessages(prev => [...prev, uiMsg]);
    } else {
      showToast(`Message forwarded to ${target.label}`);
    }

    setShowForwardModal(false);
    setForwardingMsgId(null);
  };

  /* ---------------------------------------------------------
      RENDER
  --------------------------------------------------------- */
  return (
    <div className="flex h-full w-full bg-white overflow-hidden">

      {/* Main Chat Column */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <Header
          chat={chat}
          onClose={onClose}
          showSearch={showSearch}
          setShowSearch={setShowSearch}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          showMenu={showMenu}
          setShowMenu={setShowMenu}
          selectMode={selectMode}
          setSelectMode={setSelectMode}
          selectedCount={selectedIds.size}
          onDeleteSelected={deleteSelected}
          setShowContactInfo={setShowContactInfo}
          setShowChannelManagement={setChannelManagementTab}
          muted={muted}
          setMuted={setMuted}
          blocked={blocked}
          setBlocked={setBlocked}
          onDeleteChat={onDeleteChat}
          showToast={showToast}
        />

        <PinnedMessage
          pinned={messages.find((m) => m.id === pinnedId)}
          onUnpin={() => setPinnedId(null)}
        />

        {toast.visible && (
          <div className="absolute top-4 right-4 z-[9999]">
            <Toast
              message={toast.message}
              type={toast.type}
              onClose={() => setToast(prev => ({ ...prev, visible: false }))}
            />
          </div>
        )}

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

        {showForwardModal && (
          <ForwardMessageModal
            onClose={() => setShowForwardModal(false)}
            onForward={handleForward}
          />
        )}

        {channelManagementTab && (
          <ChannelManagementModal
            channel={chat}
            currentUserId={currentUserIdRef.current}
            initialTab={channelManagementTab}
            onClose={() => setChannelManagementTab(null)}
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
              // Safe stopPropagation
              e?.stopPropagation?.();
              setOpenMsgMenuId((prev) => (prev === id ? null : id));
            }}
            reactions={reactions}
            formatTime={formatTime}
            addReaction={addReaction}
            pinMessage={pinMessage}
            replyToMessage={replyToMessage}
            forwardMessage={(id) => {
              setForwardingMsgId(id);
              setShowForwardModal(true);
            }}
            copyMessage={(id) => {
              const m = messages.find((x) => x.id === id);
              if (m) navigator.clipboard.writeText(m.text);
            }}
            deleteMessage={(id) => {
              try {
                setMessages((prev) => prev.filter((m) => m.id !== id));
              } catch (err) {
                console.error("Failed to delete message:", err);
              }
            }}
            infoMessage={(id) => {
              const m = messages.find((x) => x.id === id);
              if (!m) return;
              showToast(`Message info: ${m.text}`, "info");
            }}
            onOpenThread={(msgId) => {
              const msg = messages.find((m) => m.id === msgId);
              if (msg) setActiveThread(msg);
            }}
            threadCounts={threadCounts}
            currentUserId={currentUserIdRef.current}
            chatType={chat.type}
          />

          {/* Selection Toolbar removed, moved to header */}

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
            setNewMessage={setNewMessage}
          />


        </div>
      </div>

      {/* Thread Panel */}
      {activeThread && (
        <ThreadPanel
          parentMessage={activeThread}
          onClose={() => setActiveThread(null)}
          socket={socketRef.current}
          currentUserId={currentUserIdRef.current}
        />
      )}
    </div>
  );
}
