import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
    MessageSquare,
    Users,
    CheckSquare,
    Layout,
    Bell,
    FileText,
    Bot,
    ArrowRight
} from "lucide-react";

const FeatureShowcase = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        setIsVisible(true);
        // If user is already logged in, we could redirect, but user asked for landing page 
        // to be visible with a "Go to Workspace" option or similar if authenticated.
        // However, the specific request was: "if you are authenticated, then we need to redirect page the workspace"
        if (user) {
            navigate("/workspaces");
        }
    }, [user, navigate]);

    // If we are redirecting, we might render nothing or a loader, 
    // but to prevent flash if the redirect is fast, we can just render the page 
    // (the useEffect will trigger quickly). 
    // If we want to strictly prevent showing it, we can return null if user exists.
    if (user) return null;

    const features = [
        {
            icon: <Layout size={24} />,
            label: "Workspaces",
            desc: "Central hubs for teams and projects.",
            color: "text-blue-600",
            bg: "bg-blue-50"
        },
        {
            icon: <MessageSquare size={24} />,
            label: "Channels",
            desc: "Organized group discussions.",
            color: "text-indigo-600",
            bg: "bg-indigo-50"
        },
        {
            icon: <Users size={24} />,
            label: "Direct Messages",
            desc: "Private, encrypted 1:1 chats.",
            color: "text-purple-600",
            bg: "bg-purple-50"
        },
        {
            icon: <CheckSquare size={24} />,
            label: "Smart Tasks",
            desc: "Track and manage to-dos effortlessly.",
            color: "text-green-600",
            bg: "bg-green-50"
        },
        {
            icon: <FileText size={24} />,
            label: "Notes",
            desc: "Capture ideas and draft content.",
            color: "text-orange-600",
            bg: "bg-orange-50"
        },
        {
            icon: <Bell size={24} />,
            label: "Updates",
            desc: "Share wins and stay in the loop.",
            color: "text-pink-600",
            bg: "bg-pink-50"
        },
    ];

    return (
        <div className={`h-screen w-full bg-white overflow-y-auto overflow-x-hidden transition-opacity duration-500 ${isVisible ? "opacity-100" : "opacity-0"}`}>

            {/* Navbar */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
                    {/* Logo */}
                    <div className="flex items-center gap-2">
                        <img src="/assets/ChttrixLogo.svg" alt="Chttrix Logo" className="w-8 h-8 rounded-lg object-cover" />
                        <span className="text-xl font-black text-gray-900 tracking-tight">Chttrix</span>
                    </div>

                    {/* Auth Buttons */}
                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => navigate("/login")}
                            className="flex items-center gap-2 px-4 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-semibold rounded-full border border-gray-200 transition-all hover:shadow-sm"
                        >
                            <span>Sign in</span>
                            <ArrowRight size={14} className="opacity-50" />
                        </button>
                    </div>
                </div>
            </nav>

            {/* Background Elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
                <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-100/40 blur-[100px] animate-pulse"></div>
                <div className="absolute top-[40%] -right-[10%] w-[40%] h-[40%] rounded-full bg-purple-100/40 blur-[100px] animate-pulse delay-1000"></div>
                <div className="absolute -bottom-[10%] left-[20%] w-[30%] h-[30%] rounded-full bg-pink-100/40 blur-[100px] animate-pulse delay-2000"></div>
            </div>

            <div className="relative pt-24 pb-0 px-6 flex flex-col items-center w-full">

                {/* Hero Section */}
                <div className={`transform transition-all duration-1000 delay-100 flex-shrink-0 mb-16 text-center max-w-4xl mx-auto ${isVisible ? "scale-100 translate-y-0 opacity-100" : "scale-95 translate-y-10 opacity-0"}`}>
                    <h1 className="text-5xl md:text-7xl font-black text-gray-900 tracking-tight leading-tight mb-6">
                        Where <span className="text-purple-700">work</span> happens
                    </h1>
                    <p className="text-xl text-gray-600 font-medium tracking-wide max-w-2xl mx-auto mb-8">
                        Share it. Discuss it. Get it done. Side by side with Chttrix AI.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button
                            onClick={() => navigate("/login")}
                            className="group relative px-8 py-4 bg-white text-blue-600 text-sm font-bold rounded-xl border border-blue-100 shadow-lg hover:shadow-blue-200/50 hover:-translate-y-0.5 transition-all uppercase tracking-wide w-full sm:w-auto overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-purple-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            <span className="relative flex items-center gap-2">
                                Find Your Workspace <ArrowRight size={16} />
                            </span>
                        </button>
                    </div>
                </div>

                {/* Features Grid (Restored Animation) */}
                <div id="features-section" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl w-full px-4 mb-12">
                    {features.map((feature, index) => (
                        <div
                            key={index}
                            className={`transform transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-20"}`}
                            style={{ transitionDelay: `${200 + (index * 100)}ms` }}
                        >
                            <div className="group relative bg-white/60 backdrop-blur-md border border-gray-200/60 rounded-2xl p-6 shadow-sm hover:shadow-xl hover:bg-white transition-all duration-300 h-40 overflow-hidden cursor-default">

                                {/* Icon & Label */}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-500 group-hover:left-6 group-hover:translate-x-0 group-hover:max-w-[40%]">
                                    <div className={`w-14 h-14 rounded-2xl ${feature.bg} ${feature.color} flex items-center justify-center mb-3 shadow-sm transition-transform duration-300 group-hover:scale-90 origin-top-left`}>
                                        {feature.icon}
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-800 whitespace-nowrap transition-all duration-300 group-hover:text-sm group-hover:whitespace-normal group-hover:leading-tight">{feature.label}</h3>
                                </div>

                                {/* Description (Visible on Hover - Right Side) */}
                                <div className="absolute top-1/2 right-6 -translate-y-1/2 w-[50%] opacity-0 translate-x-10 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500 delay-100">
                                    <p className="text-xs text-gray-600 leading-relaxed font-medium text-left">
                                        {feature.desc}
                                    </p>
                                </div>

                            </div>
                        </div>
                    ))}
                </div>

                {/* AI Section (Restored Animation) */}
                <div
                    className={`transform transition-all duration-1000 delay-300 w-full max-w-4xl px-4 mb-12 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-20"}`}
                >
                    <div className="group relative bg-white/60 backdrop-blur-md border border-gray-200/60 rounded-2xl p-6 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all duration-500 h-32 hover:h-40 overflow-hidden cursor-default">

                        {/* Subtle Gradient Background */}
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-50/50 via-purple-50/50 to-pink-50/50 opacity-0 group-hover:opacity-100 transition duration-500"></div>

                        <div className="relative h-full w-full">
                            {/* Header: Icon + Title */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-5 transition-all duration-500 group-hover:left-8 group-hover:translate-x-0">
                                <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl flex items-center justify-center shadow-lg text-white flex-shrink-0 group-hover:scale-90 transition-transform duration-500">
                                    <Bot size={32} />
                                </div>
                                <h3 className="text-2xl font-black text-gray-900 tracking-tight whitespace-nowrap">Chttrix AI</h3>
                            </div>

                            {/* Description (Revealed on Hover - Right Side) */}
                            <div className="absolute top-1/2 right-8 -translate-y-1/2 w-[55%] opacity-0 translate-x-10 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500 delay-75 flex items-center">
                                <p className="text-sm text-gray-700 leading-relaxed font-medium text-left">
                                    Complete control with total privacy. Mention <span className="font-bold text-indigo-600">@Chttrix</span> to encrypt chats, automate tasks, and get intelligent insights instantly.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="w-full border-t border-gray-200 py-3 text-center">
                    <p className="text-gray-400 text-xs">© 2025 Chttrix Inc. All rights reserved.</p>
                </div>

            </div>
        </div>
    );
};

export default FeatureShowcase;
