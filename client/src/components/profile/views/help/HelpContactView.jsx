import React from 'react';
import { ChevronLeft } from 'lucide-react';

/**
 * HelpContactView Component
 * Contact support form
 */
const HelpContactView = ({ onBack }) => {
    return (
        <div className="w-72 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col animate-fade-in">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50 sticky top-0 z-10">
                <button onClick={onBack} className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white flex items-center text-xs font-bold transition-colors">
                    <ChevronLeft size={14} className="mr-1" /> Back
                </button>
                <span className="font-bold text-gray-900 dark:text-white text-sm">Contact</span>
                <div className="w-8"></div>
            </div>
            <div className="p-4 space-y-3">
                <select className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                    <option>General Inquiry</option>
                    <option>Billing</option>
                    <option>Support</option>
                </select>
                <textarea className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 h-24 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" placeholder="Message..." />
                <button className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 transition-all">Send</button>
            </div>
        </div>
    );
};

export default HelpContactView;
