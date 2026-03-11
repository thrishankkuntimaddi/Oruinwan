// client/src/contexts/UpdatesContext.jsx
//
// Company Updates Context — Phase 2 (Company Communication Layer)
// Replaces the legacy BlogsContext.jsx which used incorrect legacy endpoints.
//
// API contract (all authenticated, company-scoped):
//   GET    /api/company/updates              — list updates (newest first, pinned first)
//   POST   /api/company/updates              — post new update (manager+ only)
//   DELETE /api/company/updates/:id          — soft-delete (poster or admin)
//   POST   /api/company/updates/:id/react    — toggle emoji reaction
//
// Socket room: company:{companyId}:updates
// Events listened:
//   company:update:created  → new update prepended to feed
//   company:update:deleted  → update removed from feed
//   company:update:reacted  → reactions refreshed on matching update

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../services/api";
import { useSocket } from "./SocketContext";
import { useAuth } from "./AuthContext";

const UpdatesContext = createContext();

export const useUpdates = () => useContext(UpdatesContext);

// ─────────────────────────────────────────────────────────────────
// Helper: map a backend Update document → frontend post shape
// ─────────────────────────────────────────────────────────────────
function mapUpdateToPost(update) {
    return {
        id: update._id,
        author: {
            name: update.postedBy?.username || "Unknown",
            avatar: update.postedBy?.profilePicture || "",
            role: update.postedBy?.companyRole || "Team Member",
            id: update.postedBy?._id,
        },
        context: update.type || "general",
        title: update.title || "",
        content: update.message || "",
        tags: update.priority ? [update.priority] : [],
        likes: update.reactions?.length || 0,
        reactions: update.reactions || [],
        comments: [],
        timestamp: update.createdAt,
        isPinned: update.isPinned || false,
    };
}

// ─────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────
export const UpdatesProvider = ({ children }) => {
    const { socket } = useSocket();
    const { user } = useAuth();

    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState("all");

    // Resolve company ID from the auth user object (handles populated or plain string)
    const companyId = user?.companyId?._id || user?.companyId || null;

    // ── LOAD ───────────────────────────────────────────────────────
    const loadUpdates = useCallback(async () => {
        if (!companyId) {
            setPosts([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            // ✅ NEW endpoint — company-scoped, no companyId in URL
            // The backend resolves companyId from the JWT via requireCompanyMember
            const response = await api.get("/api/company/updates");
            const mapped = (response.data.updates || []).map(mapUpdateToPost);
            setPosts(mapped);
        } catch (error) {
            console.error("[UpdatesContext] Failed to load updates:", error);
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    useEffect(() => {
        loadUpdates();
    }, [loadUpdates]);

    // ── SOCKET ROOM JOIN / LEAVE ───────────────────────────────────
    useEffect(() => {
        if (!socket || !companyId) return;

        // Join the company updates room so real-time events are received
        socket.emit("join-company-updates", companyId);

        return () => {
            socket.emit("leave-company-updates", companyId);
        };
    }, [socket, companyId]);

    // ── SOCKET EVENT LISTENERS ────────────────────────────────────
    useEffect(() => {
        if (!socket) return;

        // company:update:created — prepend new update to feed
        const handleCreated = (update) => {
            setPosts((prev) => [mapUpdateToPost(update), ...prev]);
        };

        // company:update:deleted — remove from feed
        const handleDeleted = ({ updateId }) => {
            setPosts((prev) => prev.filter((p) => p.id !== updateId));
        };

        // company:update:reacted — refresh reactions on the matching update
        const handleReacted = ({ updateId, reactions }) => {
            setPosts((prev) =>
                prev.map((p) =>
                    p.id === updateId
                        ? { ...p, likes: reactions?.length || 0, reactions: reactions || [] }
                        : p
                )
            );
        };

        socket.on("company:update:created", handleCreated);
        socket.on("company:update:deleted", handleDeleted);
        socket.on("company:update:reacted", handleReacted);

        return () => {
            socket.off("company:update:created", handleCreated);
            socket.off("company:update:deleted", handleDeleted);
            socket.off("company:update:reacted", handleReacted);
        };
    }, [socket]);

    // ── ACTIONS ───────────────────────────────────────────────────

    /**
     * Post a new company update.
     * Body field is `content` (not `message`) as required by the new backend validation.
     */
    const addPost = async (newPostData) => {
        try {
            const payload = {
                content: newPostData.content,          // ✅ field name the backend expects
                title: newPostData.title || undefined,
                type: (newPostData.context || "general").toLowerCase(),
                priority: newPostData.priority || "normal",
                attachments: newPostData.attachments || [],
                mentions: newPostData.mentions || [],
            };

            await api.post("/api/company/updates", payload);
            // Real-time: the server will emit company:update:created back,
            // which the socket listener above will use to update state.
        } catch (error) {
            console.error("[UpdatesContext] Failed to post update:", error);
        }
    };

    /**
     * Toggle an emoji reaction (👍 = "like").
     */
    const likePost = async (id) => {
        try {
            await api.post(`/api/company/updates/${id}/react`, { emoji: "👍" });
            // Real-time: server emits company:update:reacted
        } catch (error) {
            console.error("[UpdatesContext] Failed to react:", error);
        }
    };

    /**
     * Soft-delete an update.
     */
    const deletePost = async (id) => {
        try {
            await api.delete(`/api/company/updates/${id}`);
            // Real-time: server emits company:update:deleted
        } catch (error) {
            console.error("[UpdatesContext] Failed to delete update:", error);
        }
    };

    /**
     * Comments are not yet implemented in the backend.
     */
    const addComment = () => {
        console.warn("[UpdatesContext] Comments on updates are not yet implemented.");
    };

    // ── FILTER ────────────────────────────────────────────────────
    const filteredPosts = posts.filter((post) => {
        if (activeFilter === "my-posts") {
            const currentUserId = user?._id || user?.sub;
            return post.author.id === currentUserId;
        }
        return true;
    });

    return (
        <UpdatesContext.Provider
            value={{
                posts: filteredPosts,
                loading,
                addPost,
                likePost,
                addComment,
                deletePost,
                activeFilter,
                setActiveFilter,
                refreshUpdates: loadUpdates,
            }}
        >
            {children}
        </UpdatesContext.Provider>
    );
};
