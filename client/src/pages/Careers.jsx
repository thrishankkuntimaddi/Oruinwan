import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Briefcase, Code, Terminal, Lock, Heart, Mail } from 'lucide-react';

const Careers = () => {
    const navigate = useNavigate();

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

            {/* Hero */}
            <header className="pt-40 pb-20 container mx-auto px-6 text-center max-w-4xl">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-500/20 rounded-full text-purple-600 dark:text-purple-400 font-bold mb-8">
                    <Briefcase size={16} />
                    We're Building
                </div>
                <h1 className="text-5xl md:text-7xl font-black mb-8 tracking-tight">
                    Careers at Chttrix
                </h1>
                <p className="text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
                    Chttrix is built by a small team focused on security, product quality, and user trust.
                </p>
            </header>

            {/* Values */}
            <section className="py-20 bg-white dark:bg-[#0B0F19] border-y border-slate-200 dark:border-white/5">
                <div className="container mx-auto px-6 max-w-6xl">
                    <h2 className="text-3xl font-black text-center mb-16">What We Care About</h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                        <ValueCard icon={<Lock className="text-emerald-500" />} title="Privacy-First" desc="Engineering with security as a constraint, not an afterthought." />
                        <ValueCard icon={<Terminal className="text-blue-500" />} title="Clean Systems" desc="Maintainable, robust, and scalable codebases." />
                        <ValueCard icon={<Heart className="text-red-500" />} title="Product Design" desc="Thoughtful user experiences that respect attention." />
                        <ValueCard icon={<Code className="text-purple-500" />} title="Long-Term" desc="Building for the next decade, not the next quarter." />
                    </div>
                </div>
            </section>

            {/* Open Roles */}
            <section className="py-24 container mx-auto px-6 max-w-4xl">
                <div className="text-center mb-16">
                    <h2 className="text-4xl font-black mb-6">Open Roles</h2>
                    <p className="text-lg text-slate-500 dark:text-slate-400">
                        We don't hire aggressively. When we do, we look for people who value responsibility as much as innovation.
                    </p>
                </div>

                <div className="bg-slate-100 dark:bg-[#111827] rounded-3xl p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800">
                    <h3 className="text-2xl font-bold mb-4">No Open Positions Currently</h3>
                    <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-lg mx-auto">
                        We don't have open positions at the moment. As Chttrix grows, we may open roles in:
                    </p>
                    <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto mb-10">
                        {['Backend & Systems Engineering', 'Security & Cryptography', 'Frontend & Product Engineering', 'Design & DX'].map(role => (
                            <div key={role} className="p-4 bg-white dark:bg-black/20 rounded-xl font-medium text-slate-700 dark:text-slate-300 shadow-sm">
                                {role}
                            </div>
                        ))}
                    </div>

                    <div className="max-w-xl mx-auto bg-indigo-50 dark:bg-indigo-900/10 p-6 rounded-2xl">
                        <p className="font-medium text-indigo-900 dark:text-indigo-200 mb-4">
                            If you're interested in working with us in the future, reach out with a short introduction:
                        </p>
                        <a href="mailto:kthrishank.9@gmail.com" className="inline-flex items-center gap-2 text-xl font-black text-indigo-600 dark:text-indigo-400 hover:underline">
                            <Mail size={20} /> kthrishank.9@gmail.com
                        </a>
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

const ValueCard = ({ icon, title, desc }) => (
    <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-3xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
        <div className="w-12 h-12 bg-white dark:bg-[#030712] rounded-2xl flex items-center justify-center shadow-sm mb-4">
            {React.cloneElement(icon, { size: 24 })}
        </div>
        <h3 className="text-lg font-bold mb-2">{title}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{desc}</p>
    </div>
);

export default Careers;
