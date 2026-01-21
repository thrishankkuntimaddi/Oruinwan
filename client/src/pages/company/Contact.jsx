import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, MapPin, Phone } from 'lucide-react';

const Contact = () => {
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

            <div className="pt-32 pb-20 container mx-auto px-6 max-w-5xl">
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-6xl font-black mb-6">Get in touch</h1>
                    <p className="text-xl text-slate-500 dark:text-slate-400">
                        Have a question about Chttrix? We're here to help.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-12">
                    {/* Contact Info */}
                    <div className="space-y-8">
                        <div className="p-8 bg-slate-50 dark:bg-[#0B0F19] rounded-3xl">
                            <h3 className="text-xl font-bold mb-6">Contact Information</h3>
                            <div className="space-y-6">
                                <div className="flex items-start gap-4">
                                    <Mail className="w-6 h-6 text-indigo-600 dark:text-indigo-400 mt-1" />
                                    <div>
                                        <p className="font-bold">Email</p>
                                        <p className="text-slate-500 dark:text-slate-400">kthrishank.9@gmail.com</p>
                                        <p className="text-slate-500 dark:text-slate-400">kthrishank10@gmail.com</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <Phone className="w-6 h-6 text-indigo-600 dark:text-indigo-400 mt-1" />
                                    <div>
                                        <p className="font-bold">Phone</p>
                                        <p className="text-slate-500 dark:text-slate-400">+91 9381870544</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Contact Form */}
                    <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Name</label>
                            <input type="text" className="w-full px-4 py-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Your name" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Email</label>
                            <input type="email" className="w-full px-4 py-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="you@example.com" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Message</label>
                            <textarea rows="4" className="w-full px-4 py-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" placeholder="How can we help?"></textarea>
                        </div>
                        <button className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/25">
                            Send Message
                        </button>
                    </form>
                </div>
            </div>
            <footer className="py-12 border-t border-slate-200 dark:border-white/5 text-center text-slate-500 dark:text-slate-400">
                <p>© 2026 Chttrix Inc.</p>
            </footer>
        </div>
    );
};

export default Contact;
