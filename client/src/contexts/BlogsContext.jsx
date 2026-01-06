import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../services/api";
import { useSocket } from "./SocketContext";
import { useLocation } from "react-router-dom";

const BlogsContext = createContext();

export const useBlogs = () => useContext(BlogsContext);

export const BlogsProvider = ({ children }) => {
    const { socket } = useSocket();
    const location = useLocation();

    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState("all");

    // Extract workspaceId from URL or other source
    const getWorkspaceId = useCallback(() => {
        const match = location.pathname.match(/\/workspace\/([^/]+)/);
        return match ? match[1] : null;
    }, [location.pathname]);

    const loadUpdates = useCallback(async () => {
        const workspaceId = getWorkspaceId();
        if (!workspaceId) {
            setPosts([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const response = await api.get(`/api/updates/${workspaceId}`);

            // Map backend updates to frontend 'posts' format
            const mappedPosts = response.data.updates.map(update => ({
                id: update._id,
                author: {
                    name: update.postedBy?.username || "Unknown",
                    avatar: update.postedBy?.profilePicture || "",
                    role: "Team Member", // Backend user schema might need role check
                    id: update.postedBy?._id
                },
                // Fallback for title/context since backend model is simpler
                context: update.type || "General",
                title: update.type === 'announcement' ? "Announcement" : "Update",
                content: update.message || "",
                tags: update.priority ? [update.priority] : [],
                likes: update.reactions?.length || 0,
                comments: [], // Comments not yet supported on backend Updates
                timestamp: update.createdAt,
                workspaceId: update.workspace,
                isPinned: update.isPinned
            }));

            setPosts(mappedPosts);
        } catch (error) {
            console.error("Failed to load updates:", error);
        } finally {
            setLoading(false);
        }
    }, [getWorkspaceId]);

    useEffect(() => {
        loadUpdates();
    }, [loadUpdates]);

    const addPost = async (newPostData) => {
        const workspaceId = getWorkspaceId();
        if (!workspaceId) return;

        try {
            const payload = {
                workspaceId,
                message: newPostData.content, // Map content to message
                type: newPostData.context || "general", // Map context to type
                priority: "normal"
            };

            const response = await api.post("/api/updates", payload);
            // Optimistic update handled by socket or we can just append
            // But let's rely on socket for real-time consistency or append manually
            // Not appending here to avoid duplication if socket is fast
        } catch (error) {
            console.error("Failed to post update:", error);
        }
    };

    const likePost = async (id) => {
        try {
            // Toggle reaction
            await api.post(`/api/updates/${id}/react`, { emoji: "👍" });
            // UI update handled by socket
        } catch (error) {
            console.error("Failed to like post:", error);
        }
    };

    const addComment = (postId, text) => {
        // Backend currently doesn't support comments on Updates
        console.warn("Comments on updates not yet implemented in backend");
    };

    const deletePost = async (id) => {
        try {
            await api.delete(`/api/updates/${id}`);
        } catch (error) {
            console.error("Failed to delete post:", error);
        }
    };

    // WebSocket Listeners
    useEffect(() => {
        if (!socket) return;

        const mapUpdateToFrontend = (update) => ({
            id: update._id,
            author: {
                name: update.postedBy?.username || "Unknown",
                avatar: update.postedBy?.profilePicture || "",
                role: "Team Member",
                id: update.postedBy?._id
            },
            context: update.type || "General",
            title: update.type === 'announcement' ? "Announcement" : "Update",
            content: update.message || "",
            tags: update.priority ? [update.priority] : [],
            likes: update.reactions?.length || 0,
            comments: [],
            timestamp: update.createdAt,
            workspaceId: update.workspace,
            isPinned: update.isPinned
        });

        socket.on("update-created", (update) => {
            console.log("📢 Update created (socket):", update);
            const currentWsId = getWorkspaceId();
            if (currentWsId && update.workspace !== currentWsId) return;

            setPosts(prev => [mapUpdateToFrontend(update), ...prev]);
        });

        socket.on("update-updated", (update) => {
            console.log("🔄 Update updated (socket):", update);
            setPosts(prev => prev.map(p =>
                p.id === update._id ? mapUpdateToFrontend(update) : p
            ));
        });

        socket.on("update-deleted", ({ updateId }) => {
            console.log("🗑️ Update deleted (socket):", updateId);
            setPosts(prev => prev.filter(p => p.id !== updateId));
        });

        return () => {
            socket.off("update-created");
            socket.off("update-updated");
            socket.off("update-deleted");
        };
    }, [socket, getWorkspaceId]);

    const filteredPosts = posts.filter(post => {
        if (activeFilter === "my-posts") return post.author.name === "You";
        // Add more filters as needed
        return true;
    });

    return (
        <BlogsContext.Provider value={{
            posts: filteredPosts,
            addPost,
            likePost,
            addComment,
            deletePost,
            activeFilter,
            setActiveFilter
        }}>
            {children}
        </BlogsContext.Provider>
    );
};
