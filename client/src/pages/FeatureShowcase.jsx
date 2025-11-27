import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    MessageSquare,
    Users,
    CheckSquare,
    Layout,
    Bell,
    FileText,
    Bot
} from "lucide-react";

const FeatureShowcase = () => {
    const navigate = useNavigate();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        setIsVisible(true);
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(() => {
            navigate("/workspaces");
        }, 500); // Wait for exit animation
    };

    const features = [
        {
            icon: <Layout size={28} />,
            label: "Workspaces",
            desc: "Your central hub. Organize teams, projects, and people in dedicated, focused spaces.",
            color: "text-blue-600",
            bg: "bg-blue-50"
        },
        {
            icon: <MessageSquare size={28} />,
            label: "Channels",
            desc: "Group chats with direction. Collaborate with purpose, set topics, and keep discussions on track.",
            color: "text-indigo-600",
            bg: "bg-indigo-50"
        },
        {
            icon: <Users size={28} />,
            label: "Direct Messages",
            desc: "Secure, encrypted 1:1 messaging. Connect privately with anyone in your team.",
            color: "text-purple-600",
            bg: "bg-purple-50"
        },
        {
            icon: <CheckSquare size={28} />,
            label: "Smart Tasks",
            desc: "Manage personal, incoming, and dedicated tasks. Track completion and stay organized.",
            color: "text-green-600",
            bg: "bg-green-50"
        },
        {
            icon: <FileText size={28} />,
            label: "Notes",
            desc: "AI-powered drafting. Capture ideas during discussions and instantly convert them into shareable tasks.",
            color: "text-orange-600",
            bg: "bg-orange-50"
        },
        {
            icon: <Bell size={28} />,
            label: "Updates",
            desc: "Share achievements. Discuss updates directly in chat to foster conversation and encouragement.",
            color: "text-pink-600",
            bg: "bg-pink-50"
        },
    ];

    return (
        <div
            onClick={handleClose}
            className={`fixed inset-0 z-[9999] bg-white cursor-pointer overflow-hidden transition-opacity duration-500 ${isVisible ? "opacity-100" : "opacity-0"}`}
        >
            {/* Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-100/40 blur-[100px] animate-pulse"></div>
                <div className="absolute top-[40%] -right-[10%] w-[40%] h-[40%] rounded-full bg-purple-100/40 blur-[100px] animate-pulse delay-1000"></div>
                <div className="absolute -bottom-[10%] left-[20%] w-[30%] h-[30%] rounded-full bg-pink-100/40 blur-[100px] animate-pulse delay-2000"></div>
            </div>

            <div className="relative h-full w-full flex flex-col items-center justify-center p-6 md:p-12">

                {/* Central Logo Header */}
                <div className={`transform transition-all duration-1000 delay-100 flex-shrink-0 mb-8 ${isVisible ? "scale-100 translate-y-0 opacity-100" : "scale-50 translate-y-10 opacity-0"}`}>
                    <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
                        {/* Logo */}
                        <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl shadow-xl flex items-center justify-center overflow-hidden bg-white border border-gray-100 flex-shrink-0 hover:scale-105 transition-transform duration-500">
                            <img src="/assets/Logoat.jpg" alt="Chttrix Logo" className="w-full h-full object-cover" />
                        </div>

                        {/* Text */}
                        <div className="flex flex-col items-center md:items-start text-center md:text-left">
                            <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-purple-700 to-pink-700 tracking-tight leading-tight">
                                Chttrix
                            </h1>
                            <p className="text-xs md:text-base text-gray-500 font-medium tracking-wide">AI-Augmented Collaboration Platform</p>
                        </div>
                    </div>
                </div>
                {/* Features Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl w-full flex-shrink-0 px-4">
                    {features.map((feature, index) => (
                        <div
                            key={index}
                            className={`transform transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-20"}`}
                            style={{ transitionDelay: `${200 + (index * 100)}ms` }}
                        >
                            <div className="group relative bg-white/60 backdrop-blur-md border border-gray-200/60 rounded-2xl p-6 shadow-sm hover:shadow-xl hover:bg-white transition-all duration-300 h-40 overflow-hidden cursor-pointer">

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

                {/* AI Section (Separate) */}
                <div
                    className={`mt-8 mb-12 transform transition-all duration-1000 delay-1000 flex-shrink-0 w-full max-w-2xl px-4 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-20"}`}
                >
                    <div className="group relative bg-white/60 backdrop-blur-md border border-gray-200/60 rounded-2xl p-6 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all duration-500 h-32 hover:h-40 overflow-hidden cursor-pointer">

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

                {/* Return Hint - Centered at Bottom */}
                <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 text-gray-400 text-xs font-medium animate-pulse transition-opacity duration-1000 delay-[1500ms] ${isVisible ? "opacity-100" : "opacity-0"}`}>
                    Click anywhere to return
                </div>

            </div>
        </div>
    );
};

export default FeatureShowcase;
