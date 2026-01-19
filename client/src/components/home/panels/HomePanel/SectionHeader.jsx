import React from 'react';
import { ChevronRight } from 'lucide-react';

const SectionHeader = ({ label, isOpen, onClick, onAdd }) => (
    <div className="flex items-center justify-between px-4 py-2 group cursor-pointer hover:text-gray-900 dark:hover:text-gray-200 text-gray-500 dark:text-gray-400">
        <div className="flex items-center" onClick={onClick}>
            <span className={`mr-1 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}>
                <ChevronRight size={12} />
            </span>
            <span className="uppercase text-xs font-bold tracking-wide">{label}</span>
        </div>
        {onAdd && (
            <button
                className="opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700 rounded p-1 text-gray-600 dark:text-gray-400 transition-opacity"
                onClick={(e) => { e.stopPropagation(); onAdd(); }}
            >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            </button>
        )}
    </div>
);

export default SectionHeader;
