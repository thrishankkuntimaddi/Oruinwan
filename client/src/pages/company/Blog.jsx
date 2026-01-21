import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, PenTool, Hash, Clock, FileText } from 'lucide-react';

const Blog = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-white dark:bg-[#030712] text-slate-900 dark:text-white transition-colors duration-500">
            {/* Navbar */}
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

            {/* Hero */}
            <header className="pt-40 pb-20 container mx-auto px-6 text-center max-w-4xl">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-500/20 rounded-full text-orange-600 dark:text-orange-400 font-bold mb-8">
                    <PenTool size={16} />
                    Thoughts & Updates
                </div>
                <h1 className="text-5xl md:text-7xl font-black mb-8 tracking-tight">
                    Chttrix Blog
                </h1>
                <p className="text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
                    Sharing thoughts on building secure communication tools, product decisions, and lessons learned along the way.
                </p>
            </header>

            {/* Topics */}
            <section className="py-20 bg-slate-50 dark:bg-[#0B0F19] border-y border-slate-200 dark:border-white/5">
                <div className="container mx-auto px-6 max-w-5xl">
                    <h2 className="text-2xl font-bold mb-12 text-center uppercase tracking-widest text-slate-400">What We Write About</h2>
                    <div className="grid md:grid-cols-4 gap-6">
                        <TopicCard icon={<Hash />} label="Product Updates" />
                        <TopicCard icon={<FileText />} label="Security & encryption" />
                        <TopicCard icon={<BookOpen />} label="Engineering" />
                        <TopicCard icon={<Clock />} label="Design Philosophy" />
                    </div>
                </div>
            </section>

            {/* Coming Soon State */}
            <section className="py-32 container mx-auto px-6 text-center">
                <div className="max-w-2xl mx-auto p-12 bg-white dark:bg-[#111827] rounded-3xl shadow-xl border border-slate-100 dark:border-white/5">
                    <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mx-auto mb-8 text-indigo-500">
                        <PenTool size={40} className="animate-pulse" />
                    </div>
                    <h2 className="text-3xl font-black mb-4">Coming Soon</h2>
                    <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">
                        Our first posts are in progress. We publish when there’s something meaningful to share — not on a fixed schedule.
                    </p>
                    <div className="inline-block px-6 py-3 bg-slate-100 dark:bg-black/40 rounded-full text-slate-500 text-sm font-bold">
                        Stay tuned for updates
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 border-t border-slate-200 dark:border-white/5 text-center text-slate-500 dark:text-slate-400">
                <p>© 2026 Chttrix Inc.</p>
            </footer>
        </div>
    );
};

const TopicCard = ({ icon, label }) => (
    <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm hover:-translate-y-1 transition-transform">
        <div className="text-slate-400 mb-4">
            {React.cloneElement(icon, { size: 32 })}
        </div>
        <span className="font-bold text-slate-700 dark:text-slate-300 text-center">{label}</span>
    </div>
);

export default Blog;
