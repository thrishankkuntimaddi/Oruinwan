import { jwtDecode } from 'jwt-decode';
import { formatTime as fmtTime } from '../../../messagesComp/chatWindowComp/helpers/helpers.js';

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
