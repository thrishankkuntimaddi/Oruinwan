
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Server } from 'lucide-react';

const Status = () => {
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

            <div className="pt-32 pb-20 container mx-auto px-6 max-w-4xl">
                <div className="bg-green-500 text-white p-8 rounded-3xl flex items-center justify-between mb-12 shadow-lg shadow-green-500/20">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">All Systems Operational</h1>
                        <p className="opacity-90">Last updated: Just now</p>
                    </div>
                    <CheckCircle2 size={48} className="opacity-80" />
                </div>

                <div className="space-y-4">
                    {['API', 'Web App', 'Mobile App', 'Notification Services', 'Third-party Integrations'].map((service, i) => (
                        <div key={i} className="flex items-center justify-between p-6 bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-white/5 rounded-2xl">
                            <div className="flex items-center gap-4">
                                <Server className="text-slate-400" size={20} />
                                <span className="font-bold text-lg">{service}</span>
                            </div>
                            <span className="text-green-500 font-bold text-sm">Operational</span>
                        </div>
                    ))}
                </div>

                <div className="mt-12 text-center">
                    <h3 className="text-xl font-bold mb-4">Past Incidents</h3>
                    <p className="text-slate-500 dark:text-slate-400">No incidents reported in the last 90 days.</p>
                </div>
            </div>
            <footer className="py-12 border-t border-slate-200 dark:border-white/5 text-center text-slate-500 dark:text-slate-400">
                <p>© 2026 Chttrix Inc.</p>
            </footer>
        </div>
    );
};

export default Status;
