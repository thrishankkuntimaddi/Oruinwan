
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Palette } from 'lucide-react';

const Brand = () => {
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

            <header className="pt-32 pb-20 container mx-auto px-6 max-w-5xl">
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-6xl font-black mb-6">Brand Assets</h1>
                    <p className="text-xl text-slate-500 dark:text-slate-400">
                        Official logos, colors, and typography for Chttrix.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-12">
                    <section className="space-y-6">
                        <h2 className="text-2xl font-bold flex items-center gap-3"><Download className="text-indigo-500" /> Logomark</h2>
                        <div className="p-12 bg-slate-50 dark:bg-[#0B0F19] rounded-3xl border border-slate-200 dark:border-white/5 flex items-center justify-center">
                            <img src="/chttrix-logo.jpg" alt="Logo" className="w-32 h-32 rounded-3xl shadow-lg" />
                        </div>
                        <button className="flex items-center gap-2 font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                            Download SVG <Download size={14} />
                        </button>
                    </section>

                    <section className="space-y-6">
                        <h2 className="text-2xl font-bold flex items-center gap-3"><Palette className="text-indigo-500" /> Colors</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="h-32 rounded-2xl bg-indigo-600 flex items-end p-4 text-white font-mono text-sm font-bold">#4F46E5</div>
                            <div className="h-32 rounded-2xl bg-[#030712] flex items-end p-4 text-white font-mono text-sm font-bold border border-white/10 text-right">#030712</div>
                        </div>
                    </section>
                </div>
            </header>
            <footer className="py-12 border-t border-slate-200 dark:border-white/5 text-center text-slate-500 dark:text-slate-400">
                <p>© 2026 Chttrix Inc.</p>
            </footer>
        </div>
    );
};

export default Brand;
