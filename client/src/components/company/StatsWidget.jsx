// client/src/components/company/StatsWidget.jsx

import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

const StatsWidget = ({
    icon: Icon,
    label,
    value,
    trend = null,
    trendLabel = '',
    bgColor = 'bg-blue-50',
    iconColor = 'text-blue-600'
}) => {
    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">{label}</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>

                    {trend !== null && (
                        <div className="flex items-center gap-1 mt-2">
                            {trend > 0 ? (
                                <TrendingUp className="w-4 h-4 text-green-500" />
                            ) : trend < 0 ? (
                                <TrendingDown className="w-4 h-4 text-red-500" />
                            ) : null}
                            <span className={`text-sm font-medium ${trend > 0 ? 'text-green-600 dark:text-green-400' : trend < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                {trend > 0 && '+'}{trend}% {trendLabel}
                            </span>
                        </div>
                    )}
                </div>

                {Icon && (
                    <div className={`${bgColor} ${iconColor} p-3 rounded-lg`}>
                        <Icon className="w-6 h-6" />
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatsWidget;
