import React from 'react';
import { ChevronLeft } from 'lucide-react';

/**
 * HelpWhatsNewView Component
 * Release notes and feature updates timeline
 */
const HelpWhatsNewView = ({ onBack }) => {
    return (
        <div className="w-72 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col animate-fade-in">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50 sticky top-0 z-10">
                <button onClick={onBack} className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white flex items-center text-xs font-bold transition-colors">
                    <ChevronLeft size={14} className="mr-1" /> Back
                </button>
                <span className="font-bold text-gray-900 dark:text-white text-sm">What's New</span>
                <div className="w-8"></div>
            </div>
            <div className="p-4 space-y-4">
                <div className="pl-4 border-l-2 border-pink-500 relative">
                    <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-pink-500"></div>
                    <div className="text-[10px] font-bold text-pink-500">NOV 2025</div>
                    <div className="text-sm font-bold text-gray-900 dark:text-white">Chttrix AI 2.0</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mt-1">Smarter responses & context awareness.</div>
                </div>
                <div className="pl-4 border-l-2 border-orange-500 relative">
                    <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-orange-500"></div>
                    <div className="text-[10px] font-bold text-orange-500">OCT 2025</div>
                    <div className="text-sm font-bold text-gray-900 dark:text-white">Dark Mode</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mt-1">Easy on the eyes.</div>
                </div>
            </div>
        </div>
    );
};

export default HelpWhatsNewView;
