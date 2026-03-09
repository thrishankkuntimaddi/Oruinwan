import React from 'react';

/**
 * Card — Notes-style sharp card (no soft shadows, sharp borders)
 */
const Card = ({ title, subtitle, action, children, className = '' }) => (
    <div className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden ${className}`}>
        {(title || subtitle || action) && (
            <div className="flex items-start justify-between px-5 py-3.5 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <div>
                    {title && <h3 className="text-[13px] font-bold text-gray-900 dark:text-white">{title}</h3>}
                    {subtitle && <p className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
                </div>
                {action && <div className="flex-shrink-0 ml-4 mt-0.5">{action}</div>}
            </div>
        )}
        <div className="px-5 py-4">
            {children}
        </div>
    </div>
);

export default Card;
