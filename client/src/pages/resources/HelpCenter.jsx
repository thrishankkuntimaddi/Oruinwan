import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Book, MessageCircle, Zap } from 'lucide-react';

const HelpCenter = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-white transition-colors duration-500">
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

            <header className="pt-40 pb-20 bg-white dark:bg-[#0B0F19] text-center px-6 border-b border-slate-200 dark:border-white/5">
                <h1 className="text-4xl md:text-5xl font-black mb-8">How can we help?</h1>
                <div className="max-w-2xl mx-auto relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search for articles..."
                        className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-lg"
                    />
                </div>
            </header>

            <section className="py-20 container mx-auto px-6 max-w-6xl">
                <div className="grid md:grid-cols-3 gap-8">
                    <div className="bg-white dark:bg-[#0B0F19] p-8 rounded-3xl border border-slate-200 dark:border-white/5 hover:border-indigo-500 transition-colors cursor-pointer text-center">
                        <Book className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                        <h3 className="text-xl font-bold mb-2">Getting Started</h3>
                        <p className="text-slate-500 dark:text-slate-400">Learn the basics of Chttrix workspaces.</p>
                    </div>
                    <div className="bg-white dark:bg-[#0B0F19] p-8 rounded-3xl border border-slate-200 dark:border-white/5 hover:border-indigo-500 transition-colors cursor-pointer text-center">
                        <Zap className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                        <h3 className="text-xl font-bold mb-2">Features & Tips</h3>
                        <p className="text-slate-500 dark:text-slate-400">Master tasks, huddles, and AI workflows.</p>
                    </div>
                    <div className="bg-white dark:bg-[#0B0F19] p-8 rounded-3xl border border-slate-200 dark:border-white/5 hover:border-indigo-500 transition-colors cursor-pointer text-center">
                        <MessageCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                        <h3 className="text-xl font-bold mb-2">Account & Billing</h3>
                        <p className="text-slate-500 dark:text-slate-400">Manage your subscription and settings.</p>
                    </div>
                </div>
            </section>
            <footer className="py-12 border-t border-slate-200 dark:border-white/5 text-center text-slate-500 dark:text-slate-400">
                <p>© 2026 Chttrix Inc.</p>
            </footer>
        </div>
    );
};

export default HelpCenter;
