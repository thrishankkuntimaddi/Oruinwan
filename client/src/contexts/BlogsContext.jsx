import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../services/api";
import { useSocket } from "./SocketContext";
import { useAuth } from "./AuthContext"; // Import AuthContext
import { useLocation } from "react-router-dom";

const BlogsContext = createContext();

export const useBlogs = () => useContext(BlogsContext);

export const BlogsProvider = ({ children }) => {
    const { socket } = useSocket();
    const { user } = useAuth(); // Get user
    const location = useLocation();

    const [posts, setPosts] = useState([]);
    const [, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState("all");

    // Extract workspaceId from URL (still useful for creation context)
    const getWorkspaceId = useCallback(() => {
        const match = location.pathname.match(/\/workspace\/([^/]+)/);
        return match ? match[1] : null;
    }, [location.pathname]);

    // Fetch Company Updates
    const loadUpdates = useCallback(async () => {
        // Use company ID from user object
        const companyId = user?.companyId?._id || user?.companyId; // Handle populated or string ID

        if (!companyId) {
            setPosts([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            // Fetch from NEW company updates endpoint
            const response = await api.get(`/api/updates/company/${companyId}`);

            // Map backend updates to frontend 'posts' format
            const mappedPosts = response.data.updates.map(update => ({
                id: update._id,
                author: {
                    name: update.postedBy?.username || "Unknown",
                    avatar: update.postedBy?.profilePicture || "",
                    role: "Team Member",
                    id: update.postedBy?._id
                },
                context: update.type || "general",
                title: update.title || (update.type === 'announcement' ? "Announcement" : ""), // Don't default to "Update"
                content: update.message || "",
                tags: update.priority ? [update.priority] : [],
                likes: update.reactions?.length || 0,
                comments: [],
                timestamp: update.createdAt,
                workspaceId: update.workspace?._id || update.workspace,
                workspace: update.workspace?.name || "Workspace", // Map to 'workspace' for UI
                isPinned: update.isPinned
            }));

            setPosts(mappedPosts);
        } catch (error) {
            console.error("Failed to load updates:", error);
        } finally {
            setLoading(false);
        }
    }, [user?.companyId]); // Depend on user.companyId

    useEffect(() => {
        loadUpdates();
    }, [loadUpdates]);

    const addPost = async (newPostData) => {
        const workspaceId = getWorkspaceId();
        // If no workspace in URL, we might need a fallback, but for now strict check
        if (!workspaceId) {
            console.error("Workspace ID required for creating update");
            return;
        }

        try {
            const payload = {
                workspaceId,
                title: newPostData.title, // ✅ Pass title
                message: newPostData.content,
                type: (newPostData.context || "general").toLowerCase(), // ✅ FORCE LOWERCASE
                priority: "normal"
            };

            await api.post("/api/updates", payload);
            // Socket handles UI update
        } catch (error) {
            console.error("Failed to post update:", error);
        }
    };

    const likePost = async (id) => {
        try {
            await api.post(`/api/updates/${id}/react`, { emoji: "👍" });
        } catch (error) {
            console.error("Failed to like post:", error);
        }
    };

    const addComment = (postId, text) => {
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
            context: update.type || "general",
            title: update.title || (update.type === 'announcement' ? "Announcement" : ""),
            content: update.message || "",
            tags: update.priority ? [update.priority] : [],
            likes: update.reactions?.length || 0,
            comments: [],
            timestamp: update.createdAt,
            workspaceId: update.workspace?._id || update.workspace, // might not be populated in socket event
            workspace: update.workspace?.name || "Workspace", // Map to 'workspace' for UI
            isPinned: update.isPinned
        });

        socket.on("update-created", (update) => {

            // ✅ REMOVED WORKSPACE FILTER to allow company-wide updates
            setPosts(prev => [mapUpdateToFrontend(update), ...prev]);
        });

        socket.on("update-updated", (update) => {

            setPosts(prev => prev.map(p =>
                p.id === update._id ? mapUpdateToFrontend(update) : p
            ));
        });

        socket.on("update-deleted", ({ updateId }) => {

            setPosts(prev => prev.filter(p => p.id !== updateId));
        });

        return () => {
            socket.off("update-created");
            socket.off("update-updated");
            socket.off("update-deleted");
        };
    }, [socket]);

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
