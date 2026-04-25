import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from '@services/api';
import { useSocket } from "./SocketContext";
import { useAuth } from "./AuthContext";

const UpdatesContext = createContext();

export const useUpdates = () => useContext(UpdatesContext);

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

export const UpdatesProvider = ({ children }) => {
    const { socket } = useSocket();
    const { user } = useAuth();

    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState("all");

    
    const companyId = user?.companyId?._id || user?.companyId || null;

    
    const loadUpdates = useCallback(async () => {
        if (!companyId) {
            setPosts([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            
            
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

    
    useEffect(() => {
        if (!socket || !companyId) return;

        
        socket.emit("join-company-updates", companyId);

        return () => {
            socket.emit("leave-company-updates", companyId);
        };
    }, [socket, companyId]);

    
    useEffect(() => {
        if (!socket) return;

        
        const handleCreated = (update) => {
            setPosts((prev) => [mapUpdateToPost(update), ...prev]);
        };

        
        const handleDeleted = ({ updateId }) => {
            setPosts((prev) => prev.filter((p) => p.id !== updateId));
        };

        
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

    

    
    const addPost = async (newPostData) => {
        try {
            const payload = {
                content: newPostData.content,          
                title: newPostData.title || undefined,
                type: (newPostData.context || "general").toLowerCase(),
                priority: newPostData.priority || "normal",
                attachments: newPostData.attachments || [],
                mentions: newPostData.mentions || [],
            };

            await api.post("/api/company/updates", payload);
            
            
        } catch (error) {
            console.error("[UpdatesContext] Failed to post update:", error);
        }
    };

    
    const likePost = async (id) => {
        try {
            await api.post(`/api/company/updates/${id}/react`, { emoji: "👍" });
            
        } catch (error) {
            console.error("[UpdatesContext] Failed to react:", error);
        }
    };

    
    const deletePost = async (id) => {
        try {
            await api.delete(`/api/company/updates/${id}`);
            
        } catch (error) {
            console.error("[UpdatesContext] Failed to delete update:", error);
        }
    };

    
    const addComment = () => {
        console.warn("[UpdatesContext] Comments on updates are not yet implemented.");
    };

    
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
