import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useBlogs } from "../../contexts/BlogsContext";
import { Heart, MessageCircle, MoreHorizontal, Send, User, Image as ImageIcon, Flag, Trash2, Copy } from "lucide-react";

const Blogs = () => {
  const navigate = useNavigate();
  const { posts, addPost, likePost } = useBlogs();
  const [newPostContent, setNewPostContent] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePost = () => {
    if (!newPostContent.trim()) return;

    setIsPosting(true);
    setTimeout(() => {
      addPost({
        title: "Project Update",
        content: newPostContent,
        tags: [],
        context: "General"
      });
      setNewPostContent("");
      setIsPosting(false);
    }, 600);
  };

  const handleDiscuss = (authorName) => {
    // Navigate to DM with the author (Mock ID for now)
    // In a real app, we'd look up the user's ID
    navigate(`/dm/1?initialMessage=Hi ${authorName}, I saw your update regarding...`);
  };

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    const now = new Date();
    const diff = (now - date) / 1000;

    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">

          {/* Create Post Widget */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shrink-0">
                Y
              </div>
              <div className="flex-1">
                <textarea
                  placeholder="Share an achievement or project update..."
                  className="w-full bg-gray-50 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none text-gray-700 min-h-[80px]"
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                />
                <div className="flex justify-between items-center mt-3">
                  <div className="flex gap-2">
                    <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors" title="Add Image">
                      <ImageIcon size={20} />
                    </button>
                  </div>
                  <button
                    onClick={handlePost}
                    disabled={!newPostContent.trim() || isPosting}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2
                            ${!newPostContent.trim() || isPosting
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
                      }
                        `}
                  >
                    {isPosting ? "Posting..." : <>Post Update <Send size={14} /></>}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Feed Divider */}
          <div className="flex items-center gap-4">
            <div className="h-px bg-gray-200 flex-1" />
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Team Updates</span>
            <div className="h-px bg-gray-200 flex-1" />
          </div>

          {/* Posts Feed */}
          {posts.map((post) => (
            <div key={post.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-visible animate-in fade-in slide-in-from-bottom-4 duration-500 relative">

              {/* Post Header */}
              <div className="p-4 flex justify-between items-start">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-medium shrink-0">
                    {post.author.avatar ? <img src={post.author.avatar} alt="" className="w-full h-full rounded-full" /> : <User size={20} />}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">{post.author.name}</h3>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      {post.author.role} • <span className="text-blue-600 font-medium">{post.context}</span> • {formatTime(post.timestamp)}
                    </p>
                  </div>
                </div>

                {/* More Menu */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuId(activeMenuId === post.id ? null : post.id);
                    }}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <MoreHorizontal size={18} />
                  </button>

                  {activeMenuId === post.id && (
                    <div ref={menuRef} className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-20 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                      <button
                        onClick={() => handleDiscuss(post.author.name)}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                      >
                        <MessageCircle size={14} className="text-gray-400" /> Message Author
                      </button>
                      <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors">
                        <Copy size={14} className="text-gray-400" /> Copy Link
                      </button>
                      <div className="h-px bg-gray-100 my-1" />
                      <button className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors">
                        <Flag size={14} /> Report
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Post Content */}
              <div className="px-4 pb-2">
                {post.title && <h4 className="font-bold text-gray-800 mb-2">{post.title}</h4>}
                <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">
                  {post.content}
                </p>

                {post.tags && post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {post.tags.map(tag => (
                      <span key={tag} className="text-blue-600 text-xs font-medium hover:underline cursor-pointer">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Post Stats */}
              <div className="px-4 py-3 flex items-center justify-between text-xs text-gray-500 border-b border-gray-50">
                <span>{post.likes} appreciations</span>
              </div>

              {/* Actions */}
              <div className="flex items-center px-2 py-1">
                <button
                  onClick={() => likePost(post.id)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 text-gray-500 hover:bg-gray-50 rounded-lg transition-colors group"
                >
                  <Heart size={18} className="group-hover:text-red-500 transition-colors" />
                  <span className="text-sm font-medium group-hover:text-red-500">Appreciate</span>
                </button>
                <button
                  onClick={() => handleDiscuss(post.author.name)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 text-gray-500 hover:bg-gray-50 rounded-lg transition-colors group"
                >
                  <MessageCircle size={18} className="group-hover:text-blue-500 transition-colors" />
                  <span className="text-sm font-medium group-hover:text-blue-500">Discuss</span>
                </button>
              </div>

            </div>
          ))}

          {posts.length === 0 && (
            <div className="text-center py-10 text-gray-400">
              <p>No updates yet. Be the first to share something!</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Blogs;
