// client/src/components/messages/chat/ChatWindow/index.jsx

import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import "../../../messagesComp/chatWindowComp/chatWindow.css";

import Header from "../../../messagesComp/chatWindowComp/header/header.jsx";
import PinnedMessage from "../../../messagesComp/chatWindowComp/pinned/pinnedMessage.jsx";
import ContactInfoModal from "../../../messagesComp/chatWindowComp/modals/contactInfoModal.jsx";
import ContactShareModal from "../../../messagesComp/chatWindowComp/modals/contactShareModal.jsx";
import Toast from "../../../ui/Toast.jsx";
import ForwardMessageModal from "../../../messagesComp/chatWindowComp/modals/ForwardMessageModal.jsx";
import ChannelManagementModal from "../../../messagesComp/ChannelManagementModal.jsx";
import ThreadPanel from "../../../messagesComp/chatWindowComp/ThreadPanel.jsx";
import MessagesContainer from "../../../messagesComp/chatWindowComp/messages/messagesContainer.jsx";
import ReplyPreview from "../../../messagesComp/chatWindowComp/messages/replyPreview.jsx";
import FooterInput from "../../../messagesComp/chatWindowComp/footer/footerInput.jsx";

import { pickFile } from "../../../messagesComp/chatWindowComp/helpers/helpers.js";
import { useSocketConnection } from "./useSocketConnection";
import {
    formatTime,
    getCurrentUserIdFromToken,
    mapBackendMsgToUI,
    generateTempId
} from "./chatUtils";
import { useAuth } from "../../../../contexts/AuthContext";

import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

// ✅ CORRECT: No chat prop! Derive from URL instead
export default function ChatWindow({ onClose, contacts = [], onDeleteChat }) {
    const { accessToken } = useAuth();
    /* ✅ SINGLE SOURCE OF TRUTH: URL PARAMS */
    const { channelId, dmId } = useParams();

    // ✅ Derive chat from URL params
    const chat = channelId
        ? { id: channelId, type: "channel" }
        : dmId
            ? { id: dmId, type: "dm" }
            : null;
    /* STATE */
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
    const [channelManagementTab, setChannelManagementTab] = useState(null);
    const [toast, setToast] = useState({ message: "", type: "success", visible: false });

    const [activeThread, setActiveThread] = useState(null);
    const [threadCounts, setThreadCounts] = useState({});

    const [openMsgMenuId, setOpenMsgMenuId] = useState(null);
    const [reactions, setReactions] = useState({});
    const [userReactions, setUserReactions] = useState({});

    const typingTimeoutRef = useRef(null);
    const [typingUsers, setTypingUsers] = useState([]);
    const [connected, setConnected] = useState(false);

    const currentUserIdRef = useRef(null);

    const [showForwardModal, setShowForwardModal] = useState(false);
    const [forwardingMsgId, setForwardingMsgId] = useState(null);

    const showToast = (message, type = "success") => {
        setToast({ message, type, visible: true });
    };

    /* LOAD CURRENT USER FROM TOKEN */
    useEffect(() => {
        currentUserIdRef.current = getCurrentUserIdFromToken();
    }, []);

    /* SOCKET CONNECTION */
    const socketRef = useSocketConnection(
        chat,
        accessToken,
        connected,
        setConnected,
        currentUserIdRef,
        (m) => mapBackendMsgToUI(m, currentUserIdRef.current),
        setMessages,
        pendingMessagesRef,
        setTypingUsers,
        setThreadCounts
    );

    /* LOAD CHAT HISTORY */
    useEffect(() => {
        if (!chat || !accessToken) return;

        let mounted = true;

        // ✅ Stable dependency - chatId won't change unless URL changes
        const chatId = chat.id;
        const chatType = chat.type;

        async function loadMessages() {
            try {
                const headers = { Authorization: `Bearer ${accessToken}` };

                let url = "";
                if (chatType === "dm") {
                    url = `${API_BASE}/api/messages/dm/${chatId}`;
                } else {
                    url = `${API_BASE}/api/messages/channel/${chatId}`;
                }

                const res = await axios.get(url, { headers });
                let loadedMessages = res.data.messages.map(m => mapBackendMsgToUI(m, currentUserIdRef.current));

                if (!mounted) return;
                setMessages(loadedMessages);

                // Mark as read for DMs
                if (chatType === "dm") {
                    axios.post(
                        `${API_BASE}/api/messages/dm/read`,
                        { otherUserId: chatId },
                        { headers }
                    );

                    const socket = socketRef.current;
                    if (socket && connected) {
                        socket.emit("read-messages", {
                            readerId: currentUserIdRef.current,
                            otherUserId: chatId,
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
        // ✅ CORRECT: Depend on stable string IDs, not chat object
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chat?.id, chat?.type, connected, accessToken]);

    /* OUTSIDE CLICK HANDLER */
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

    /* MESSAGE HANDLING */
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

        const uiMsg = {
            id: clientTempId,
            sender: "you",
            text: newMessage.trim(),
            ts: new Date().toISOString(),
            temp: true,
            sending: true,
            repliedToId: replyingTo?.backend?._id ?? replyingTo?.id ?? null,
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

    /* MESSAGE ACTIONS */
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

    const addReaction = (id, emoji) => {
        const previousEmoji = userReactions[id];

        if (previousEmoji === emoji) {
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

    const handleForward = (target) => {
        const msg = messages.find(m => m.id === forwardingMsgId);
        if (!msg) return;

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

    /* RENDER */
    return (
        <div className="flex h-full w-full bg-white overflow-hidden">
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

                    <ReplyPreview
                        replyingTo={replyingTo}
                        onCancel={() => setReplyingTo(null)}
                    />

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
