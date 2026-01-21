import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, Layers, Zap, Heart } from 'lucide-react';

const About = () => {
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

            {/* Hero Section */}
            <header className="pt-40 pb-20 container mx-auto px-6 text-center max-w-4xl">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-500/20 rounded-full text-indigo-600 dark:text-indigo-400 font-bold mb-8">
                    <Heart size={16} className="fill-current" />
                    Our Mission
                </div>
                <h1 className="text-5xl md:text-7xl font-black mb-8 tracking-tight bg-gradient-to-r from-slate-900 via-indigo-800 to-slate-900 dark:from-white dark:via-indigo-200 dark:to-white bg-clip-text text-transparent">
                    About Chttrix
                </h1>
                <p className="text-xl/relaxed md:text-2xl/relaxed text-slate-600 dark:text-slate-300 font-medium">
                    Chttrix is a secure communication and collaboration platform built for teams that care about <span className="text-indigo-600 dark:text-indigo-400">privacy</span>, <span className="text-indigo-600 dark:text-indigo-400">focus</span>, and <span className="text-indigo-600 dark:text-indigo-400">clarity</span>.
                </p>
            </header>

            {/* Core Beliefs */}
            <section className="py-20 bg-slate-50 dark:bg-[#0B0F19] border-y border-slate-200 dark:border-white/5">
                <div className="container mx-auto px-6 max-w-6xl">
                    <div className="grid md:grid-cols-2 gap-16 items-center">
                        <div>
                            <h2 className="text-3xl font-black mb-6">Why We Exist</h2>
                            <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
                                Modern work depends on conversation — yet most tools trade privacy for convenience. Chttrix was created to change that.
                            </p>
                            <div className="space-y-6">
                                <BeliefItem
                                    icon={<Lock className="text-emerald-500" />}
                                    title="Private by Default"
                                    desc="Conversations should belong to you, not your provider."
                                />
                                <BeliefItem
                                    icon={<Layers className="text-blue-500" />}
                                    title="Organized without Friction"
                                    desc="Teams should stay in flow, not get lost in noise."
                                />
                                <BeliefItem
                                    icon={<Shield className="text-purple-500" />}
                                    title="Security Built In"
                                    desc="Not bolted on. Integrated into every layer of the stack."
                                />
                            </div>
                        </div>
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl blur-3xl opacity-20 dark:opacity-40"></div>
                            <div className="relative bg-white dark:bg-[#111827] p-8 rounded-3xl border border-slate-200 dark:border-white/10 shadow-xl">
                                <h3 className="text-xl font-bold mb-4">The Complete Platform</h3>
                                <p className="text-slate-600 dark:text-slate-400 mb-6">
                                    Chttrix brings everything together in a single, secure environment:
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                    {['Messaging', 'Channels', 'Threads', 'Tasks', 'Notes', 'Secure AI'].map((item) => (
                                        <div key={item} className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl text-center font-bold text-sm text-slate-700 dark:text-slate-300">
                                            {item}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Philosophy */}
            <section className="py-24 container mx-auto px-6 text-center max-w-3xl">
                <div className="p-10 bg-indigo-900 dark:bg-[#0F1623] rounded-3xl text-white relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                    <div className="relative z-10">
                        <Zap className="mx-auto w-12 h-12 text-yellow-400 mb-6" />
                        <h2 className="text-3xl font-black mb-6">Building Thoughtfully</h2>
                        <p className="text-lg text-indigo-100 leading-relaxed">
                            We’re building Chttrix thoughtfully, prioritizing long-term reliability and transparency over shortcuts. We believe that trust is earned in drops and lost in buckets.
                        </p>
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

const BeliefItem = ({ icon, title, desc }) => (
    <div className="flex gap-4 items-start">
        <div className="p-3 bg-white dark:bg-white/5 rounded-xl shadow-sm border border-slate-100 dark:border-white/10 shrink-0">
            {React.cloneElement(icon, { size: 24 })}
        </div>
        <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h3>
            <p className="text-slate-600 dark:text-slate-400 mt-1">{desc}</p>
        </div>
    </div>
);

export default About;
