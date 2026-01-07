import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock } from 'lucide-react';

const Blog = () => {
    const navigate = useNavigate();

    const posts = [
        {
            title: "Introducing Chttrix 2.0: The Future of Work",
            excerpt: "Today we're announcing the biggest update in our history. A completely new way to manage your tasks, chats, and huddles.",
            date: "Jan 12, 2026",
            author: "Thrishank Kuntimaddi",
            category: "Product"
        },
        {
            title: "How Remote Teams Stay Connected",
            excerpt: "Tips and tricks from our own team on maintaining culture and velocity while working from 12 different timezones.",
            date: "Jan 05, 2026",
            author: "Sarah Jenkins",
            category: "Culture"
        },
        {
            title: "The Security Architecture Behind Chttrix",
            excerpt: "A deep dive into our end-to-end encryption protocols and how we keep your enterprise data safe.",
            date: "Dec 28, 2025",
            author: "Alex Chen",
            category: "Engineering"
        }
    ];

    return (
        <div className="min-h-screen bg-white dark:bg-[#030712] text-slate-900 dark:text-white transition-colors duration-500">
            <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-[#030712]/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/5">
                <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
                        <img src="/chttrix-logo.jpg" alt="Logo" className="w-10 h-10 rounded-xl shadow-md" />
                        <span className="font-black text-2xl tracking-tighter">Chttrix</span>
                    </div>
                    <button onClick={() => navigate("/")} className="text-sm font-bold text-slate-500 hover:text-indigo-600 dark:hover:text-white transition-colors flex items-center gap-2">
                        <ArrowLeft size={16} /> Back to Home
                    </button>
                </div>
            </nav>

            <header className="pt-40 pb-20 container mx-auto px-6 text-center">
                <div className="inline-block px-4 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-sm font-bold rounded-full mb-8">
                    The Chttrix Blog
                </div>
                <h1 className="text-5xl md:text-7xl font-black mb-8 tracking-tight">
                    Thinking about the <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400">future of collaboration</span>.
                </h1>
            </header>

            <section className="py-20 bg-slate-50 dark:bg-[#0B0F19]">
                <div className="container mx-auto px-6 max-w-6xl">
                    <div className="grid md:grid-cols-3 gap-8">
                        {posts.map((post, i) => (
                            <article key={i} className="bg-white dark:bg-[#030712] p-8 rounded-3xl border border-slate-200 dark:border-white/5 hover:border-indigo-500 dark:hover:border-indigo-500 transition-all hover:shadow-xl cursor-pointer group">
                                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-4 block">{post.category}</span>
                                <h3 className="text-2xl font-bold mb-4 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{post.title}</h3>
                                <p className="text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                                    {post.excerpt}
                                </p>
                                <div className="flex items-center justify-between text-sm text-slate-400 dark:text-slate-500 font-medium">
                                    <span>{post.author}</span>
                                    <span className="flex items-center gap-1"><Clock size={14} /> {post.date}</span>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>
            <footer className="py-12 border-t border-slate-200 dark:border-white/5 text-center text-slate-500 dark:text-slate-400">
                <p>© 2026 Chttrix Inc.</p>
            </footer>
        </div>
    );
};

export default Blog;
