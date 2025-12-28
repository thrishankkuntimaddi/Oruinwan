
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import {
    MessageSquare,
    Users,
    CheckSquare,
    Bell,
    FileText,
    Bot,
    ArrowRight,
    Brain,
    Sparkles,
    Zap,
    GitMerge
} from "lucide-react";

const FeatureShowcase = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showToast } = useToast();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        setIsVisible(true);
        if (user) {
            navigate("/workspaces");
        }
    }, [user, navigate]);

    if (user) return null;

    const products = [
        {
            id: 'ai',
            name: 'Chttrix.ai',
            icon: <Bot size={32} />,
            desc: 'Context-aware AI to generate code, summarize chats, and automate workflows.',
            color: 'text-purple-600',
            bg: 'bg-purple-50',
            border: 'border-purple-100',
            gradient: 'from-purple-500 to-indigo-600'
        },
        {
            id: 'note',
            name: 'ChttrixNote',
            icon: <FileText size={32} />,
            desc: 'Real-time multi-player docs for specs, wikis, and meeting notes.',
            color: 'text-blue-600',
            bg: 'bg-blue-50',
            border: 'border-blue-100',
            gradient: 'from-blue-500 to-cyan-500'
        },
        {
            id: 'task',
            name: 'ChttrixTask',
            icon: <CheckSquare size={32} />,
            desc: 'Track sprints, manage bugs, and visualize progress on Kanban boards.',
            color: 'text-green-600',
            bg: 'bg-green-50',
            border: 'border-green-100',
            gradient: 'from-emerald-500 to-green-600'
        },
        {
            id: 'mind',
            name: 'MindFlush',
            icon: <Brain size={32} />,
            desc: 'Infinite whiteboards for diagramming, wireframing, and brainstorming.',
            color: 'text-orange-600',
            bg: 'bg-orange-50',
            border: 'border-orange-100',
            gradient: 'from-orange-500 to-amber-500'
        }
    ];

    const features = [
        {
            icon: <MessageSquare size={24} />,
            label: "Channels",
            desc: "Dedicated spaces that keep projects and teams organized.",
            color: "text-blue-600",
            bg: "bg-blue-50"
        },
        {
            icon: <GitMerge size={24} />,
            label: "Directions",
            desc: "Threaded discussions to maintain focus and context.",
            color: "text-indigo-600",
            bg: "bg-indigo-50"
        },
        {
            icon: <Users size={24} />,
            label: "Direct Messages",
            desc: "Private, encrypted 1:1 communication for instant collaboration.",
            color: "text-purple-600",
            bg: "bg-purple-50"
        },
        {
            icon: <CheckSquare size={24} />,
            label: "Tasks",
            desc: "Seamlessly manage personal, incoming, and delegated to-dos.",
            color: "text-green-600",
            bg: "bg-green-50"
        },
        {
            icon: <FileText size={24} />,
            label: "Notes",
            desc: "A unified space for ideas, documentation, and real-time editing.",
            color: "text-orange-600",
            bg: "bg-orange-50"
        },
        {
            icon: <Bell size={24} />,
            label: "Updates",
            desc: "Broadcast announcements and track team pulses in one place.",
            color: "text-pink-600",
            bg: "bg-pink-50"
        },
        {
            icon: <Bot size={24} />,
            label: "Chttrix AI",
            desc: "An embedded assistant that connects dots across chats, docs, and tasks.",
            color: "text-violet-600 dark:text-violet-400",
            bg: "bg-violet-50 dark:bg-violet-900/20"
        }
    ];

    return (
        <div className={`h-screen w-full bg-white overflow-y-auto overflow-x-hidden transition-opacity duration-700 ${isVisible ? "opacity-100" : "opacity-0"}`}>

            {/* Custom Animations */}
            <style>{`
                @keyframes float {
                    0%, 100% { transform: translate(0, 0); }
                    50% { transform: translate(0, -20px); }
                }
                @keyframes float-delayed {
                    0%, 100% { transform: translate(0, 0); }
                    50% { transform: translate(0, 20px); }
                }
                .animate-float { animation: float 10s ease-in-out infinite; }
                .animate-float-delayed { animation: float-delayed 12s ease-in-out infinite; }
                
                @keyframes text-shimmer {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                .animate-text-shimmer {
                    background-size: 200% auto;
                    animation: text-shimmer 5s ease infinite;
                }
            `}</style>

            {/* Navbar */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 transition-all duration-300">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    {/* Logo */}
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
                        <img src="/assets/ChttrixLogo.svg" alt="Chttrix Logo" className="w-8 h-8 rounded-lg object-cover shadow-sm hover:rotate-3 transition-transform duration-300" />
                        <span className="text-xl font-black text-gray-900 tracking-tight">Chttrix</span>
                    </div>

                    {/* Auth Buttons */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate("/register-company")}
                            className="group flex items-center gap-2 px-5 py-2 bg-white hover:bg-gray-50 text-gray-900 text-sm font-semibold rounded-full border border-gray-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:scale-95"
                        >
                            <span>Register Company</span>
                        </button>
                        <button
                            onClick={() => navigate("/login")}
                            className="group flex items-center gap-2 px-5 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold rounded-full transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:scale-95"
                        >
                            <span>Sign in</span>
                            <ArrowRight size={14} className="text-gray-300 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>
            </nav>

            {/* Background Elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
                <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full bg-gradient-to-br from-blue-100/40 via-purple-50/40 to-transparent blur-[120px] animate-float"></div>
                <div className="absolute top-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-bl from-indigo-100/40 via-pink-50/40 to-transparent blur-[120px] animate-float-delayed"></div>
            </div>

            <div className="relative pt-32 pb-6 px-6 flex flex-col items-center w-full max-w-7xl mx-auto">

                {/* Hero Section */}
                <div className={`transform transition-all duration-1000 delay-100 flex flex-col items-center text-center max-w-4xl mx-auto mb-24 ${isVisible ? "scale-100 translate-y-0 opacity-100" : "scale-95 translate-y-10 opacity-0"}`}>
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-8 border border-indigo-100 shadow-sm hover:shadow-md hover:scale-105 transition-all duration-300 cursor-default">
                        <Sparkles size={14} className="animate-pulse" />
                        <span>Collaboration Redefined</span>
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black text-gray-900 tracking-tight leading-[1.1] mb-8 drop-shadow-sm">
                        One Platform.<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 animate-text-shimmer">Limitless Possibilities.</span>
                    </h1>
                    <p className="text-xl text-gray-600 font-medium tracking-wide max-w-2xl mx-auto mb-10 leading-relaxed">
                        Seamlessly integrated apps for notes, tasks, brainstorming, and AI-driven workflows. Everything you need, all in one place.
                    </p>
                    <button
                        onClick={() => navigate("/login")}
                        className="group relative px-9 py-4 bg-gray-900 text-white text-base font-bold rounded-2xl shadow-xl hover:shadow-2xl hover:shadow-purple-500/20 hover:-translate-y-1 hover:scale-105 transition-all duration-300 overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[length:200%_auto] animate-text-shimmer"></div>
                        <span className="relative flex items-center gap-2">
                            Get Started for Free <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </span>
                    </button>
                </div>

                <div className="w-full mb-16">
                    <div className="text-center mb-16">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white text-gray-800 text-xs font-bold uppercase tracking-wider mb-6 border border-gray-200 shadow-sm">
                            <Zap size={12} className="text-yellow-500" />
                            <span>Core Foundation</span>
                        </div>
                        <h2 className="text-4xl font-bold text-gray-900 mb-4 tracking-tight">Everything you need to run your team.</h2>
                        <p className="text-lg text-gray-500 max-w-2xl mx-auto">Built on a robust communication layer that keeps everyone in sync.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                        {features.map((feature, index) => {
                            const isAI = feature.label === "Chttrix AI";
                            return (
                                <div
                                    key={index}
                                    className={`transform transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-20"} ${isAI ? "md:col-span-2 lg:col-span-1 lg:col-start-2 md:w-3/4 lg:w-full md:justify-self-center" : ""}`}
                                    style={{ transitionDelay: `${400 + (index * 100)}ms` }}
                                >
                                    <div className={`group relative rounded-3xl p-8 shadow-sm transition-all duration-500 h-48 overflow-hidden cursor-default ${isAI
                                        ? "bg-gradient-to-br from-white to-violet-50/80 border border-violet-200 hover:shadow-2xl hover:shadow-violet-500/10 hover:border-violet-300"
                                        : "bg-white/60 backdrop-blur-md border border-gray-200 hover:shadow-xl hover:border-indigo-100 hover:bg-white"
                                        }`}>

                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-500 group-hover:left-8 group-hover:translate-x-0 group-hover:items-start group-hover:max-w-[40%]">
                                            <div className={`w-16 h-16 rounded-2xl ${feature.bg} ${feature.color} flex items-center justify-center mb-4 shadow-sm transition-all duration-500 group-hover:scale-75 group-hover:origin-top-left group-hover:mb-2`}>
                                                {feature.icon}
                                            </div>
                                            <h3 className="text-xl font-bold text-gray-800 whitespace-nowrap transition-all duration-500 group-hover:text-base group-hover:whitespace-normal group-hover:leading-tight">{feature.label}</h3>
                                        </div>

                                        {/* Description (Visible on Hover - Right Side) */}
                                        <div className="absolute top-1/2 right-8 -translate-y-1/2 w-[50%] opacity-0 translate-x-10 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500 delay-75">
                                            <p className="text-sm text-gray-600 leading-relaxed font-medium text-left">
                                                {feature.desc}
                                            </p>
                                        </div>

                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* The Chttrix Suite */}
                <div className="w-full mb-24">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-gray-900 mb-4 tracking-tight">The Chttrix Suite</h2>
                        <p className="text-lg text-gray-500 max-w-2xl mx-auto">Powerful standalone apps that work even better together.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {products.map((product, index) => (
                            <div
                                key={product.id}
                                onClick={() => showToast("Coming Soon", "info")}
                                className={`group relative bg-white/80 backdrop-blur-sm rounded-[2rem] p-8 border border-gray-100 shadow-sm hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-2 transition-all duration-500 overflow-hidden cursor-pointer ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
                                style={{ transitionDelay: `${200 + (index * 100)}ms` }}
                            >
                                {/* Hover Gradient Border Effect */}
                                <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br ${product.gradient} opacity-[0.03]`}></div>
                                <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${product.gradient} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500`}></div>

                                <div className="relative z-10 flex flex-col h-full items-start">
                                    <div className={`w-16 h-16 rounded-2xl ${product.bg} ${product.color} flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 group-hover:rotate-6 transition-all duration-500`}>
                                        {product.icon}
                                    </div>

                                    <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-indigo-600 transition-colors">{product.name}</h3>
                                    <p className="text-sm text-gray-500 font-medium leading-relaxed mb-6 flex-grow">
                                        {product.desc}
                                    </p>

                                    <div className="flex items-center text-xs font-bold text-gray-400 group-hover:text-indigo-600 transition-colors uppercase tracking-wider mt-auto">
                                        <span>Launch App</span>
                                        <ArrowRight size={12} className="ml-2 transform group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="w-full mt-4 border-t border-gray-100 py-6 text-center">
                    <div className="flex items-center justify-center gap-2">
                        <img src="/assets/ChttrixLogo.svg" alt="Logo" className="w-5 h-5 grayscale opacity-70 hover:opacity-100 transition-opacity" />
                        <span className="text-sm font-bold text-gray-800">Chttrix</span>
                        <span className="text-gray-300">|</span>
                        <p className="text-gray-500 text-xs">© 2025 Chttrix Inc. All rights reserved.</p>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default FeatureShowcase;
