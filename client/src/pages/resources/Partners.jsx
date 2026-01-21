import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Handshake,
    Cpu,
    Puzzle,
    Building2,
    ShieldCheck,
    XCircle,
    Mail,
    CheckCircle2,
    Lock
} from 'lucide-react';

const Partners = () => {
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

            {/* Hero Section */}
            <header className="pt-40 pb-20 bg-gradient-to-b from-white to-slate-50 dark:from-[#0B0F19] dark:to-[#030712] border-b border-slate-200 dark:border-white/5 px-6 text-center">
                <div className="max-w-4xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-500/20 rounded-full text-indigo-600 dark:text-indigo-400 font-bold mb-8">
                        <Handshake size={16} />
                        Partner Program
                    </div>
                    <h1 className="text-5xl md:text-6xl font-black mb-6 bg-gradient-to-r from-indigo-600 to-cyan-500 dark:from-indigo-400 dark:to-cyan-400 bg-clip-text text-transparent">
                        Partner with Chttrix
                    </h1>
                    <p className="text-xl text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                        Chttrix partners with teams and organizations that share our focus on secure, private, and modern collaboration.
                    </p>
                    <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
                        Our partner program is designed to grow gradually and intentionally — prioritizing quality, security, and long-term trust over scale.
                    </p>
                </div>
            </header>

            {/* Partner Types */}
            <section className="py-20 container mx-auto px-6 max-w-6xl">
                <div className="text-center mb-16">
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4">Who Can Partner with Chttrix</h2>
                    <p className="text-lg text-slate-500 dark:text-slate-400">Three distinct ways to build together.</p>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                    {/* Technology Partners */}
                    <div className="bg-white dark:bg-[#0B0F19] rounded-3xl border border-slate-200 dark:border-white/5 p-8 hover:border-blue-500 dark:hover:border-blue-500 transition-all hover:-translate-y-1 hover:shadow-xl group">
                        <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-6">
                            <Cpu size={28} />
                        </div>
                        <h3 className="text-xl font-bold mb-4">Technology Partners</h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
                            Extended functionality through integrations, infrastructure, or shared technical capabilities.
                        </p>

                        <div className="space-y-4 mb-8">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Includes</h4>
                            <ul className="text-sm space-y-2 text-slate-700 dark:text-slate-300">
                                <li>• Cloud & infrastructure</li>
                                <li>• Security & privacy tooling</li>
                                <li>• AI & developer platforms</li>
                                <li>• Productivity tools</li>
                            </ul>
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-2">What this means</h4>
                            <ul className="text-xs space-y-1.5 text-slate-600 dark:text-slate-400">
                                <li className="flex gap-2"><CheckCircle2 size={14} className="flex-shrink-0" /> Early API access</li>
                                <li className="flex gap-2"><CheckCircle2 size={14} className="flex-shrink-0" /> Secure architecture collab</li>
                            </ul>
                        </div>
                    </div>

                    {/* Integration Partners */}
                    <div className="bg-white dark:bg-[#0B0F19] rounded-3xl border border-slate-200 dark:border-white/5 p-8 hover:border-purple-500 dark:hover:border-purple-500 transition-all hover:-translate-y-1 hover:shadow-xl group">
                        <div className="w-14 h-14 bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center mb-6">
                            <Puzzle size={28} />
                        </div>
                        <h3 className="text-xl font-bold mb-4">Integration Partners</h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
                            Build tools that connect directly with Chttrix to improve team workflows.
                        </p>

                        <div className="space-y-4 mb-8">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Examples</h4>
                            <ul className="text-sm space-y-2 text-slate-700 dark:text-slate-300">
                                <li>• Calendar tools</li>
                                <li>• Project management</li>
                                <li>• Developer alerts</li>
                                <li>• Knowledge systems</li>
                            </ul>
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-2">What this means</h4>
                            <ul className="text-xs space-y-1.5 text-slate-600 dark:text-slate-400">
                                <li className="flex gap-2"><CheckCircle2 size={14} className="flex-shrink-0" /> Webhooks & API support</li>
                                <li className="flex gap-2"><CheckCircle2 size={14} className="flex-shrink-0" /> Integration design support</li>
                            </ul>
                        </div>
                    </div>

                    {/* Enterprise Partners */}
                    <div className="bg-white dark:bg-[#0B0F19] rounded-3xl border border-slate-200 dark:border-white/5 p-8 hover:border-pink-500 dark:hover:border-pink-500 transition-all hover:-translate-y-1 hover:shadow-xl group">
                        <div className="w-14 h-14 bg-pink-100 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 rounded-2xl flex items-center justify-center mb-6">
                            <Building2 size={28} />
                        </div>
                        <h3 className="text-xl font-bold mb-4">Enterprise (Limited)</h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
                            For organizations supporting larger teams or complex deployments.
                        </p>

                        <div className="space-y-4 mb-8">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Includes</h4>
                            <ul className="text-sm space-y-2 text-slate-700 dark:text-slate-300">
                                <li>• Consulting firms</li>
                                <li>• Deployment specialists</li>
                                <li>• Security advisors</li>
                            </ul>
                        </div>

                        <div className="p-4 bg-pink-50 dark:bg-pink-900/10 border border-pink-100 dark:border-pink-500/10 rounded-xl">
                            <p className="text-xs font-medium text-pink-600 dark:text-pink-400 italic">
                                Handled on a case-by-case basis to ensure privacy & security standards.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Criteria & Constraints */}
            <section className="py-20 bg-white dark:bg-[#0B0F19] border-y border-slate-200 dark:border-white/5">
                <div className="container mx-auto px-6 max-w-6xl">
                    <div className="grid md:grid-cols-2 gap-16">

                        {/* What We Look For */}
                        <div>
                            <div className="flex items-center gap-3 mb-8">
                                <ShieldCheck className="text-green-500" size={32} />
                                <h2 className="text-3xl font-black text-slate-900 dark:text-white">What We Look For</h2>
                            </div>
                            <ul className="space-y-6">
                                {[
                                    'Respect user privacy and data ownership',
                                    'Align with end-to-end encryption principles',
                                    'Follow strong security practices',
                                    'Build responsibly and transparently',
                                    'Value long-term collaboration over short-term growth'
                                ].map((item, i) => (
                                    <li key={i} className="flex gap-4">
                                        <div className="mt-1 w-6 h-6 bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">✓</div>
                                        <span className="text-lg text-slate-700 dark:text-slate-300 font-medium">{item}</span>
                                    </li>
                                ))}
                            </ul>
                            <div className="mt-10 p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                                <p className="text-slate-500 dark:text-slate-400 text-sm">
                                    <span className="font-bold text-slate-900 dark:text-white">Note:</span> If your product relies on accessing private user data without consent, Chttrix is likely not a good fit.
                                </p>
                            </div>
                        </div>

                        {/* What We Don't Offer */}
                        <div>
                            <div className="flex items-center gap-3 mb-8">
                                <XCircle className="text-red-500" size={32} />
                                <h2 className="text-3xl font-black text-slate-900 dark:text-white">What We Don't Offer (Yet)</h2>
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 mb-8">
                                To stay transparent, Chttrix currently does not offer:
                            </p>
                            <ul className="space-y-4">
                                {[
                                    'Open affiliate or referral programs',
                                    'Marketplace listings',
                                    'Revenue-sharing guarantees',
                                    'Mass partner onboarding'
                                ].map((item, i) => (
                                    <li key={i} className="flex gap-4 items-center p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-transparent hover:border-slate-200 dark:hover:border-white/10 transition-colors">
                                        <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                                        <span className="text-slate-600 dark:text-slate-300 font-medium">{item}</span>
                                    </li>
                                ))}
                            </ul>
                            <p className="text-sm text-slate-400 mt-6 italic">
                                * These may evolve as the platform grows.
                            </p>
                        </div>

                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24 bg-indigo-900 dark:bg-[#0F1623] text-white relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>

                <div className="container mx-auto px-6 text-center relative z-10 max-w-3xl">
                    <Mail className="mx-auto w-16 h-16 text-indigo-300 mb-8" />
                    <h2 className="text-4xl font-black mb-6">Becoming a Partner</h2>
                    <p className="text-xl text-indigo-200 mb-10 leading-relaxed">
                        If you're interested in partnering with Chttrix, reach out with your company name, partnership type, and a brief description of what you want to build.
                    </p>

                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 mb-8">
                        <p className="text-sm font-bold uppercase tracking-widest text-indigo-300 mb-4">Send Requests To</p>
                        <a href="mailto:kthrishank.9@gmail.com" className="text-3xl md:text-5xl font-black hover:text-indigo-300 transition-colors break-all">
                            kthrishank.9@gmail.com
                        </a>
                        <p className="mt-4 text-sm text-indigo-300">All partnership requests are reviewed manually.</p>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 bg-slate-900 text-center border-t border-slate-800">
                <div className="flex flex-col items-center gap-4 mb-8">
                    <Lock className="text-slate-600" size={24} />
                    <h3 className="text-white font-bold text-lg">Building Together, Securely</h3>
                    <p className="text-slate-400 max-w-lg px-6">
                        Chttrix is built with privacy and trust at its core. We partner carefully to ensure that integrations never compromise user security.
                    </p>
                </div>
                <p className="text-slate-500 text-sm">© 2026 Chttrix Inc.</p>
            </footer>
        </div>
    );
};

export default Partners;
