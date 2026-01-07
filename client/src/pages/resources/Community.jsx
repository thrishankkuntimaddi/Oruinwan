import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Users } from 'lucide-react';

const Community = () => {
    const navigate = useNavigate();

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
                <h1 className="text-5xl md:text-7xl font-black mb-8 tracking-tight">
                    Join the Community
                </h1>
                <p className="text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto mb-12">
                    Connect with over 10,000 developers and designers building the future of work on Chttrix.
                </p>
                <div className="flex justify-center gap-4">
                    <button className="px-8 py-4 bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold rounded-2xl transition-colors flex items-center gap-2">
                        <MessageSquare size={20} /> Join Discord
                    </button>
                    <button className="px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-black font-bold rounded-2xl hover:opacity-90 transition-colors flex items-center gap-2">
                        <Users size={20} /> Forum
                    </button>
                </div>
            </header>

            <section className="py-20 bg-slate-50 dark:bg-[#0B0F19]">
                <div className="container mx-auto px-6 text-center">
                    <h2 className="text-2xl font-bold mb-12">Upcoming Events</h2>
                    <div className="max-w-4xl mx-auto bg-white dark:bg-[#030712] rounded-3xl border border-slate-200 dark:border-white/5 p-8">
                        <div className="flex items-center gap-6 text-left">
                            <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex flex-col items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                                <span className="text-xs uppercase">Feb</span>
                                <span className="text-2xl">14</span>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold mb-1">Chttrix Conf 2026</h3>
                                <p className="text-slate-500 dark:text-slate-400">San Francisco & Online • 10:00 AM PST</p>
                            </div>
                            <div className="ml-auto">
                                <button className="px-4 py-2 border border-slate-200 dark:border-white/10 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 font-bold text-sm">RSVP</button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            <footer className="py-12 border-t border-slate-200 dark:border-white/5 text-center text-slate-500 dark:text-slate-400">
                <p>© 2026 Chttrix Inc.</p>
            </footer>
        </div>
    );
};

export default Community;
