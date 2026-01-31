import React from 'react';

/**
 * Reusable Card component for Settings tabs
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Card content
 * @param {string} props.title - Card title
 * @param {string} props.subtitle - Card subtitle
 * @param {string} props.className - Additional CSS classes
 */
const Card = ({ children, title, subtitle, className = "" }) => (
    <div className={`bg-white dark:bg-[#0B0F19] rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-200/60 dark:border-white/5 overflow-hidden ${className}`}>
        {(title || subtitle) && (
            <div className="px-6 py-5 border-b border-slate-100 dark:border-white/5 bg-slate-50/30 dark:bg-[#0B0F19]">
                {title && <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">{title}</h3>}
                {subtitle && <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">{subtitle}</p>}
            </div>
        )}
        <div className="p-6">
            {children}
        </div>
    </div>
);

export default Card;
