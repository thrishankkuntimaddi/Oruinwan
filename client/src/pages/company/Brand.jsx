import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Palette, Image as ImageIcon, LayoutTemplate, ShieldAlert, Mail } from 'lucide-react';

const Brand = () => {
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
            <header className="pt-40 pb-20 container mx-auto px-6 text-center max-w-4xl">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-pink-50 dark:bg-pink-900/20 border border-pink-100 dark:border-pink-500/20 rounded-full text-pink-600 dark:text-pink-400 font-bold mb-8">
                    <LayoutTemplate size={16} />
                    Media Kit
                </div>
                <h1 className="text-5xl md:text-7xl font-black mb-8 tracking-tight">
                    Brand & Media
                </h1>
                <p className="text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
                    Official Chttrix brand assets, guidelines, and press resources.
                </p>
            </header>

            {/* Assets */}
            <section className="py-20 bg-slate-50 dark:bg-[#0B0F19] border-y border-slate-200 dark:border-white/5">
                <div className="container mx-auto px-6 max-w-6xl">
                    <h2 className="text-3xl font-black mb-12">Brand Assets</h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <AssetCard
                            title="Logomark"
                            desc="Light and dark variants"
                            icon={<ImageIcon />}
                            preview="/chttrix-logo.jpg"
                        />
                        <AssetCard
                            title="Brand Colors"
                            desc="Official color palette"
                            icon={<Palette />}
                            previewColor="bg-indigo-600"
                        />
                        <AssetCard
                            title="Product Screenshots"
                            desc="High-res interface shots"
                            icon={<LayoutTemplate />}
                            previewColor="bg-slate-800"
                        />
                    </div>

                    <div className="mt-12 text-center">
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Assets may be used for</p>
                        <div className="flex flex-wrap justify-center gap-4">
                            {['Articles and reviews', 'Partnerships', 'Presentations'].map(tag => (
                                <span key={tag} className="px-4 py-2 bg-white dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10 text-sm font-medium">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Guidelines */}
            <section className="py-24 container mx-auto px-6 max-w-4xl">
                <div className="grid md:grid-cols-2 gap-12 items-center">
                    <div>
                        <h2 className="text-3xl font-black mb-6">Brand Guidelines</h2>
                        <p className="text-slate-600 dark:text-slate-400 mb-8">
                            Please help us protect our brand by following these simple rules:
                        </p>
                        <ul className="space-y-4">
                            <GuidelineItem text="Do not modify or distort the logo" />
                            <GuidelineItem text="Do not change colors outside official palettes" />
                            <GuidelineItem text="Do not imply endorsement without permission" />
                            <GuidelineItem text="Use “Chttrix” exactly as written" />
                        </ul>
                    </div>
                    <div className="bg-slate-100 dark:bg-[#111827] p-8 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-center">
                        <div className="text-center">
                            <ShieldAlert size={48} className="mx-auto text-slate-300 mb-4" />
                            <p className="font-bold text-slate-500">Respect the Brand</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Contact */}
            <section className="py-20 bg-indigo-900 dark:bg-[#0F1623] text-white">
                <div className="container mx-auto px-6 text-center">
                    <Mail className="mx-auto w-12 h-12 text-indigo-300 mb-6" />
                    <h2 className="text-3xl font-black mb-4">Media & Press</h2>
                    <p className="text-indigo-200 mb-8">
                        For media inquiries, interviews, or press materials:
                    </p>
                    <a href="mailto:kthrishank.9@gmail.com" className="inline-block px-8 py-4 bg-white text-indigo-900 font-bold rounded-xl hover:bg-indigo-50 transition-colors">
                        kthrishank.9@gmail.com
                    </a>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 bg-slate-50 dark:bg-black text-center text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-white/10">
                <p>© 2026 Chttrix Inc.</p>
            </footer>
        </div>
    );
};

const AssetCard = ({ title, desc, icon, preview, previewColor }) => (
    <div className="group bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-white/5 overflow-hidden hover:shadow-xl transition-all">
        <div className={`h-40 flex items-center justify-center bg-slate-100 dark:bg-black/20 ${previewColor || ''}`}>
            {preview ? (
                <img src={preview} alt={title} className="w-20 h-20 rounded-xl shadow-lg group-hover:scale-110 transition-transform" />
            ) : (
                <div className="w-20 h-20 rounded-xl bg-white/10 flex items-center justify-center">
                    {React.cloneElement(icon, { size: 32, className: "opacity-50" })}
                </div>
            )}
        </div>
        <div className="p-6">
            <h3 className="text-xl font-bold mb-1">{title}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{desc}</p>
            <button className="w-full py-3 border border-slate-200 dark:border-white/10 rounded-xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center justify-center gap-2">
                <Download size={16} /> Download
            </button>
        </div>
    </div>
);

const GuidelineItem = ({ text }) => (
    <li className="flex items-center gap-3 text-slate-700 dark:text-slate-300 font-medium">
        <div className="w-2 h-2 rounded-full bg-red-500"></div>
        {text}
    </li>
);

export default Brand;
