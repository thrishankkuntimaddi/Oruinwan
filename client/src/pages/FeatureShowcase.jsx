import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import {
    MessageSquare,
    Zap,
    CheckSquare,
    Globe,
    Shield,
    Sparkles,
    ArrowRight,
    Play,
    Sun,
    Moon,
    Laptop,
    Briefcase,
    Building2,
    CheckCircle2
} from "lucide-react";

// Video Assets
const VIDEO_HERO_LOGO = "/hover-animation.mp4";
const VIDEO_AI = "/ChttrixAI-animation.mp4";

const FeatureShowcase = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [scrolled, setScrolled] = useState(false);

    // Refs for video control
    const heroVideoRef = useRef(null);

    useEffect(() => {
        if (user) {
            navigate("/workspaces");
        }
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, [user, navigate]);

    // Force autoplay on mount for reliability
    useEffect(() => {
        const video = heroVideoRef.current;
        if (video) {
            // Muted allows autoplay in most policies
            video.muted = true;
            video.play().catch(error => {
                console.log("Autoplay prevented:", error);
            });
        }
    }, []);

    if (user) return null;

    return (
        <div className="min-h-screen w-full bg-white dark:bg-[#030712] text-slate-900 dark:text-white transition-colors duration-500">

            <style>{`
                @keyframes float-slow {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-20px); }
                }
                .animate-float-slow {
                    animation: float-slow 8s ease-in-out infinite;
                }
                .glass-card {
                    background: rgba(255, 255, 255, 0.7);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(0, 0, 0, 0.05);
                }
                .dark .glass-card {
                    background: rgba(17, 24, 39, 0.4);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }
                .text-glow {
                     text-shadow: 0 0 30px rgba(99, 102, 241, 0.3);
                }
                 .hero-gradient {
                    background: radial-gradient(circle at top right, rgba(99, 102, 241, 0.1) 0%, rgba(255, 255, 255, 0) 60%);
                }
                .dark .hero-gradient {
                    background: radial-gradient(circle at top right, rgba(99, 102, 241, 0.15) 0%, rgba(3, 7, 18, 0) 60%);
                }
            `}</style>

            {/* Navbar */}
            <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? "bg-white/80 dark:bg-[#030712]/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 shadow-sm" : "bg-transparent border-transparent"}`}>
                <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
                    <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate("/")}>
                        <img src="/chttrix-logo.jpg" alt="Logo" className="w-10 h-10 rounded-xl shadow-md group-hover:scale-110 transition-transform" />
                        <span className="font-exul font-black text-2xl tracking-tighter text-slate-900 dark:text-white">Chttrix</span>
                    </div>

                    <div className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-500 dark:text-slate-400">
                        <a href="#platform" className="hover:text-indigo-600 dark:hover:text-white transition-colors">Platform</a>
                        <a href="#ai" className="hover:text-indigo-600 dark:hover:text-white transition-colors">AI Intelligence</a>
                        <a href="#accounts" className="hover:text-indigo-600 dark:hover:text-white transition-colors">Solutions</a>
                        <button onClick={() => navigate("/chttrix-docs")} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Documentation</button>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 transition-colors"
                            aria-label="Toggle Theme"
                        >
                            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                        </button>
                        <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-2"></div>
                        <button onClick={() => navigate("/login")} className="text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-white transition-colors">Log in</button>
                        <button
                            onClick={() => document.getElementById("accounts").scrollIntoView({ behavior: 'smooth' })}
                            className="bg-slate-900 dark:bg-indigo-600 text-white px-6 py-2.5 rounded-full text-sm font-bold hover:bg-slate-800 dark:hover:bg-indigo-500 transition-all hover:-translate-y-0.5 hover:shadow-lg dark:hover:shadow-[0_0_20px_rgba(99,102,241,0.5)]"
                        >
                            Get Started
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section - Split Layout */}
            <header className="relative pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden hero-gradient">
                <div className="container mx-auto px-6 relative z-10">
                    <div className="flex flex-col-reverse lg:flex-row items-center gap-12 lg:gap-20">

                        {/* Text Content (Left) */}
                        <div className="flex-1 text-center lg:text-left">
                            <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-slate-900 dark:text-white mb-6 leading-[0.9] dark:text-glow">
                                One Platform.<br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:via-purple-400 dark:to-indigo-400 animate-text-shimmer">Limitless Possibilities.</span>
                            </h1>

                            <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-400 mb-10 leading-relaxed font-medium">
                                The operating system for the future of work. <br className="hidden md:block" />
                                Seamlessly combining <span className="font-bold text-slate-900 dark:text-white">Channels, Huddles, Tasks, Notes, Updates</span> and <span className="font-bold text-purple-600 dark:text-purple-400">ChttrixAI</span>.
                            </p>

                            <div className="flex flex-col sm:flex-row items-center lg:justify-start justify-center gap-4 mb-12">
                                <button
                                    onClick={() => document.getElementById("accounts").scrollIntoView({ behavior: 'smooth' })}
                                    className="w-full sm:w-auto px-8 py-4 bg-indigo-600 dark:bg-white text-white dark:text-black text-lg font-bold rounded-2xl hover:bg-indigo-700 dark:hover:bg-indigo-50 transition-all hover:scale-105 hover:shadow-xl dark:hover:shadow-[0_0_40px_rgba(255,255,255,0.3)] flex items-center justify-center gap-3"
                                >
                                    Start Building HQ <ArrowRight size={20} />
                                </button>
                                <div className="flex items-center gap-2 text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-4">
                                    <span className="relative flex h-2 w-2 mr-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                    </span>
                                    Waitlist Open
                                </div>
                            </div>
                        </div>

                        {/* Interactive Video (Right) */}
                        <div className="flex-1 w-full max-w-lg lg:max-w-xl">
                            <div
                                className="relative aspect-square rounded-[3rem] overflow-hidden shadow-2xl shadow-indigo-500/10 dark:shadow-indigo-500/20 border border-slate-200 dark:border-white/10 group cursor-default bg-slate-100 dark:bg-white/5"
                            >
                                {/* Static / Placeholder State */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 transition-opacity duration-300 z-10">
                                    <div className="w-20 h-20 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-indigo-500 dark:text-white">
                                        <Play fill="currentColor" size={32} className="ml-1" />
                                    </div>
                                </div>

                                <video
                                    ref={heroVideoRef}
                                    src={VIDEO_HERO_LOGO}
                                    autoPlay
                                    muted
                                    playsInline
                                    loop
                                    className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                                />
                            </div>
                        </div>

                    </div>
                </div>
            </header>

            {/* Powerful Features Grid */}
            <section id="platform" className="scroll-mt-24 py-32 bg-slate-50 dark:bg-[#030712] relative border-y border-slate-200 dark:border-white/5">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-24">
                        <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-6">Simplicity meets <span className="text-indigo-600 dark:text-indigo-500">Power</span>.</h2>
                        <p className="text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">Everything you need to run your company, in one tab.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[
                            {
                                icon: <MessageSquare size={32} className="text-blue-500 dark:text-blue-400" />,
                                title: "Channels",
                                desc: "Structured, threaded conversations for every project and topic. Keep the noise down and the focus up."
                            },
                            {
                                icon: <Zap size={32} className="text-yellow-500 dark:text-yellow-400" />,
                                title: "Video Huddles",
                                desc: "Jump into a voice or video call instantly. Screen share and collaborate without scheduling a meeting."
                            },
                            {
                                icon: <CheckSquare size={32} className="text-green-500 dark:text-green-400" />,
                                title: "Tasks",
                                desc: "Native project management. Assign to-dos, set due dates, and track progress via Kanban boards."
                            },
                            {
                                icon: <Globe size={32} className="text-orange-500 dark:text-orange-400" />,
                                title: "Notes",
                                desc: "Collaborative documents that live right alongside your chat. Write specs, meeting notes, and wikis."
                            },
                            {
                                icon: <Shield size={32} className="text-pink-500 dark:text-pink-400" />,
                                title: "Updates",
                                desc: "Async status reports for companies. Share weekly goals and blockers without the meetings."
                            },
                            {
                                icon: <Sparkles size={32} className="text-purple-500 dark:text-purple-400" />,
                                title: "ChttrixAI",
                                desc: "The intelligence layer that connects it all. Summarize chats, generate tasks, and find answers."
                            }
                        ].map((item, i) => (
                            <div key={i} className="glass-card p-8 rounded-2xl hover:bg-white hover:shadow-xl dark:hover:bg-white/5 transition-all duration-300 group hover:-translate-y-2 cursor-default">
                                <div className="mb-6 p-4 bg-slate-100 dark:bg-white/5 rounded-2xl inline-block group-hover:scale-110 transition-transform">
                                    {item.icon}
                                </div>
                                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">{item.title}</h3>
                                <p className="text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* AI Integration - Video Showcase */}
            {/* AI Integration - Video Showcase */}
            <section id="ai" className="scroll-mt-24 py-32 bg-white dark:bg-[#0B0F19] relative overflow-hidden">
                <div className="container mx-auto px-6 relative z-10">
                    <div className="flex flex-col lg:flex-row items-center gap-20">
                        {/* Video Left */}
                        <div className="flex-1 w-full">
                            <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-purple-900/20 border border-slate-200 dark:border-white/10 group">
                                {/* Video Background Glow */}
                                <div className="absolute inset-0 bg-purple-500/10 blur-[50px] group-hover:bg-purple-500/20 transition-colors"></div>

                                <video
                                    src={VIDEO_AI}
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                    className="relative w-full h-auto rounded-3xl transform group-hover:scale-[1.02] transition-transform duration-700"
                                />


                            </div>
                        </div>

                        {/* Text Right */}
                        <div className="flex-1">
                            <div className="inline-block px-4 py-2 bg-purple-100 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 rounded-lg text-purple-600 dark:text-purple-400 font-bold mb-8">
                                Chttrix Intelligence ™
                            </div>
                            <h2 className="text-5xl font-black text-slate-900 dark:text-white mb-8 leading-tight">
                                Your teammate that <br />
                                <span className="text-purple-600 dark:text-purple-400">never sleeps.</span>
                            </h2>
                            <p className="text-xl text-slate-500 dark:text-slate-400 mb-10 leading-relaxed">
                                Chttrix AI doesn't just chat. It understands your entire workspace context. It writes code, summarizes threads, and automates your busy work.
                                <br /><br />
                                <span className="text-base font-bold text-slate-700 dark:text-slate-300">
                                    Mention @ChttrixAI in any channel, DM, or thread to summon help.
                                </span>
                            </p>

                            <button className="flex items-center gap-3 text-lg font-bold text-purple-600 dark:text-purple-400 hover:gap-4 transition-all">
                                See capabilities <ArrowRight size={20} />
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Account Types / Solutions */}
            <section id="accounts" className="scroll-mt-24 py-32 bg-slate-50 dark:bg-[#030712] border-t border-slate-200 dark:border-white/5">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-black text-slate-900 dark:text-white mb-4">Choose your HQ.</h2>
                        <p className="text-lg text-slate-500 dark:text-slate-400">Tailored experiences for individuals and ambitious companies.</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                        {/* Personal Account */}
                        <div className="bg-white dark:bg-[#0B0F19] p-10 rounded-3xl border border-slate-200 dark:border-white/5 hover:border-indigo-500 dark:hover:border-indigo-500 transition-colors shadow-sm hover:shadow-xl group relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                                <Laptop size={120} />
                            </div>
                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-8">
                                <Briefcase size={24} />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Personal Workspace</h3>
                            <p className="text-slate-500 dark:text-slate-400 mb-8 h-12">
                                Perfect for freelancers, students, and side-projects.
                            </p>
                            <ul className="space-y-4 mb-8">
                                <li className="flex items-center gap-3 text-slate-700 dark:text-slate-300 font-medium">
                                    <CheckCircle2 size={18} className="text-blue-500" /> Unlimited Personal Projects
                                </li>
                                <li className="flex items-center gap-3 text-slate-700 dark:text-slate-300 font-medium">
                                    <CheckCircle2 size={18} className="text-blue-500" /> Basic AI Assistance
                                </li>
                                <li className="flex items-center gap-3 text-slate-700 dark:text-slate-300 font-medium">
                                    <CheckCircle2 size={18} className="text-blue-500" /> Free Forever
                                </li>
                            </ul>
                            <button onClick={() => navigate("/login?mode=signup")} className="w-full py-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 text-slate-900 dark:text-white font-bold transition-all">
                                Create Personal Account
                            </button>
                        </div>

                        {/* Company Account */}
                        <div className="bg-indigo-50 dark:bg-[#0F1623] p-10 rounded-3xl border border-indigo-100 dark:border-white/10 hover:border-indigo-500 transition-colors shadow-2xl group relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-5 dark:opacity-10 group-hover:opacity-10 dark:group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
                                <Building2 size={120} className="text-indigo-900 dark:text-white" />
                            </div>
                            <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-indigo-500/30">
                                <Building2 size={24} />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Company HQ</h3>
                            <p className="text-slate-500 dark:text-slate-400 mb-8 h-12">
                                For teams that want to ship faster. Includes Admin controls.
                            </p>
                            <ul className="space-y-4 mb-8">
                                <li className="flex items-center gap-3 text-slate-700 dark:text-white font-medium">
                                    <CheckCircle2 size={18} className="text-indigo-500 dark:text-indigo-400" /> Team Updates & Goals
                                </li>
                                <li className="flex items-center gap-3 text-slate-700 dark:text-white font-medium">
                                    <CheckCircle2 size={18} className="text-indigo-500 dark:text-indigo-400" /> Unlimited History & AI
                                </li>
                                <li className="flex items-center gap-3 text-slate-700 dark:text-white font-medium">
                                    <CheckCircle2 size={18} className="text-indigo-500 dark:text-indigo-400" /> Admin Dashboard (Build HQ)
                                </li>
                            </ul>
                            <button onClick={() => navigate("/register-company")} className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-lg shadow-indigo-500/25">
                                Register Company HQ
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-white dark:bg-[#02050b] border-t border-slate-200 dark:border-white/5 py-12 text-slate-500 text-sm transition-colors">
                <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center">
                    <p>© 2025 Chttrix Inc. Not yet launched.</p>
                    <div className="flex gap-6 mt-4 md:mt-0">
                        <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">Contact</a>
                        <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">Twitter</a>
                        <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">Events</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default FeatureShowcase;
