import React from 'react';
import { X, BookOpen, Command, Bug, Sparkles, MessageCircle, ArrowRight } from 'lucide-react';

/**
 * HelpModalsContainer - Container for all help modal variants
 * Pure presentational component - no state or form submission logic
 * 
 * @param {string|null} activeModal - Identifier of which modal to show ('academy', 'shortcuts', 'bug', 'whatsnew', 'contact', or null)
 * @param {function} onClose - Callback to close modal
 */
const HelpModalsContainer = ({ activeModal, onClose }) => {
    if (!activeModal) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/40 z-[120] flex items-center justify-center animate-fade-in backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col relative animate-slideUp">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 z-10"
                >
                    <X size={24} />
                </button>

                {/* Academy Modal */}
                {activeModal === "academy" && (
                    <>
                        <div className="p-6 bg-indigo-600 text-white">
                            <h2 className="text-2xl font-bold flex items-center gap-2"><BookOpen size={28} /> Chttrix Academy</h2>
                            <p className="text-indigo-100 mt-1">Master your workflow with these guides.</p>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
                            <a
                                href="/chttrix-docs"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block p-4 border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg hover:border-indigo-400 dark:hover:border-indigo-500 cursor-pointer transition-all group"
                            >
                                <h3 className="font-bold text-indigo-700 dark:text-indigo-300 group-hover:underline flex items-center justify-between">
                                    <span>Full Documentation</span>
                                    <ArrowRight size={16} />
                                </h3>
                                <p className="text-sm text-indigo-600/80 dark:text-indigo-300/80 mt-1">Explore all features, settings, and guides in detail.</p>
                            </a>

                            {["Getting Started Guide", "Advanced Search Techniques", "Managing Notifications", "Integrations 101"].map((guide, i) => (
                                <div key={i} className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-indigo-900/10 cursor-pointer transition-all group">
                                    <h3 className="font-bold text-slate-800 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-400">{guide}</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Learn the basics and become a pro user in no time.</p>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* Shortcuts Modal */}
                {activeModal === "shortcuts" && (
                    <>
                        <div className="p-6 bg-slate-900 text-white">
                            <h2 className="text-2xl font-bold flex items-center gap-2"><Command size={28} /> Keyboard Shortcuts</h2>
                            <p className="text-slate-400 mt-1">Speed up your workflow.</p>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[60vh]">
                            <div className="grid grid-cols-1 gap-4">
                                <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                    <span className="text-slate-600 dark:text-slate-300 font-medium">Quick Search</span>
                                    <kbd className="px-2 py-1 bg-white dark:bg-slate-800 rounded text-xs font-mono text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-600 shadow-sm">Cmd + K</kbd>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                    <span className="text-slate-600 dark:text-slate-300 font-medium">New Message</span>
                                    <kbd className="px-2 py-1 bg-white dark:bg-slate-800 rounded text-xs font-mono text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-600 shadow-sm">Cmd + N</kbd>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                    <span className="text-slate-600 dark:text-slate-300 font-medium">Toggle AI</span>
                                    <kbd className="px-2 py-1 bg-white dark:bg-slate-800 rounded text-xs font-mono text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-600 shadow-sm">Cmd + J</kbd>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Bug Report Modal */}
                {activeModal === "bug" && (
                    <>
                        <div className="p-6 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/30">
                            <h2 className="text-2xl font-bold text-red-700 dark:text-red-400 flex items-center gap-2"><Bug size={28} /> Report a Bug</h2>
                            <p className="text-red-600 dark:text-red-300 mt-1">Found something broken? Let us know.</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">What happened?</label>
                                <textarea className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl focus:ring-red-500 focus:border-red-500 h-32 resize-none" placeholder="Describe the issue..."></textarea>
                            </div>
                            <button className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200">
                                Submit Report
                            </button>
                        </div>
                    </>
                )}

                {/* What's New Modal */}
                {activeModal === "whatsnew" && (
                    <>
                        <div className="p-6 bg-gradient-to-r from-pink-500 to-orange-500 text-white">
                            <h2 className="text-2xl font-bold flex items-center gap-2"><Sparkles size={28} /> What's New</h2>
                            <p className="text-white/90 mt-1">Latest updates and improvements.</p>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
                            <div className="relative pl-4 border-l-2 border-slate-200 dark:border-slate-700">
                                <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-pink-500"></div>
                                <span className="text-xs font-bold text-pink-500 uppercase">Nov 2025</span>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">Chttrix AI 2.0</h3>
                                <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Smarter responses, faster generation, and context-aware suggestions.</p>
                            </div>
                            <div className="relative pl-4 border-l-2 border-slate-200 dark:border-slate-700">
                                <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-orange-500"></div>
                                <span className="text-xs font-bold text-orange-500 uppercase">Oct 2025</span>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">Dark Mode Beta</h3>
                                <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Easy on the eyes. Try it out in settings.</p>
                            </div>
                        </div>
                    </>
                )}

                {/* Contact Modal */}
                {activeModal === "contact" && (
                    <>
                        <div className="p-6 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/30">
                            <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-300 flex items-center gap-2"><MessageCircle size={28} /> Contact Support</h2>
                            <p className="text-blue-700 dark:text-blue-400 mt-1">We're here to help with any questions.</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Subject</label>
                                <select className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-white rounded-xl focus:ring-blue-500 focus:border-blue-500 font-medium">
                                    <option>General Inquiry</option>
                                    <option>Billing Issue</option>
                                    <option>Technical Support</option>
                                    <option>Enterprise Sales</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Message</label>
                                <textarea className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-white rounded-xl focus:ring-blue-500 focus:border-blue-500 h-32 resize-none" placeholder="How can we help you?"></textarea>
                            </div>
                            <button className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
                                Send Message
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default HelpModalsContainer;
