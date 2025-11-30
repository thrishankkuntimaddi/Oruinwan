import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

export const useSocketConnection = (chat, getAccessToken, connected, setConnected, currentUserIdRef, mapBackendMsgToUI, setMessages, pendingMessagesRef, setTypingUsers, setThreadCounts) => {
    const socketRef = useRef(null);

    useEffect(() => {
        if (!chat) return;

        const token = getAccessToken();
        const socket = io(API_BASE, {
            auth: { token },
            transports: ["websocket"],
        });

        socketRef.current = socket;

        /* --- Connection --- */
        socket.on("connect", () => {
            setConnected(true);

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
            setThreadCounts((prev) => ({
                ...prev,
                [parentId]: (prev[parentId] || 0) + 1,
            }));
        });

        return () => {
            socket.disconnect();
        };
    }, [chat]);

    return socketRef;
};
