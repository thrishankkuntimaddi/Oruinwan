import React, { createContext, useContext, useState, useEffect } from "react";

const BlogsContext = createContext();

export const useBlogs = () => useContext(BlogsContext);

export const BlogsProvider = ({ children }) => {
    const [posts, setPosts] = useState(() => {
        const saved = localStorage.getItem("chttrix_blogs");
        return saved ? JSON.parse(saved) : [
            {
                id: "1",
                author: { name: "Sarah Connor", avatar: "", role: "Lead Designer" },
                context: "Project Alpha",
                title: "Project Alpha Milestone Achieved 🚀",
                content: "The team completed the initial design phase of Project Alpha, marking a significant milestone. It involved detailed wireframes, component planning, and user flows. Hats off to the entire team!",
                tags: ["Milestone", "UX", "Design"],
                likes: 12,
                comments: [
                    { id: 1, author: "John Doe", text: "Amazing work, Sarah!", timestamp: new Date(Date.now() - 10000000).toISOString() }
                ],
                timestamp: new Date(Date.now() - 86400000).toISOString(),
            },
            {
                id: "2",
                author: { name: "Mike Ross", avatar: "", role: "Frontend Dev" },
                context: "Development",
                title: "Fixed the critical login bug 🐛",
                content: "Finally squashed that annoying auth bug that was causing token refresh issues. The login flow is now 100% stable across all devices.",
                tags: ["BugFix", "Engineering"],
                likes: 8,
                comments: [],
                timestamp: new Date(Date.now() - 172800000).toISOString(),
            }
        ];
    });

    const [activeFilter, setActiveFilter] = useState("all"); // all, my-posts, mentions

    useEffect(() => {
        localStorage.setItem("chttrix_blogs", JSON.stringify(posts));
    }, [posts]);

    const addPost = (newPost) => {
        const post = {
            id: Date.now().toString(),
            author: { name: "You", avatar: "", role: "Team Member" }, // Mock current user
            likes: 0,
            comments: [],
            timestamp: new Date().toISOString(),
            ...newPost
        };
        setPosts([post, ...posts]);
    };

    const likePost = (id) => {
        setPosts(prev => prev.map(post =>
            post.id === id ? { ...post, likes: post.likes + 1 } : post
        ));
    };

    const addComment = (postId, text) => {
        const newComment = {
            id: Date.now(),
            author: "You",
            text,
            timestamp: new Date().toISOString()
        };
        setPosts(prev => prev.map(post =>
            post.id === postId ? { ...post, comments: [...post.comments, newComment] } : post
        ));
    };

    const deletePost = (id) => {
        setPosts(prev => prev.filter(post => post.id !== id));
    };

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
