import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Github, Calendar, Lightbulb, Users, Shield, Mail } from 'lucide-react';

const Community = () => {
    const navigate = useNavigate();

    const communityFeatures = [
        {
            icon: <MessageSquare className="w-8 h-8" />,
            title: 'Ask Questions',
            description: 'Get help from other users and learn best practices',
            color: 'blue'
        },
        {
            icon: <Lightbulb className="w-8 h-8" />,
            title: 'Share Feedback',
            description: 'Submit feature requests and vote on ideas from others',
            color: 'yellow'
        },
        {
            icon: <Github className="w-8 h-8" />,
            title: 'Report Bugs',
            description: 'Help us identify and fix unexpected behavior',
            color: 'red'
        },
        {
            icon: <Users className="w-8 h-8" />,
            title: 'Learn Together',
            description: 'Discover workflows and collaboration tips',
            color: 'green'
        },
        {
            icon: <Shield className="w-8 h-8" />,
            title: 'Stay Updated',
            description: 'Get notified about product changes and improvements',
            color: 'purple'
        }
    ];

    const colorClasses = {
        blue: 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
        yellow: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
        red: 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400',
        green: 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400',
        purple: 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
        indigo: 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-white transition-colors duration-500">
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

            {/* Hero Section */}
            <header className="pt-40 pb-20 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-[#0B0F19] dark:via-[#0F1623] dark:to-[#030712] text-center px-6 border-b border-slate-200 dark:border-white/5">
                <div className="max-w-4xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-500/20 rounded-full text-indigo-600 dark:text-indigo-400 font-bold mb-8">
                        <Users size={16} />
                        Join the Community
                    </div>
                    <h1 className="text-5xl md:text-6xl font-black mb-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                        Join the Chttrix Community
                    </h1>
                    <p className="text-xl text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
                        The Chttrix community is a place for users, builders, and teams to connect, share feedback, and help shape the future of secure collaboration.
                    </p>
                    <p className="text-lg text-slate-500 dark:text-slate-400 font-bold">
                        We're building Chttrix in the open — and your input matters.
                    </p>
                </div>
            </header>

            {/* What You Can Do Here */}
            <section className="py-20 container mx-auto px-6 max-w-6xl">
                <div className="text-center mb-16">
                    <h2 className="text-4xl font-black text-slate-900 dark:text-white mb-4">What You Can Do Here</h2>
                    <p className="text-lg text-slate-500 dark:text-slate-400">
                        This is not a support-only space — it's a place for discussion and collaboration.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {communityFeatures.map((feature, index) => (
                        <div key={index} className="bg-white dark:bg-[#0B0F19] p-8 rounded-3xl border border-slate-200 dark:border-white/5 hover:border-indigo-500 dark:hover:border-indigo-500 transition-all hover:-translate-y-1 hover:shadow-xl group">
                            <div className={`w-16 h-16 ${colorClasses[feature.color]} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                                {feature.icon}
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{feature.title}</h3>
                            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">{feature.description}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Where the Community Lives */}
            <section className="py-20 bg-white dark:bg-[#0B0F19] border-y border-slate-200 dark:border-white/5">
                <div className="container mx-auto px-6 max-w-5xl">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-black text-slate-900 dark:text-white mb-4">Where the Community Lives</h2>
                        <p className="text-lg text-slate-500 dark:text-slate-400">
                            Currently, the Chttrix community is hosted across the following channels
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Community Forum */}
                        <div className="bg-slate-50 dark:bg-[#030712] p-10 rounded-3xl border-2 border-slate-200 dark:border-white/10 hover:border-blue-500 dark:hover:border-blue-500 transition-all group">
                            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-6">
                                <MessageSquare size={32} />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Community Forum</h3>
                            <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                                Ask questions, share ideas, and discuss workflows with fellow Chttrix users.
                            </p>
                            <button className="text-blue-600 dark:text-blue-400 font-bold hover:gap-2 transition-all flex items-center gap-1">
                                Coming Soon →
                            </button>
                        </div>

                        {/* GitHub Discussions */}
                        <div className="bg-slate-50 dark:bg-[#030712] p-10 rounded-3xl border-2 border-slate-200 dark:border-white/10 hover:border-purple-500 dark:hover:border-purple-500 transition-all group">
                            <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center mb-6">
                                <Github size={32} />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">GitHub Discussions</h3>
                            <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                                For developers: Technical discussions, API feedback, and roadmap conversations.
                            </p>
                            <button className="text-purple-600 dark:text-purple-400 font-bold hover:gap-2 transition-all flex items-center gap-1">
                                Coming Soon →
                            </button>
                        </div>
                    </div>

                    <p className="text-center text-slate-500 dark:text-slate-400 mt-10 italic">
                        More community spaces may be added as Chttrix grows.
                    </p>
                </div>
            </section>

            {/* Product Updates & Feature Requests */}
            <section className="py-20 container mx-auto px-6 max-w-6xl">
                <div className="grid md:grid-cols-2 gap-12">
                    {/* Product Updates */}
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl flex items-center justify-center">
                                <Shield size={24} />
                            </div>
                            <h2 className="text-3xl font-black text-slate-900 dark:text-white">Product Updates & Announcements</h2>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                            We use the community to share:
                        </p>
                        <ul className="space-y-3">
                            {[
                                'New feature releases',
                                'Security and privacy updates',
                                'Important changes or maintenance notices',
                                'Early access opportunities'
                            ].map((item, index) => (
                                <li key={index} className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2.5 flex-shrink-0"></div>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-6 font-medium">
                            All major announcements are posted publicly for transparency.
                        </p>
                    </div>

                    {/* Feature Requests */}
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 rounded-xl flex items-center justify-center">
                                <Lightbulb size={24} />
                            </div>
                            <h2 className="text-3xl font-black text-slate-900 dark:text-white">Feature Requests & Feedback</h2>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                            Have an idea that could improve Chttrix?
                        </p>
                        <ul className="space-y-3">
                            {[
                                'Submit feature requests',
                                'Vote on ideas from other users',
                                'Participate in early discussions before features are built'
                            ].map((item, index) => (
                                <li key={index} className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                                    <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full mt-2.5 flex-shrink-0"></div>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                        <div className="mt-8 p-6 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-500/20 rounded-2xl">
                            <p className="text-slate-700 dark:text-slate-300 font-bold">
                                💡 Many Chttrix features are shaped directly by community feedback.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Events & Meetups */}
            <section className="py-20 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-[#0B0F19] dark:to-[#0F1623] border-y border-slate-200 dark:border-white/5">
                <div className="container mx-auto px-6 max-w-4xl text-center">
                    <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mb-8 mx-auto">
                        <Calendar size={32} />
                    </div>
                    <h2 className="text-4xl font-black text-slate-900 dark:text-white mb-6">Events & Meetups</h2>
                    <p className="text-lg text-slate-600 dark:text-slate-300 mb-8 leading-relaxed">
                        At this stage, Chttrix does not host large conferences.
                    </p>
                    <p className="text-slate-600 dark:text-slate-400 mb-6">
                        However, we may organize:
                    </p>
                    <div className="flex flex-wrap justify-center gap-4 mb-8">
                        {['Online community sessions', 'Product walkthroughs', 'Feedback calls with early users'].map((event, index) => (
                            <span key={index} className="px-6 py-3 bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-slate-300 font-medium">
                                {event}
                            </span>
                        ))}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                        Upcoming events, when available, will be announced here.
                    </p>
                </div>
            </section>

            {/* Community Guidelines */}
            <section className="py-20 container mx-auto px-6 max-w-4xl">
                <div className="text-center mb-12">
                    <h2 className="text-4xl font-black text-slate-900 dark:text-white mb-4">Community Guidelines</h2>
                    <p className="text-lg text-slate-500 dark:text-slate-400">
                        To keep the community helpful and respectful
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    {[
                        { text: 'Be constructive and respectful', icon: '✅' },
                        { text: 'No spam or self-promotion', icon: '🚫' },
                        { text: 'No harassment or abusive behavior', icon: '⛔' },
                        { text: 'Respect privacy and confidentiality', icon: '🔒' }
                    ].map((guideline, index) => (
                        <div key={index} className="flex items-center gap-4 p-6 bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-white/5 rounded-2xl">
                            <span className="text-3xl">{guideline.icon}</span>
                            <p className="text-slate-700 dark:text-slate-300 font-medium">{guideline.text}</p>
                        </div>
                    ))}
                </div>

                <p className="text-center text-slate-600 dark:text-slate-400 mt-10 font-medium">
                    We want this to be a safe and welcoming space for everyone.
                </p>
            </section>

            {/* Get Involved CTA */}
            <section className="py-20 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white">
                <div className="container mx-auto px-6 text-center max-w-3xl">
                    <h2 className="text-4xl font-black mb-6">Want to Get Involved?</h2>
                    <p className="text-xl opacity-90 mb-10 leading-relaxed">
                        If you're interested in contributing, testing new features, or collaborating with the Chttrix team, we'd love to hear from you.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button
                            onClick={() => navigate('/contact')}
                            className="px-8 py-4 bg-white text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 transition-all shadow-lg flex items-center justify-center gap-2"
                        >
                            <Mail size={20} />
                            Contact Us
                        </button>
                        <button
                            onClick={() => navigate('/help')}
                            className="px-8 py-4 bg-transparent border-2 border-white text-white font-bold rounded-xl hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                        >
                            Visit Help Center
                        </button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 border-t border-slate-200 dark:border-white/5 text-center text-slate-500 dark:text-slate-400">
                <p>© 2026 Chttrix Inc. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default Community;
