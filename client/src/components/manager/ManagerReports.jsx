import React from 'react';
import { Users, BarChart3, TrendingUp } from 'lucide-react';

const ManagerReports = () => {
    return (
        <div className="animate-slideDown max-w-4xl mx-auto pt-10">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-indigo-100/50 p-16 text-center">
                <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
                    <BarChart3 size={40} />
                </div>
                <h3 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">Performance Reports</h3>
                <p className="text-lg text-slate-500 mb-10 max-w-lg mx-auto leading-relaxed">
                    We're building detailed analytics to help you track team velocity, workload distribution, and project completion rates.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 max-w-2xl mx-auto text-left">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                        <TrendingUp className="text-green-500 mb-2" size={20} />
                        <p className="font-bold text-slate-800">Task Velocity</p>
                        <p className="text-xs text-slate-400">Completion trends over time</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                        <Users className="text-blue-500 mb-2" size={20} />
                        <p className="font-bold text-slate-800">Workload</p>
                        <p className="text-xs text-slate-400">Task distribution per member</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                        <BarChart3 className="text-purple-500 mb-2" size={20} />
                        <p className="font-bold text-slate-800">Efficiency</p>
                        <p className="text-xs text-slate-400">On-time delivery metrics</p>
                    </div>
                </div>

                <div className="flex justify-center gap-4">
                    <button className="px-8 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">
                        Learn More
                    </button>
                    <button className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all transform hover:-translate-y-0.5">
                        Notify Me When Ready
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ManagerReports;
