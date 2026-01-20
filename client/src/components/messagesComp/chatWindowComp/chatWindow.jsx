// client/src/components/messagesComp/chatWindowComp/chatWindow.jsx

import React, { useEffect, useRef, useState, useCallback } from "react";
import "./chatWindow.css";

import Header from "./header/header.jsx";
import ContactInfoModal from "./modals/contactInfoModal.jsx";
import ContactShareModal from "./modals/contactShareModal.jsx";
import Toast from "../../../shared/components/ui/Toast";
import ForwardMessageModal from "./modals/ForwardMessageModal.jsx";
import ChannelManagementModal from "../ChannelManagementModal.jsx";
import MessageInfoModal from "./modals/MessageInfoModal.jsx";
import ConfirmationModal from "../../../shared/components/ui/ConfirmationModal";
import ThreadsViewModal from "./modals/ThreadsViewModal.jsx";
import MemberListModal from "./modals/MemberListModal.jsx";
import CreatePollModal from "./modals/CreatePollModal.jsx";


import ChannelTabs from "./tabs/ChannelTabs.jsx";
import TasksTab from "./tabs/TasksTab.jsx";
import CanvasTab from "./tabs/CanvasTab.jsx";
import PollMessage from "./messages/PollMessage.jsx";
import ThreadPanel from "./ThreadPanel.jsx";
import MessagesContainer from "./messages/messagesContainer.jsx";
import ReplyPreview from "./messages/replyPreview.jsx";
import FooterInput from "./footer/footerInput.jsx";

import { pickFile } from "./helpers/helpers.js";

import api, { pollApi } from "../../../services/api";
import { jwtDecode } from "jwt-decode";
import { useAuth } from "../../../contexts/AuthContext";
import { useSocket } from "../../../contexts/SocketContext";



export default function ChatWindow({ chat, onClose, contacts = [], onDeleteChat }) {
  const [userRole, setUserRole] = useState(null); // 'owner', 'admin', 'member', etc.
  const { accessToken } = useAuth();
  const { socket: sharedSocket, isConnected: sharedSocketConnected, addMessageListener } = useSocket();
  /* ---------------------------------------------------------
      STATE
  --------------------------------------------------------- */
  const [messages, setMessages] = useState([]);
  const [userJoinedAt, setUserJoinedAt] = useState(null); // For channel join timeline marker
  const [channelMembersWithJoinDates, setChannelMembersWithJoinDates] = useState([]); // All members with join dates
  const pendingMessagesRef = useRef({});

  // Pagination state
  const [hasMore, setHasMore] = useState(true); // Are there more messages to load?
  const [isLoadingMore, setIsLoadingMore] = useState(false); // Loading older messages?

  // TABS STATE
  const [activeTab, setActiveTab] = useState("chat"); // 'chat' or tab ID
  const [tabs, setTabs] = useState([]);

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

  const [replyingTo, setReplyingTo] = useState(null);

  const [showContactInfo, setShowContactInfo] = useState(false);
  const [showContactShare, setShowContactShare] = useState(false);
  const [channelManagementTab, setChannelManagementTab] = useState(null); // null, "members", "settings"
  const [inspectedMessage, setInspectedMessage] = useState(null);
  const [, setWorkspaceMembers] = useState([]);
  const [toast, setToast] = useState({ message: "", type: "success", visible: false });
  const [showExitChannelConfirm, setShowExitChannelConfirm] = useState(false);
  const [showDeleteChannelConfirm, setShowDeleteChannelConfirm] = useState(false);
  const [showThreadsView, setShowThreadsView] = useState(false);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [showMemberList, setShowMemberList] = useState(false);

  const showToast = (message, type = "success") => {
    setToast({ message, type, visible: true });
  };

  // ...



  const [activeThread, setActiveThread] = useState(null);
  const [threadCounts, setThreadCounts] = useState({});

  const [openMsgMenuId, setOpenMsgMenuId] = useState(null);
  // Reactions state removed - now handled via socket events in real-time

  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const [typingUsers, setTypingUsers] = useState([]);

  // Voice Recording Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [connected, setConnected] = useState(false);

  const currentUserIdRef = useRef(null);

  /* ---------------------------------------------------------
      HELPERS
  --------------------------------------------------------- */

  // getAccessToken removed - using accessToken from context instead

  const mapBackendMsgToUI = (m) => {
    const senderObj = typeof m.sender === "object" ? m.sender : {};
    const senderId = senderObj._id || senderObj.id || m.sender;

    const me = String(senderId) === String(currentUserIdRef.current);

    return {
      id: m._id,
      sender: me ? "you" : "them",
      senderId,
      senderName: senderObj.username || (me ? "You" : "Unknown"),
      senderAvatar: senderObj.profilePicture || null,
      text: m.payload?.text || m.text || "",
      ts: m.createdAt,
      repliedToId: m.threadParent?._id || m.threadParent || null,
      repliedTo: m.threadParent && typeof m.threadParent === 'object' ? {
        id: m.threadParent._id,
        text: m.threadParent.text,
        senderName: m.threadParent.sender?.username || "Unknown",
        senderAvatar: m.threadParent.sender?.profilePicture || null,
      } : null,

      // Reactions
      reactions: m.reactions || [],

      // Pinning
      isPinned: m.isPinned || false,
      pinnedBy: m.pinnedBy?._id || m.pinnedBy || null,
      pinnedByName: m.pinnedBy?.username || null,
      pinnedAt: m.pinnedAt || null,

      // Deletion
      isDeletedUniversally: m.isDeletedUniversally || false,
      deletedBy: m.deletedBy || null,
      deletedByName: m.deletedByName || null,
      deletedAt: m.deletedAt || null,
      hiddenFor: m.hiddenFor || [],

      // Thread info
      replyCount: m.replyCount || 0,
      replyAvatars: m.replyAvatars || [],
      lastReplyAt: m.lastReplyAt || null,

      backend: m,
    };
  };

  const generateTempId = () => `temp-${crypto.randomUUID()}`;

  /* ---------------------------------------------------------
      LOAD CURRENT USER FROM TOKEN
  --------------------------------------------------------- */
  const fetchWorkspaceMembers = useCallback(async () => {
    try {
      if (!chat || !chat.workspaceId) return;
      const res = await api.get(`/api/workspaces/${chat.workspaceId}/all-members`);
      setWorkspaceMembers(res.data.members || []);

      // Get current user's role in workspace
      const currentUserId = currentUserIdRef.current;


      // Debug: Log first member structure
      if (res.data.members && res.data.members.length > 0) {

      }

      if (currentUserId && res.data.members) {
        const currentMember = res.data.members.find(m => {
          const memberId = m.user?._id || m.user?.id || m.user || m._id || m.id;
          const matches = String(memberId) === String(currentUserId);

          return matches;
        });

        const role = currentMember?.role || 'member';

        setUserRole(role);
      }
    } catch (err) {
      console.error("Fetch workspace members failed:", err);
    }
  }, [chat]);

  useEffect(() => {
    fetchWorkspaceMembers();
  }, [chat?.workspaceId, fetchWorkspaceMembers]);

  /* ---------------------------------------------------------
      LOAD CURRENT USER FROM TOKEN
  --------------------------------------------------------- */
  useEffect(() => {
    // Use context token OR fallback to localStorage
    const t = accessToken || localStorage.getItem("accessToken");
    if (!t) return;
    try {
      const d = jwtDecode(t);
      currentUserIdRef.current = d.sub || d.id || d.userId || null;
    } catch { }
  }, [accessToken]);

  /* ---------------------------------------------------------
      LOAD CHAT HISTORY
  --------------------------------------------------------- */
  useEffect(() => {
    if (!chat) return;

    // CRITICAL FIX: Get token from context OR fallback to localStorage
    // This prevents race condition on page refresh when AuthContext is still initializing
    const token = accessToken || localStorage.getItem("accessToken");
    if (!token) return;

    let mounted = true;

    async function loadMessages() {
      try {
        let url = "";
        if (chat.type === "dm") {
          // If it's a "new" DM, we don't have history yet (unless we check for existing session)
          if (chat.isNew) {
            setMessages([]);
            setHasMore(false);
            return;
          }
          url = `/api/messages/dm/${chat.workspaceId}/${chat.id}?limit=50`;
        } else {
          url = `/api/messages/channel/${chat.id}?limit=50`;
        }

        const res = await api.get(url);

        // Sync thread counts from backend
        if (res.data.messages) {
          const newCounts = {};
          res.data.messages.forEach(m => {
            if (m.replyCount > 0) {
              newCounts[m._id] = m.replyCount;
            }
          });
          setThreadCounts(prev => ({ ...prev, ...newCounts }));
        }

        let loadedMessages = res.data.messages
          .map(mapBackendMsgToUI)
          // Filter out messages that are hidden for this user
          .filter((m) => !m.hiddenFor.includes(String(currentUserIdRef.current)));

        // Store user's join date for timeline marker (channels only)
        if (chat.type === "channel" && res.data.userJoinedAt) {
          setUserJoinedAt(res.data.userJoinedAt);
        }

        // Store all channel members with join dates for personalized join markers
        if (chat.type === "channel" && res.data.channelMembers) {
          setChannelMembersWithJoinDates(res.data.channelMembers);
        }

        // Update pagination state
        setHasMore(res.data.hasMore || false);

        if (!mounted) return;
        setMessages(loadedMessages);

        // Mark as read will be handled by the dedicated useEffect below
      } catch (err) {
        console.error("Load messages error:", err);
        if (!mounted) return;
        setMessages([]);
        setHasMore(false);
      }
    }

    loadMessages();
    return () => (mounted = false);
  }, [chat, connected, accessToken]); // Note: We keep accessToken in deps to re-run when context updates

  /* ---------------------------------------------------------
      SYNC CONNECTED STATE WITH SHARED SOCKET
  --------------------------------------------------------- */
  useEffect(() => {
    setConnected(sharedSocketConnected);
  }, [sharedSocketConnected]);

  /* ---------------------------------------------------------
      MARK CHAT AS READ (when chat becomes active and messages load)
  --------------------------------------------------------- */
  useEffect(() => {
    if (!chat || !connected) return;

    const socket = socketRef.current;
    if (!socket) return;

    const timer = setTimeout(() => {
      if (chat.type === "dm" || chat.type === "channel") {
        socket.emit("mark-chat-read", {
          type: chat.type,
          id: chat.id,
        });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [chat, connected, messages.length]); // Re-run when chat changes or messages load

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
    if (!chat) return;

    // Use shared socket from context instead of creating new one
    const setupSocket = async () => {
      if (!sharedSocket) {

        return;
      }


      const socket = sharedSocket;
      socketRef.current = socket;
      setConnected(sharedSocketConnected);

      /* ========================================================
         ✅ CRITICAL: Register ALL event listeners FIRST
         before joining any rooms. This ensures we can receive
         messages immediately after joining.
      ======================================================== */

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
          if (prev.some((x) => x.id === realMsg.id)) {
            // Message already exists (likely due to optimistic update) - this is normal
            return prev;
          }
          return [...prev, realMsg];
        });
      });

      /* --- MESSAGE SENT ACK --- */
      socket.on("message-sent", ({ message, clientTempId }) => {

        const realMsg = mapBackendMsgToUI(message);

        // Replace optimistic message with real message
        if (clientTempId && pendingMessagesRef.current[clientTempId]) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === clientTempId
                ? { ...realMsg, sending: false, temp: false }
                : m
            )
          );
          delete pendingMessagesRef.current[clientTempId];
        }
      });

      /* --- SEND ERROR --- */
      socket.on("send-error", ({ clientTempId, message }) => {
        console.error('❌ [ChatWindow] Send error:', message);

        setMessages((prev) =>
          prev.map((m) =>
            m.id === clientTempId ? { ...m, sending: false, failed: true } : m
          )
        );

        // Clean up pending message
        if (pendingMessagesRef.current[clientTempId]) {
          delete pendingMessagesRef.current[clientTempId];
        }
      });

      /* --- READ RECEIPTS --- */
      socket.on("read-update", ({ readerId, dmSessionId, channelId }) => {
        // Update all messages in this chat to add the reader to readBy array
        setMessages((prev) =>
          prev.map((m) => {
            // Skip if this message is from the reader themselves
            if (m.backend?.sender === readerId || m.senderId === readerId) return m;

            // Check if this message belongs to the current chat
            const isRelevant = dmSessionId
              ? (m.backend?.dm === dmSessionId || m.dmId === dmSessionId)
              : (m.backend?.channel === channelId || m.channelId === channelId);

            if (!isRelevant) return m;

            // Add reader to readBy if not already there
            const currentReadBy = m.backend?.readBy || [];
            if (currentReadBy.includes(readerId)) return m;

            return {
              ...m,
              backend: {
                ...m.backend,
                readBy: [...currentReadBy, readerId]
              }
            };
          })
        );
      });

      /* --- TYPING --- */
      socket.on("typing", ({ from, fromName }) => {
        if (!from) return;

        // CRITICAL FIX: Don't show typing indicator for current user
        if (String(from) === String(currentUserIdRef.current)) {
          return; // Ignore typing events from self
        }

        setTypingUsers((prev) => {
          // Check if user is already in the list
          const exists = prev.find((u) => u.id === from);
          if (exists) return prev;

          return [...prev, { id: from, name: fromName || "Someone" }];
        });

        setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u.id !== from));
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

      /* --- REACTIONS --- */
      socket.on("reaction-added", ({ messageId, userId, emoji, reactions }) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, reactions } : m
          )
        );
      });

      socket.on("reaction-removed", ({ messageId, userId, reactions }) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, reactions } : m
          )
        );
      });

      /* --- MESSAGE DELETION --- */
      socket.on("message-deleted", ({ messageId, deletedBy, deletedByName, isUniversal, isLocal }) => {


        if (isLocal) {
          // Local deletion - remove message from UI for this user only
          setMessages((prev) => {
            const filtered = prev.filter((m) => m.id !== messageId && m.backend?._id !== messageId);

            return filtered;
          });
        } else if (isUniversal) {
          // Universal deletion - mark as deleted but keep in list
          setMessages((prev) => {
            const updated = prev.map((m) => {
              // Check both id and backend._id
              if (m.id !== messageId && m.backend?._id !== messageId) return m;

              // Create a completely new object to force React re-render
              return {
                ...m,
                isDeletedUniversally: true,
                deletedBy,
                deletedByName: deletedByName || "Unknown",
                deletedAt: new Date().toISOString(),
              };
            });

            return [...updated]; // Return new array reference
          });
        }
      });

      /* --- MESSAGE PINNING --- */
      socket.on("message-pinned", ({ messageId, pinnedBy, pinnedByName, message }) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, isPinned: true, pinnedBy, pinnedByName, pinnedAt: new Date().toISOString() }
              : m
          )
        );
      });

      socket.on("message-unpinned", ({ messageId }) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, isPinned: false, pinnedBy: null, pinnedByName: null, pinnedAt: null }
              : m
          )
        );
      });

      socket.on("pin-error", ({ error }) => {
        showToast(error, "error");
      });

      /* --- TABS --- */
      socket.on("tab-added", ({ tab }) => {

        // Don't add if we already have this tab (prevents duplicates from optimistic updates)
        setTabs(prev => {
          const exists = prev.find(t => t._id === tab._id);
          if (exists) {

            return prev;
          }

          return [...prev, tab];
        });
      });

      socket.on("tab-updated", ({ tabId, name, content }) => {
        setTabs(prev => prev.map(t =>
          t._id === tabId ? { ...t, name, content } : t
        ));
      });

      socket.on("tab-deleted", ({ tabId }) => {
        setTabs(prev => prev.filter(t => t._id !== tabId));
        if (activeTab === tabId) setActiveTab("chat");
      });

      /* --- MEMBER LEFT CHANNEL --- */
      socket.on("member-left", ({ channelId, userId, systemMessage }) => {


        // If it's the current user who left, close the chat window
        if (String(userId) === String(currentUserIdRef.current)) {

          showToast("You have left this channel", "info");
          onClose(); // Close the chat window
          if (onDeleteChat) {
            onDeleteChat(); // Trigger parent to refresh channel list
          }
        } else {
          // Another user left - just show the system message
          if (systemMessage) {
            const mappedMsg = mapBackendMsgToUI(systemMessage);
            setMessages((prev) => [...prev, mappedMsg]);
          }
        }
      });

      /* --- CHANNEL DELETED --- */
      socket.on("channel-deleted", ({ channelId, channelName }) => {


        showToast(`#${channelName} has been deleted`, "warning");
        onClose(); // Close the chat window
        if (onDeleteChat) {
          onDeleteChat(); // Trigger parent to refresh channel list
        }
      });

      /* --- SOCKET DISCONNECT --- */
      socket.on("disconnect", (reason) => {

        setConnected(false);

        // Don't show toast for intentional disconnects (navigation, refresh, etc.)
        // Socket will auto-reconnect if it was a network issue
        if (reason === "transport close" || reason === "transport error") {
          // Network issue - socket.io will auto-reconnect

        }
        // Removed annoying toast - disconnects during navigation are normal
      });

      /* --- Connection --- */
      socket.on("connect", () => {
        setConnected(true);


        if (!chat) return;

        // Join appropriate room AFTER socket is connected
        if (chat.type === "dm") {
          if (chat.isNew) {

          } else {

            socket.emit("join-dm", { dmSessionId: chat.id });
          }
        } else {

          socket.emit("join-channel", { channelId: chat.id });
        }
      });

      socket.on("connect_error", async (err) => {
        console.error('❌ [ChatWindow] Socket connection error:', err.message);
        setConnected(false);

        // If authentication failed, try to refresh the token
        if (err.message.includes('Authentication') || err.message.includes('jwt') || err.message.includes('token')) {


          try {
            // Try to refresh the token
            // The refresh token is in HTTP-only cookie, so we don't need to pass it
            // Just make the request with credentials: 'include' to send cookies
            const response = await api.post('/api/auth/refresh', {}, {
              withCredentials: true  // This sends the HTTP-only cookie
            });

            const newAccessToken = response.data.accessToken;

            if (newAccessToken) {
              localStorage.setItem('accessToken', newAccessToken);


              // Show success message and reload to reconnect
              showToast("Reconnecting with fresh session...", "success");

              // Reload page to reinitialize with fresh token
              setTimeout(() => {
                window.location.reload();
              }, 500);
              return;
            }

            // If refresh failed, show error
            showToast("Session expired. Please login again.", "error");
          } catch (refreshErr) {
            console.error('❌ [ChatWindow] Token refresh failed:', refreshErr);

            // Check if it's a 401 (no refresh token) or other error
            if (refreshErr.response?.status === 401) {
              showToast("Please login to continue.", "info");
            } else {
              showToast("Session expired. Please login again.", "error");
            }
          }
        } else {
          showToast("Connection error. Retrying...", "error");
        }
      });


      /* ========================================================
         ✅ ALL LISTENERS NOW REGISTERED
         Now join the room if socket is already connected
      ======================================================== */

      // ✅ CRITICAL: Join room immediately if socket is already connected
      // This ensures we receive real-time messages even if socket connected before this component mounted
      if (socket.connected) {

        if (chat.type === "dm" && !chat.isNew) {
          socket.emit("join-dm", { dmSessionId: chat.id });
        } else if (chat.type === "channel") {
          socket.emit("join-channel", { channelId: chat.id });
        }
      }
    }; // End of setupSocket function

    // Call the socket setup function
    setupSocket();

    // Return cleanup function that will be called when component unmounts
    return () => {
      const socket = socketRef.current;
      if (!socket) return;

      // Clean up ALL socket listeners - DON'T disconnect since it's shared
      socket.off("connect");
      socket.off("disconnect");
      socket.off("channel-member-joined");
      socket.off("channel-member-left");
      socket.off("channel-deleted");
      socket.off("new-message");
      socket.off("message-sent");
      socket.off("send-error");
      socket.off("read-update");
      socket.off("typing");
      socket.off("stop-typing");
      socket.off("message-deleted");
      socket.off("reaction-added");
      socket.off("reaction-removed");
      socket.off("message-pinned");
      socket.off("message-unpinned");
      socket.off("pin-error");

      // DO NOT disconnect - socket is shared across all chat windows
      // socket.disconnect(); // REMOVED
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat, sharedSocket, sharedSocketConnected]);

  /* ---------------------------------------------------------
      SUBSCRIBE TO SOCKETCONTEXT MESSAGE BROADCASTS
      This ensures we receive messages even if socket reconnects
  --------------------------------------------------------- */
  useEffect(() => {
    if (!chat || !addMessageListener) return;

    // Subscribe to global message broadcasts from SocketContext
    const unsubscribe = addMessageListener((eventName, data) => {
      // Handle new messages from SocketContext broadcast
      if (eventName === 'new-message') {
        const { message } = data;

        // Only process if message belongs to current chat
        const isRelevant = chat.type === 'channel'
          ? message.channel === chat.id
          : message.dm === chat.id;

        if (!isRelevant) return;

        const realMsg = mapBackendMsgToUI(message);

        // Replace optimistic message or add new message
        setMessages((prev) => {
          if (prev.some((x) => x.id === realMsg.id)) {
            return prev; // Already exists
          }
          return [...prev, realMsg];
        });
      }

      // Handle other message events from SocketContext
      if (eventName === 'message-deleted') {
        const { messageId, deletedBy, deletedByName, isUniversal, isLocal } = data;

        if (isLocal) {
          setMessages((prev) => prev.filter((m) => m.id !== messageId && m.backend?._id !== messageId));
        } else if (isUniversal) {
          setMessages((prev) => prev.map((m) =>
            (m.id === messageId || m.backend?._id === messageId)
              ? { ...m, isDeletedUniversally: true, deletedBy, deletedByName, deletedAt: new Date().toISOString() }
              : m
          ));
        }
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [chat, addMessageListener]);

  /* ---------------------------------------------------------
      SEND MESSAGE
  --------------------------------------------------------- */
  const typingEmitTimeoutRef = useRef(null);

  const onInputChange = (e) => {
    // ContentEditable passes the event differently - need to get innerHTML
    const newValue = e.target.value !== undefined ? e.target.value : e.target.innerHTML;
    setNewMessage(newValue);

    if (typingTimeoutRef.current)
      clearTimeout(typingTimeoutRef.current);

    const socket = socketRef.current;
    if (socket && connected) {
      // Debounce typing indicator - only emit if we haven't emitted in last 500ms
      if (!typingEmitTimeoutRef.current) {
        socket.emit("typing", {
          dmSessionId: (chat.type === "dm" && !chat.isNew) ? chat.id : null,
          channelId: chat.type === "channel" ? chat.id : null,
        });

        typingEmitTimeoutRef.current = setTimeout(() => {
          typingEmitTimeoutRef.current = null;
        }, 500); // Debounce window
      }
    }

    typingTimeoutRef.current = setTimeout(() => { }, 2000);
  };

  const sendMessage = (textOverride) => {
    // If textOverride is provided (string), use it. Otherwise use newMessage state.
    const msgText = typeof textOverride === "string" ? textOverride : newMessage;

    if (!msgText.trim() || blocked) return;

    const socket = socketRef.current;

    // Check if socket is connected
    if (!socket || !connected) {
      console.error('❌ [ChatWindow] Cannot send message: socket not connected');
      showToast("Not connected. Please wait...", "error");
      return;
    }

    const clientTempId = generateTempId();

    // Show optimistic UI message
    const uiMsg = {
      id: clientTempId,
      sender: "you",
      text: msgText.trim(),
      ts: new Date().toISOString(),
      temp: true,
      sending: true,
      repliedToId:
        replyingTo?.backend?._id ?? replyingTo?.id ?? null,
    };

    setMessages((prev) => [...prev, uiMsg]);
    pendingMessagesRef.current[clientTempId] = uiMsg;



    try {
      socket.emit("send-message", {
        text: msgText.trim(),
        attachments: [],
        replyTo: uiMsg.repliedToId,
        clientTempId,
        workspaceId: chat.workspaceId,
        dmSessionId: (chat.type === "dm" && !chat.isNew) ? chat.id : null,
        receiverId: (chat.type === "dm" && chat.isNew) ? chat.id : null,
        channelId: chat.type === "channel" ? chat.id : null,
      });

      // Set a timeout to mark message as failed if no response
      setTimeout(() => {
        if (pendingMessagesRef.current[clientTempId]) {

          setMessages((prev) =>
            prev.map((m) =>
              m.id === clientTempId ? { ...m, sending: false, failed: true } : m
            )
          );
          delete pendingMessagesRef.current[clientTempId];
          showToast("Message send timeout. Please try again.", "error");
        }
      }, 10000); // 10 second timeout
    } catch (err) {
      console.error('❌ [ChatWindow] Error emitting message:', err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === clientTempId ? { ...m, sending: false, failed: true } : m
        )
      );
      delete pendingMessagesRef.current[clientTempId];
      showToast("Failed to send message", "error");
    }

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

    try {
      if (type === "photo") {
        const f = await pickFile("image/*");
        if (!f) return;

        showToast("Uploading photo...", "info");

        socket.emit("send-message", {
          text: `[Photo] ${f.name}`,
          attachments: [
            { type: "image", url: URL.createObjectURL(f), name: f.name },
          ],
          workspaceId: chat.workspaceId,
          dmSessionId: (chat.type === "dm" && !chat.isNew) ? chat.id : null,
          receiverId: (chat.type === "dm" && chat.isNew) ? chat.id : null,
          channelId: chat.type === "channel" ? chat.id : null,
        });
      }

      if (type === "file") {
        const f = await pickFile(".pdf,.doc,.docx,.xls,.xlsx");
        if (!f) return;

        showToast("Uploading document...", "info");

        socket.emit("send-message", {
          text: `[File] ${f.name}`,
          attachments: [
            { type: "file", url: URL.createObjectURL(f), name: f.name },
          ],
          workspaceId: chat.workspaceId,
          dmSessionId: (chat.type === "dm" && !chat.isNew) ? chat.id : null,
          receiverId: (chat.type === "dm" && chat.isNew) ? chat.id : null,
          channelId: chat.type === "channel" ? chat.id : null,
        });
      }

      if (type === "contact") {
        setShowContactShare(true);
      }
    } catch (err) {
      console.error("Attachment error:", err);
      showToast("Failed to attach file", "error");
    }
  };

  const shareContact = (c) => {
    setShowContactShare(false);

    const socket = socketRef.current;
    if (!socket) return;

    socket.emit("send-message", {
      text: `[Contact] ${c.name}`,
      attachments: [{ type: "contact", url: "", name: c.name }],
      workspaceId: chat.workspaceId,
      dmSessionId: (chat.type === "dm" && !chat.isNew) ? chat.id : null,
      receiverId: (chat.type === "dm" && chat.isNew) ? chat.id : null,
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



  const replyToMessage = (id) => {
    setReplyingTo(messages.find((m) => m.id === id));
    setOpenMsgMenuId(null);
  };

  // User reactions state removed - now handled via socket events in real-time

  /* ---------------------------------------------------------
      NEW MESSAGE ACTION HANDLERS
  --------------------------------------------------------- */

  // Add or update reaction to a message
  // eslint-disable-next-line no-unused-vars
  const handleAddReaction = (messageId, emoji) => {
    const socket = socketRef.current;
    if (!socket || !connected) return;

    if (!emoji) {
      // Remove reaction
      socket.emit("remove-reaction", { messageId });
    } else {
      // Add or update reaction
      socket.emit("add-reaction", { messageId, emoji });
    }
  };

  // Delete message with permission checks
  // eslint-disable-next-line no-unused-vars
  const handleDeleteMessage = (messageId, isOwnMessage) => {
    const socket = socketRef.current;
    if (!socket || !connected) return;

    // Determine delete type based on permissions
    const channelId = chat.type === "channel" ? chat.id : null;
    const dmSessionId = chat.type === "dm" && !chat.isNew ? chat.id : null;

    socket.emit("delete-message", {
      messageId,
      channelId,
      dmSessionId
    });
  };

  // Pin or unpin message (admin only)
  // eslint-disable-next-line no-unused-vars
  const handlePinMessage = (messageId, shouldPin) => {
    const socket = socketRef.current;
    if (!socket || !connected) return;

    const channelId = chat.type === "channel" ? chat.id : null;
    if (!channelId) return; // Only channels support pinning

    if (shouldPin) {
      socket.emit("pin-message", { messageId, channelId });
    } else {
      socket.emit("unpin-message", { messageId, channelId });
    }
  };

  /* ---------------------------------------------------------
      LEGACY REACTION HANDLING (For existing UI)
  --------------------------------------------------------- */
  const addReaction = (id, emoji) => {
    handleAddReaction(id, emoji);
  };

  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardingMsgId, setForwardingMsgId] = useState(null);

  /* ---------------------------------------------------------
      TAB HELPERS
  --------------------------------------------------------- */
  const fetchTabs = useCallback(async () => {
    if (chat?.type !== 'channel') return;
    try {

      const res = await api.get(`/api/channels/${chat.id}/tabs`);

      setTabs(res.data.tabs || []);
    } catch (err) {
      console.error("❌ Fetch tabs error:", err);
      console.error("Error response:", err.response?.data);
    }
  }, [chat]);

  useEffect(() => {
    if (chat?.type === 'channel') {
      fetchTabs();
    } else {
      setTabs([]); // Clear tabs for DMs
    }
  }, [chat, fetchTabs]);

  const handleAddTab = async (name) => {
    // Check tab limit
    if (tabs.length >= 5) {
      showToast("Maximum 5 canvases allowed per channel", "error");
      return;
    }

    try {


      // Optimistic update
      const tempId = "temp-" + Date.now();
      const newTab = { _id: tempId, name, type: "canvas", content: "" };
      setTabs(prev => [...prev, newTab]);
      setActiveTab(tempId);

      const res = await api.post(`/api/channels/${chat.id}/tabs`, { name, type: "canvas" });



      // Remove temp tab and DON'T add the real one (socket will do it)
      // This prevents race condition where both temp and real tab exist
      setTabs(prev => prev.filter(t => t._id !== tempId));
      setActiveTab(res.data.tab._id);
      showToast(`Canvas "${name}" created`, "success");
    } catch (err) {
      console.error("❌ Add tab error:", err);
      console.error("Error response:", err.response?.data);
      console.error("Error status:", err.response?.status);
      showToast(err.response?.data?.message || "Failed to create tab", "error");
      setTabs(prev => prev.filter(t => !t._id.startsWith("temp-"))); // Revert all temp tabs
      setActiveTab("chat");
    }
  };

  const handleDeleteTab = async (tabId) => {
    try {
      await api.delete(`/api/channels/${chat.id}/tabs/${tabId}`);
      // Socket event will update UI, but we can do optimistic too
      setTabs(prev => prev.filter(t => t._id !== tabId));
      if (activeTab === tabId) setActiveTab("chat");
    } catch (err) {
      console.error("Delete tab error:", err);
      showToast("Failed to delete tab", "error");
    }
  };

  const handleSaveCanvas = async (tabId, data) => {
    try {
      await api.put(`/api/channels/${chat.id}/tabs/${tabId}`, data);
    } catch (err) {
      console.error("Save canvas error:", err);
    }
  };

  const handleRenameTab = async (tabId, newName) => {
    try {
      await api.put(`/api/channels/${chat.id}/tabs/${tabId}`, { name: newName });
      // Optimistically update UI
      setTabs(prev => prev.map(t => t._id === tabId ? { ...t, name: newName } : t));
      showToast("Tab renamed", "success");
    } catch (err) {
      console.error("Rename tab error:", err);
      showToast("Failed to rename tab", "error");
    }
  };

  const handleForward = (targets) => {
    // targets is now an array of target objects
    if (!Array.isArray(targets) || targets.length === 0) {
      showToast("No recipients selected", "error");
      return;
    }

    const msg = messages.find(m => m.id === forwardingMsgId);
    if (!msg) {
      showToast("Message not found", "error");
      return;
    }

    const socket = socketRef.current;
    if (!socket || !connected) {
      showToast("Not connected. Please try again.", "error");
      return;
    }

    // Prepare forwarded message text
    const forwardedText = `[Forwarded] ${msg.text}`;
    let successCount = 0;
    let failCount = 0;

    // Send to each target
    targets.forEach((target) => {
      try {
        if (target.type === 'channel') {
          // Forward to channel
          socket.emit("send-message", {
            text: forwardedText,
            attachments: msg.attachments || [],
            replyTo: null,
            clientTempId: generateTempId(),
            workspaceId: chat.workspaceId,
            channelId: target.id,
            dmSessionId: null,
            receiverId: null,
          });
          successCount++;
        } else if (target.type === 'dm') {
          // Forward to DM
          if (target.isNewDM) {
            // This is a user ID, not a DM session ID
            socket.emit("send-message", {
              text: forwardedText,
              attachments: msg.attachments || [],
              replyTo: null,
              clientTempId: generateTempId(),
              workspaceId: chat.workspaceId,
              dmSessionId: null,
              receiverId: target.id, // User ID for new DM
              channelId: null,
            });
          } else {
            // This is an existing DM session ID
            socket.emit("send-message", {
              text: forwardedText,
              attachments: msg.attachments || [],
              replyTo: null,
              clientTempId: generateTempId(),
              workspaceId: chat.workspaceId,
              dmSessionId: target.id,
              receiverId: null,
              channelId: null,
            });
          }
          successCount++;
        }
      } catch (err) {
        console.error(`Forward to ${target.label} failed:`, err);
        failCount++;
      }
    });

    // Show summary toast
    if (successCount > 0) {
      if (successCount === 1) {
        showToast(`Message forwarded to ${targets[0].label}`, "success");
      } else {
        showToast(`Message forwarded to ${successCount} recipient${successCount > 1 ? 's' : ''}`, "success");
      }
    }
    if (failCount > 0) {
      showToast(`Failed to forward to ${failCount} recipient${failCount > 1 ? 's' : ''}`, "error");
    }

    setShowForwardModal(false);
    setForwardingMsgId(null);
  };

  /* ---------------------------------------------------------
      VOICE RECORDING LOGIC
  --------------------------------------------------------- */
  useEffect(() => {
    const startRecording = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data);
        };

        mediaRecorderRef.current.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          const audioUrl = URL.createObjectURL(audioBlob);
          const socket = socketRef.current;

          if (socket) {
            socket.emit("send-message", {
              text: "[Voice Message]",
              attachments: [
                { type: "audio", url: audioUrl, name: "voice_message.webm" },
              ],
              workspaceId: chat.workspaceId,
              dmSessionId: (chat.type === "dm" && !chat.isNew) ? chat.id : null,
              receiverId: (chat.type === "dm" && chat.isNew) ? chat.id : null,
              channelId: chat.type === "channel" ? chat.id : null,
            });
            showToast("Voice message sent!", "success");
          }

          // Stop all tracks to release microphone
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorderRef.current.start();
        showToast("Recording started...", "info");
      } catch (err) {
        console.error("Error accessing microphone:", err);
        showToast("Could not access microphone", "error");
        setRecording(false);
      }
    };

    const stopRecording = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };

    if (recording) {
      startRecording();
    } else {
      stopRecording();
    }

    // Cleanup on unmount or recording toggle
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream?.getTracks().forEach(track => track.stop());
      }
      // Clear refs to allow garbage collection
      audioChunksRef.current = [];
      mediaRecorderRef.current = null;
    };
  }, [recording, chat]);

  /* ---------------------------------------------------------
      LOAD MORE MESSAGES (Pagination)
  --------------------------------------------------------- */
  const loadMoreMessages = async () => {
    if (!hasMore || isLoadingMore || messages.length === 0) return;

    setIsLoadingMore(true);

    try {
      // Get the oldest message ID to use as 'before' parameter
      const oldestMsg = messages[0];
      const beforeId = oldestMsg.backend?._id || oldestMsg.id;

      let url = "";
      if (chat.type === "dm") {
        url = `/api/messages/dm/${chat.workspaceId}/${chat.id}?limit=50&before=${beforeId}`;
      } else {
        url = `/api/messages/channel/${chat.id}?limit=50&before=${beforeId}`;
      }

      const res = await api.get(url);

      // Sync thread counts from backend
      if (res.data.messages) {
        const newCounts = {};
        res.data.messages.forEach(m => {
          if (m.replyCount > 0) {
            newCounts[m._id] = m.replyCount;
          }
        });
        setThreadCounts(prev => ({ ...prev, ...newCounts }));
      }

      const olderMessages = res.data.messages
        .map(mapBackendMsgToUI)
        .filter((m) => !m.hiddenFor.includes(String(currentUserIdRef.current)));

      // Prepend older messages to the beginning
      setMessages((prev) => [...olderMessages, ...prev]);
      setHasMore(res.data.hasMore || false);

      showToast(`Loaded ${olderMessages.length} older messages`, "success");
    } catch (err) {
      console.error("Load more messages error:", err);
      showToast("Failed to load older messages", "error");
    } finally {
      setIsLoadingMore(false);
    }
  };

  /* ---------------------------------------------------------
      EXIT CHANNEL
  --------------------------------------------------------- */
  const handleExitChannel = async () => {
    if (chat.type !== 'channel') return;

    setShowExitChannelConfirm(true);
  };

  const confirmExitChannel = async () => {

    try {


      await api.post(`/api/channels/${chat.id}/exit`);



      showToast(`You left #${chat.name}`, 'success');

      // Close the chat window and navigate away
      onClose();

      // Optionally reload the channel list
      if (onDeleteChat) {
        onDeleteChat(); // This will trigger parent to refresh
      }
    } catch (err) {
      console.error('❌ Exit channel error:', err);

      if (err.response?.data?.requiresAdminAssignment) {
        showToast('You must assign another admin before exiting', 'warning');
      } else {
        showToast(err.response?.data?.message || 'Failed to exit channel', 'error');
      }
    }
  };

  /* ---------------------------------------------------------
      DELETE CHANNEL (CREATOR ONLY)
  --------------------------------------------------------- */
  const handleDeleteChannel = async () => {
    if (chat.type !== 'channel') return;

    setShowDeleteChannelConfirm(true);
  };

  const confirmDeleteChannel = async () => {

    try {


      await api.delete(`/api/channels/${chat.id}`);



      showToast(`#${chat.name} has been permanently deleted`, 'success');

      // Close the chat window and navigate away
      onClose();

      // Trigger parent to refresh channel list
      if (onDeleteChat) {
        onDeleteChat();
      }
    } catch (err) {
      console.error('❌ Delete channel error:', err);
      showToast(err.response?.data?.message || 'Failed to delete channel', 'error');
    }
  };

  /* ---------------------------------------------------------
      CLEAR CHAT (DM ONLY)
  --------------------------------------------------------- */
  const handleClearChat = async () => {
    if (chat.type !== 'dm') return;

    try {
      // Clear all messages from the UI
      setMessages([]);

      // Optionally, make API call to clear chat history on server
      // This would mark all messages as hidden for this user
      // await api.post(`/api/messages/dm/${chat.workspaceId}/${chat.id}/clear`);

      showToast('Chat cleared successfully', 'success');
    } catch (err) {
      console.error('❌ Clear chat error:', err);
      showToast('Failed to clear chat', 'error');
    }
  };

  /* ---------------------------------------------------------
      RENDER
  --------------------------------------------------------- */
  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 relative">
      {/* 1. Header */}
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
        onClearChat={handleClearChat}
        onExitChannel={handleExitChannel}
        onDeleteChannel={handleDeleteChannel}
        currentUserId={currentUserIdRef.current}
        showToast={showToast}
        typingUsers={typingUsers}
        onShowThreadsView={() => setShowThreadsView(true)}
        onShowMemberList={() => setShowMemberList(true)}
        onCreatePoll={() => setShowCreatePoll(true)}
      />

      {/* 2. Tabs Bar (Only for channels) */}
      {chat.type === 'channel' && (
        <ChannelTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onAddTab={handleAddTab}
          onDeleteTab={handleDeleteTab}
          onRenameTab={handleRenameTab}
          currentUserId={currentUserIdRef.current}
          isAdmin={userRole === 'admin' || userRole === 'owner' || chat.isOwner}
        />
      )}

      {/* Horizontal Flex Container to hold Chat/Canvas AND Side Panels */}
      <div className="flex-1 flex overflow-hidden">

        {/* 3. Main Content Area */}
        <div className="flex-1 flex flex-col relative min-w-0">
          {activeTab === "chat" ? (
            <>
              <MessagesContainer
                messages={messages}
                searchQuery={searchQuery}
                selectMode={selectMode}
                selectedIds={selectedIds}
                toggleSelect={toggleSelect}
                openMsgMenuId={openMsgMenuId}
                setOpenMsgMenuId={setOpenMsgMenuId}
                toggleMsgMenu={(e, id) => {
                  e?.stopPropagation?.();
                  setOpenMsgMenuId((prev) => (prev === id ? null : id));
                }}
                formatTime={(iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                addReaction={addReaction}
                pinMessage={(id) => {
                  const m = messages.find((x) => x.id === id);
                  if (m) handlePinMessage(id, !m.isPinned);
                }}
                replyToMessage={replyToMessage}
                forwardMessage={(id) => {
                  setForwardingMsgId(id);
                  setShowForwardModal(true);
                }}
                copyMessage={(id) => {
                  const m = messages.find((x) => x.id === id);
                  if (m) navigator.clipboard.writeText(m.text);
                }}
                deleteMessage={(id, deleteType = 'everyone') => {
                  try {
                    const socket = socketRef.current;
                    if (!socket || !connected) {
                      console.error('Socket not connected');
                      return;
                    }

                    const channelId = chat.type === "channel" ? chat.id : null;
                    const dmSessionId = chat.type === "dm" && !chat.isNew ? chat.id : null;

                    if (deleteType === 'me') {
                      socket.emit("delete-message", {
                        messageId: id,
                        channelId,
                        dmSessionId,
                        localOnly: true
                      });
                    } else {
                      socket.emit("delete-message", {
                        messageId: id,
                        channelId,
                        dmSessionId
                      });
                    }
                  } catch (err) {
                    console.error("Failed to delete message:", err);
                  }
                }}
                infoMessage={(id) => {
                  const m = messages.find((x) => x.id === id);
                  if (m) setInspectedMessage(m);
                }}
                onOpenThread={(msgId) => {
                  const msg = messages.find((m) => m.id === msgId);
                  if (msg) setActiveThread(msg);
                }}
                threadCounts={threadCounts}
                currentUserId={currentUserIdRef.current}
                chatType={chat.type}
                userJoinedAt={userJoinedAt}
                channelMembersWithJoinDates={channelMembersWithJoinDates}
                isAdmin={userRole === 'admin' || userRole === 'owner'}
                hasMore={hasMore}
                isLoadingMore={isLoadingMore}
                onLoadMore={loadMoreMessages}
              />

              {/* Reply Preview */}
              {replyingTo && (
                <ReplyPreview
                  replyingTo={replyingTo}
                  onCancel={() => setReplyingTo(null)}
                />
              )}

              {/* Footer Input */}
              <FooterInput
                newMessage={newMessage}
                onChange={onInputChange}
                onSend={sendMessage}
                onAttach={handleAttach}
                showAttach={showAttach}
                setShowAttach={setShowAttach}
                showEmoji={showEmoji}
                setShowEmoji={setShowEmoji}
                onPickEmoji={(em) => setNewMessage((m) => m + em.native)}
                recording={recording}
                startRecording={() => setRecording(true)}
                stopRecording={() => setRecording(false)}
                blocked={blocked}
                setNewMessage={setNewMessage}
              />
            </>
          ) : activeTab === 'tasks' ? (
            /* TASKS TAB CONTENT */
            <TasksTab
              channelId={chat.id}
              channelName={chat.name?.replace(/^#/, '')}
              currentUserId={currentUserIdRef.current}
              socket={socketRef.current}
            />
          ) : activeTab === 'canvas' ? (
            /* CANVAS TAB CONTENT */
            <CanvasTab
              channelId={chat.id}
              channelName={chat.name?.replace(/^#/, '')}
            />
          ) : (
            /* CANVAS TAB CONTENT */
            (() => {
              const tab = tabs.find(t => t._id === activeTab);
              const isTempTab = activeTab && activeTab.toString().startsWith("temp-");

              if (isTempTab) {
                return (
                  <div className="flex-1 flex items-center justify-center text-gray-400">
                    <div className="flex flex-col items-center gap-4 animate-pulse">
                      <div className="w-12 h-12 bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
                      <p>Creating canvas...</p>
                    </div>
                  </div>
                );
              }

              return tab ? (
                <CanvasTab
                  key={tab._id}
                  tab={tab}
                  onSave={handleSaveCanvas}
                  connected={connected}
                  socket={socketRef.current}
                  channelId={chat.id}
                  currentUserId={currentUserIdRef.current}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400">
                  <div className="flex flex-col items-center gap-2">
                    <p>Tab not found</p>
                    <button
                      onClick={() => setActiveTab("chat")}
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Return to Chat
                    </button>
                  </div>
                </div>
              );
            })()
          )}
        </div>

        {/* 4. Side Panels (Flex Items) */}

        {/* Thread Panel */}
        {activeThread && (
          <div className="w-[400px] bg-white dark:bg-gray-900 shadow-xl z-30 flex flex-col">
            <ThreadPanel
              parentMessage={activeThread}
              onClose={() => setActiveThread(null)}
              currentUserId={currentUserIdRef.current}
              socket={socketRef.current}
            />
          </div>
        )}

        {/* Contact Info Sidebar */}
        {showContactInfo && (
          <div className="w-80 bg-white dark:bg-gray-900 shadow-xl z-40 h-full">
            <ContactInfoModal
              chat={chat}
              onClose={() => setShowContactInfo(false)}
              currentUserId={currentUserIdRef.current}
              onBlock={() => setBlocked((prev) => !prev)}
              onDeleteChat={onDeleteChat}
              onToggleMute={() => setMuted((prev) => !prev)}
              muted={muted}
              blocked={blocked}
            />
          </div>
        )}
      </div>

      {/* Other Modals */}
      {showContactShare && (
        <ContactShareModal
          contacts={contacts}
          onClose={() => setShowContactShare(false)}
          onShare={shareContact}
        />
      )}

      {/* Forward Modal */}
      {showForwardModal && (
        <ForwardMessageModal
          onClose={() => setShowForwardModal(false)}
          onForward={handleForward}
          currentChatId={chat.id}
          currentChatType={chat.type}
        />
      )}

      {channelManagementTab && (
        <ChannelManagementModal
          channel={chat}
          initialTab={channelManagementTab}
          onClose={() => setChannelManagementTab(null)}
          currentUserId={currentUserIdRef.current}
          showToast={showToast}
        />
      )}

      {inspectedMessage && (
        <MessageInfoModal
          message={inspectedMessage}
          onClose={() => setInspectedMessage(null)}
        />
      )}

      {/* Confirmation Modals */}
      <ConfirmationModal
        isOpen={showExitChannelConfirm}
        onClose={() => setShowExitChannelConfirm(false)}
        onConfirm={confirmExitChannel}
        title="Leave Channel"
        message={`Are you sure you want to leave #${chat.name}?`}
        confirmText="Leave"
        confirmType="danger"
      />

      <ConfirmationModal
        isOpen={showDeleteChannelConfirm}
        onClose={() => setShowDeleteChannelConfirm(false)}
        onConfirm={confirmDeleteChannel}
        title="Delete Channel"
        message={`Are you sure you want to delete #${chat.name}? This action cannot be undone and all messages will be lost.`}
        confirmText="Delete"
        confirmType="danger"
      />

      {/* Threads View Modal */}
      <ThreadsViewModal
        isOpen={showThreadsView}
        onClose={() => setShowThreadsView(false)}
        messages={messages}
        threadCounts={threadCounts}
        onOpenThread={openThread}
        formatTime={(ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      />

      {/* Member List Modal */}
      <MemberListModal
        isOpen={showMemberList}
        onClose={() => setShowMemberList(false)}
        members={channelMembersWithJoinDates}
        channelName={chat.name?.replace(/^#/, '')}
        currentUserId={currentUserIdRef.current}
        onStartDM={(userId) => {
          // Handle start DM - this would need to be implemented
          showToast("DM feature coming soon!", "info");
        }}
        onViewProfile={(userId) => {
          // Handle view profile - this would need to be implemented
          showToast("Profile view coming soon!", "info");
        }}
      />

      <CreatePollModal
        isOpen={showCreatePoll}
        onClose={() => setShowCreatePoll(false)}
        onCreatePoll={handleCreatePoll}
        channelName={chat.name?.replace(/^#/, "")}
      />

      {/* Toast Notification */}
      {toast.visible && (
        <div className="fixed top-4 right-4 z-[9999]">
          <Toast
            message={toast.message}
            type={toast.type}
            isVisible={toast.visible}
            onClose={() => setToast({ ...toast, visible: false })}
          />
        </div>
      )}
    </div>
  );
}

// Poll handler
// Poll handler - USE BACKEND API
const handleCreatePoll = async (pollData) => {
  try {
    const token = localStorage.getItem('token');

    const response = await fetch(`${process.env.REACT_APP_API_BASE || 'http://localhost:5000'}/api/polls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        channelId: chat.id,
        question: pollData.question,
        options: pollData.options.map(opt => opt.text),
        type: pollData.allowMultiple ? 'multiple' : 'single'
      })
    });

    if (!response.ok) throw new Error('Failed to create poll');

    const data = await response.json();
    showToast("Poll created successfully!", "success");
    setShowCreatePoll(false);

    // Poll message will arrive via socket 'new-message' event
  } catch (error) {
    console.error('Error creating poll:', error);
    showToast("Failed to create poll", "error");
  }
};

const handleVotePoll = async (pollId, optionIds) => {
  try {
    const token = localStorage.getItem('token');

    const response = await fetch(`${process.env.REACT_APP_API_BASE || 'http://localhost:5000'}/api/polls/${pollId}/vote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ optionIds })
    });

    if (!response.ok) throw new Error('Failed to vote');

    const data = await response.json();

    // Update local poll data
    setMessages(prev => prev.map(msg => {
      if (msg.payload?.poll === pollId) {
        return { ...msg, pollData: data.data.poll };
      }
      return msg;
    }));

    showToast("Vote recorded!", "success");
  } catch (error) {
    console.error('Error voting:', error);
    showToast("Failed to vote", "error");
  }
};
