import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Target, Heart } from 'lucide-react';

const About = () => {
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
                    We're building the <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">operating system for work</span>.
                </h1>
                <p className="text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
                    Chttrix was founded on a simple belief: collaboration should be seamless, instant, and intelligent.
                </p>
            </header>

            <section className="py-20 bg-slate-50 dark:bg-[#0B0F19]">
                <div className="container mx-auto px-6 grid md:grid-cols-3 gap-12 max-w-6xl">
                    <div className="p-8 bg-white dark:bg-[#030712] rounded-3xl border border-slate-200 dark:border-white/5">
                        <Target className="w-12 h-12 text-blue-500 mb-6" />
                        <h3 className="text-xl font-bold mb-4">Our Mission</h3>
                        <p className="text-slate-500 dark:text-slate-400">To remove friction from human collaboration and empower teams to do their best work.</p>
                    </div>
                    <div className="p-8 bg-white dark:bg-[#030712] rounded-3xl border border-slate-200 dark:border-white/5">
                        <Users className="w-12 h-12 text-indigo-500 mb-6" />
                        <h3 className="text-xl font-bold mb-4">Our Team</h3>
                        <p className="text-slate-500 dark:text-slate-400">A diverse group of engineers, designers, and thinkers distributed across the globe.</p>
                    </div>
                    <div className="p-8 bg-white dark:bg-[#030712] rounded-3xl border border-slate-200 dark:border-white/5">
                        <Heart className="w-12 h-12 text-pink-500 mb-6" />
                        <h3 className="text-xl font-bold mb-4">Our Values</h3>
                        <p className="text-slate-500 dark:text-slate-400">We value clarity, speed, and empathy. We build for the user, always.</p>
                    </div>
                </div>
            </section>

            <footer className="py-12 border-t border-slate-200 dark:border-white/5 text-center text-slate-500 dark:text-slate-400">
                <p>© 2026 Chttrix Inc.</p>
            </footer>
        </div>
    );
};

export default About;
