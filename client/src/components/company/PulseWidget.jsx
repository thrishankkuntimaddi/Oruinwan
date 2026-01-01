import React from 'react';
import { Activity } from 'lucide-react';

const PulseWidget = ({ className = '' }) => {
    return (
        <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 ${className}`}>
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Activity size={18} className="text-indigo-500" /> Pulse
            </h3>
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500 font-medium">Avg Response</span>
                    <span className="font-bold text-gray-900">2.4h</span>
                </div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-indigo-500 h-full w-3/4 rounded-full"></div>
                </div>

                <div className="flex justify-between items-center pt-1">
                    <span className="text-sm text-gray-500 font-medium">Satisfaction</span>
                    <span className="font-bold text-green-600">94%</span>
                </div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-green-500 h-full w-[94%] rounded-full"></div>
                </div>

                <div className="flex justify-between items-center pt-1">
                    <span className="text-sm text-gray-500 font-medium">System Health</span>
                    <span className="font-bold text-blue-600">99.9%</span>
                </div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full w-[99%] rounded-full"></div>
                </div>
            </div>
        </div>
    );
};

export default PulseWidget;
