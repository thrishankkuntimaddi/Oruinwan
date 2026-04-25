import React from 'react';

const DashboardCard = ({
    title,
    children,
    icon: Icon,
    className = '',
    headerActions = null
}) => {
    return (
        <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${className}`}>
            {title && (
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {Icon && <Icon className="w-5 h-5 text-gray-400" />}
                        <h3 className="font-bold text-gray-900">{title}</h3>
                    </div>
                    {headerActions}
                </div>
            )}
            <div className="p-6">
                {children}
            </div>
        </div>
    );
};

export default DashboardCard;
