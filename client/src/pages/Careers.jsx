import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Briefcase } from 'lucide-react';

const Careers = () => {
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

            {/* Hero */}
            <header className="pt-40 pb-20 container mx-auto px-6 text-center">
                <div className="inline-block px-4 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-sm font-bold rounded-full mb-8">
                    We're Hiring 🚀
                </div>
                <h1 className="text-5xl md:text-7xl font-black mb-8 tracking-tight">
                    Build the future of <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">collaboration</span>.
                </h1>
                <p className="text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto mb-12">
                    Join us in our mission to redefine how teams work together. We're looking for passionate problem solvers.
                </p>
                <button className="px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-black rounded-2xl font-bold hover:-translate-y-1 hover:shadow-xl transition-all">
                    View Open Roles
                </button>
            </header>

            {/* Open Roles */}
            <section className="py-24 bg-slate-50 dark:bg-[#0B0F19]">
                <div className="container mx-auto px-6 max-w-4xl text-center">
                    <h2 className="text-3xl font-bold mb-6">Open Positions</h2>

                    <div className="bg-white dark:bg-[#030712] rounded-3xl p-12 border border-slate-200 dark:border-white/5 shadow-sm">
                        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Briefcase size={32} />
                        </div>
                        <h3 className="text-2xl font-bold mb-4">We are currently fully staffed.</h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-lg mx-auto">
                            While we don't have any open roles at the moment, we're always looking for exceptional talent. Join our talent network to be notified when new positions open up.
                        </p>

                        <form className="max-w-md mx-auto flex gap-3" onSubmit={(e) => e.preventDefault()}>
                            <input
                                type="email"
                                placeholder="Enter your email"
                                className="flex-1 px-5 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                            />
                            <button className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors">
                                Join Network
                            </button>
                        </form>
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

export default Careers;
