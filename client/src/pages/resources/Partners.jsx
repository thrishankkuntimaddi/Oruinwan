import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Handshake, Box } from 'lucide-react';

const Partners = () => {
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
                <div className="inline-block p-4 rounded-3xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 mb-8">
                    <Handshake size={48} />
                </div>
                <h1 className="text-5xl md:text-7xl font-black mb-8 tracking-tight">
                    Partner with Chttrix
                </h1>
                <p className="text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto mb-12">
                    Join our ecosystem of integrators, consultants, and technology partners.
                </p>
                <button className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-colors">
                    Become a Partner
                </button>
            </header>

            <section className="py-20 bg-slate-50 dark:bg-[#0B0F19]">
                <div className="container mx-auto px-6 text-center">
                    <h2 className="text-2xl font-bold mb-12 text-slate-400 uppercase tracking-widest">Trusted By Technology Leaders</h2>
                    <div className="flex flex-wrap justify-center gap-12 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                        {/* Mock Logos */}
                        <div className="text-2xl font-black flex items-center gap-2"><Box /> Acme Inc.</div>
                        <div className="text-2xl font-black flex items-center gap-2"><Box /> Globex</div>
                        <div className="text-2xl font-black flex items-center gap-2"><Box /> Soylent Corp</div>
                        <div className="text-2xl font-black flex items-center gap-2"><Box /> Initech</div>
                    </div>
                </div>
            </section>
            <footer className="py-12 border-t border-slate-200 dark:border-white/5 text-center text-slate-500 dark:text-slate-400">
                <p>© 2026 Chttrix Inc.</p>
            </footer>
        </div>
    );
};

export default Partners;
