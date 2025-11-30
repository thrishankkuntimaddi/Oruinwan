import { jwtDecode } from 'jwt-decode';
import { formatTime as fmtTime } from '../helpers/helpers.js';

export const formatTime = (iso) => fmtTime(iso);

export const getAccessToken = () => {
    const t = localStorage.getItem("accessToken");
    if (t) return t;

    const match = document.cookie.match(/(^| )accessToken=([^;]+)/);
    if (match) return match[2];

    return null;
};

export const getCurrentUserIdFromToken = () => {
    const t = getAccessToken();
    if (!t) return null;

    try {
        const d = jwtDecode(t);
        return d.sub || d.id || d.userId || null;
    } catch {
        return null;
    }
};

export const mapBackendMsgToUI = (m, currentUserId) => {
    const senderObj = typeof m.senderId === "object" ? m.senderId : {};
    const senderId = senderObj._id || senderObj.id || m.senderId;

    const me = String(senderId) === String(currentUserId);

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

export const generateTempId = () => `temp-${crypto.randomUUID()}`;

export const getDummyMessagesForDM = (chat) => {
    const now = new Date();
    return [
        {
            id: "dm-system",
            sender: "system",
            text: `This is the beginning of your direct message history with ${chat.name}.`,
            ts: new Date(now.getTime() - 1000 * 60 * 60 * 3).toISOString(),
        },
        {
            id: "dm-1",
            sender: "other",
            senderName: chat.name,
            senderAvatar: chat.image || null,
            text: `Hey! This is the start of your private conversation with ${chat.name}.`,
            ts: new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString(),
        },
        {
            id: "dm-2",
            sender: "me",
            senderName: "You",
            text: "Hi! Good to connect here.",
            ts: new Date(now.getTime() - 1000 * 60 * 60).toISOString(),
            status: "read",
        },
        {
            id: "dm-3",
            sender: "other",
            senderName: chat.name,
            senderAvatar: chat.image || null,
            text: "Let me know if you need anything specific.",
            ts: new Date(now.getTime() - 1000 * 60 * 30).toISOString(),
        },
        {
            id: "dm-4",
            sender: "me",
            senderName: "You",
            text: "Will do, thanks!",
            ts: new Date(now.getTime() - 1000 * 60 * 5).toISOString(),
            status: "sent",
        }
    ];
};

export const getDummyMessagesForChannel = (chat) => {
    const now = new Date();
    return [
        {
            id: "ch-1",
            sender: "other",
            senderName: "Alice",
            text: `Welcome everyone to #${chat.name}!`,
            ts: new Date(now.getTime() - 1000 * 60 * 60 * 5).toISOString(),
            reactions: { "👋": 5 },
        },
        {
            id: "ch-2",
            sender: "other",
            senderName: "Bob",
            text: "Excited to be part of this channel.",
            ts: new Date(now.getTime() - 1000 * 60 * 60 * 4).toISOString(),
        },
        {
            id: "ch-3",
            sender: "me",
            senderName: "You",
            text: "Hello team! Ready to collaborate.",
            ts: new Date(now.getTime() - 1000 * 60 * 60).toISOString(),
            status: "read",
        },
        {
            id: "ch-4",
            sender: "other",
            senderName: "Charlie",
            text: "Does anyone have the latest design specs?",
            ts: new Date(now.getTime() - 1000 * 60 * 30).toISOString(),
            isPinned: true,
        },
        {
            id: "ch-5",
            sender: "other",
            senderName: "Alice",
            text: "I'll upload them to the files tab shortly.",
            ts: new Date().toISOString(),
        }
    ];
};
