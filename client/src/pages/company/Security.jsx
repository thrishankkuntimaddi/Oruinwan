import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, Server, CheckCircle2 } from 'lucide-react';

const Security = () => {
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
                <Shield className="w-20 h-20 text-green-500 mx-auto mb-8" />
                <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tight">
                    Security First.
                </h1>
                <p className="text-xl text-slate-500 dark:text-slate-400 max-w-3xl mx-auto">
                    We treat your data with the highest level of security. From SOC2 compliance to end-to-end encryption, your workspace is safe with us.
                </p>
            </header>

            <section className="py-20 bg-slate-50 dark:bg-[#0B0F19]">
                <div className="container mx-auto px-6 max-w-6xl">
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="p-8 bg-white dark:bg-[#030712] rounded-3xl border border-slate-200 dark:border-white/5">
                            <Lock className="w-10 h-10 text-indigo-500 mb-6" />
                            <h3 className="text-xl font-bold mb-4">Encryption</h3>
                            <p className="text-slate-500 dark:text-slate-400">Data is encrypted in transit using TLS 1.3 and at rest using AES-256.</p>
                        </div>
                        <div className="p-8 bg-white dark:bg-[#030712] rounded-3xl border border-slate-200 dark:border-white/5">
                            <CheckCircle2 className="w-10 h-10 text-green-500 mb-6" />
                            <h3 className="text-xl font-bold mb-4">Compliance</h3>
                            <p className="text-slate-500 dark:text-slate-400">We are SOC2 Type II compliant and GDPR ready. We undergo annual audits.</p>
                        </div>
                        <div className="p-8 bg-white dark:bg-[#030712] rounded-3xl border border-slate-200 dark:border-white/5">
                            <Server className="w-10 h-10 text-blue-500 mb-6" />
                            <h3 className="text-xl font-bold mb-4">Infrastructure</h3>
                            <p className="text-slate-500 dark:text-slate-400">Hosted on AWS with redundant backups and 99.99% uptime SLA.</p>
                        </div>
                    </div>
                </div>
            </section>
            <footer className="py-12 border-t border-slate-200 dark:border-white/5 text-center text-slate-500 dark:text-slate-400">
                <p>© 2026 Chttrix Inc.</p>
            </footer>
        </div>
    );
};

export default Security;
