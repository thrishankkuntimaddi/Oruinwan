import React, { useState } from 'react';
import { Megaphone, Send, Info, CheckCircle } from 'lucide-react';
import { useToast } from '../../../../contexts/ToastContext';

const Broadcast = () => {
    const [message, setMessage] = useState("");
    const [severity, setSeverity] = useState("info"); // info, warning, critical
    const [sent, setSent] = useState(false);
    const { showToast } = useToast();

    const handleSend = () => {
        if (!message.trim()) return;

        // Mock sending
        setTimeout(() => {
            setSent(true);
            showToast("Broadcast sent to all companies", "success");
            setMessage("");
            setTimeout(() => setSent(false), 3000);
        }, 1000);
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="text-center py-8">
                <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">System Broadcast</h2>
                <p className="text-gray-500 dark:text-gray-400">Send an urgent message or announcement to all company administrators.</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl shadow-indigo-100/50 dark:shadow-none border border-gray-100 dark:border-gray-700 overflow-hidden relative transition-colors">
                {sent && (
                    <div className="absolute inset-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm z-10 flex items-center justify-center flex-col animate-fadeIn">
                        <CheckCircle size={64} className="text-green-500 mb-4" />
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white">Message Sent!</h3>
                        <p className="text-gray-500 dark:text-gray-400">All admins have been notified.</p>
                    </div>
                )}

                <div className="p-8 space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Message Severity</label>
                        <div className="flex gap-3">
                            {['info', 'warning', 'critical'].map(s => (
                                <button
                                    key={s}
                                    onClick={() => setSeverity(s)}
                                    className={`flex-1 py-3 px-4 rounded-xl font-bold uppercase text-xs tracking-wider border-2 transition-all
                                        ${severity === s
                                            ? s === 'critical' ? 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                                : s === 'warning' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                                                    : 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                            : 'border-transparent bg-gray-50 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600'}`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Announcement Content</label>
                        <textarea
                            className="w-full h-40 px-4 py-3 bg-gray-50 dark:bg-gray-700 border-2 border-gray-100 dark:border-gray-600 rounded-xl focus:border-indigo-500 dark:focus:border-indigo-400 focus:bg-white dark:focus:bg-gray-800 text-gray-900 dark:text-white transition-all outline-none resize-none text-base"
                            placeholder="Type your message here..."
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                        />
                        <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                            <Info size={12} /> This will appear in the notification center of every company admin.
                        </p>
                    </div>

                    <button
                        onClick={handleSend}
                        disabled={!message.trim()}
                        className="w-full py-4 bg-gray-900 dark:bg-indigo-600 text-white font-bold rounded-xl hover:bg-black dark:hover:bg-indigo-700 transition-all shadow-lg shadow-gray-200 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <Send size={18} /> Send Broadcast
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Broadcast;
