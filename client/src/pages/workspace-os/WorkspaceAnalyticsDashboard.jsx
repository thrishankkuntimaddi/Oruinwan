import React, { useState } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { useWorkspaceAnalytics } from '../../hooks/useWorkspaceAnalytics';
import {
    MessageSquare, Users, CheckSquare, Hash,
    TrendingUp, Activity, RefreshCw, BarChart2
} from 'lucide-react';

const RANGE_OPTIONS = [
    { label: '7 days', value: 7 },
    { label: '30 days', value: 30 },
    { label: '90 days', value: 90 }
];

const KPICard = ({ icon: Icon, label, value, color, sub }) => (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 flex flex-col gap-2 hover:shadow-md transition-shadow">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
            <Icon size={20} className="text-white" />
        </div>
        <div className="text-2xl font-black text-slate-900 dark:text-slate-100">{value ?? '—'}</div>
        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</div>
        {sub && <div className="text-xs text-slate-400 dark:text-slate-500">{sub}</div>}
    </div>
);

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl">
            <div className="font-semibold mb-1">{label}</div>
            {payload.map((p, i) => (
                <div key={i} className="flex items-center gap-1">
                    <span style={{ color: p.color }}>●</span>
                    <span>{p.name}: {p.value}</span>
                </div>
            ))}
        </div>
    );
};

export default function WorkspaceAnalyticsDashboard({ workspaceId, workspaceName }) {
    const [range, setRange] = useState(30);
    const { data, loading, error, refetch } = useWorkspaceAnalytics(workspaceId, range);

    const summary = data?.summary || {};
    const dailyMsgs = (data?.charts?.dailyMessages || []).map(d => ({
        date: d._id,
        messages: d.count
    }));

    return (
        <div className="space-y-6">
            {}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                    <BarChart2 size={22} className="text-indigo-500" />
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                        {workspaceName ? `${workspaceName} — Analytics` : 'Workspace Analytics'}
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    {}
                    <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1 gap-1">
                        {RANGE_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setRange(opt.value)}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                                    range === opt.value
                                        ? 'bg-indigo-600 text-white shadow'
                                        : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-600'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={refetch}
                        disabled={loading}
                        className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-indigo-500 transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-400 text-sm">
                    {error}
                </div>
            )}

            {}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <KPICard icon={MessageSquare} label="Total Messages" value={summary.totalMessages?.toLocaleString()} color="bg-indigo-500" />
                <KPICard icon={CheckSquare} label="Total Tasks" value={summary.totalTasks?.toLocaleString()} color="bg-emerald-500" />
                <KPICard icon={Users} label="Members" value={summary.memberCount?.toLocaleString()} color="bg-sky-500" />
                <KPICard icon={Hash} label="Channels" value={summary.channelCount?.toLocaleString()} color="bg-violet-500" />
                <KPICard icon={Activity} label="Active (7d)" value={summary.activeMembers7d?.toLocaleString()} color="bg-orange-500" sub="Unique authors" />
                <KPICard icon={TrendingUp} label="Task Done" value={summary.taskCompletionRate !== undefined ? `${summary.taskCompletionRate}%` : '—'} color="bg-pink-500" sub="Completion rate" />
            </div>

            {}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
                <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-5">
                    Message Activity ({range} days)
                </h3>
                {loading ? (
                    <div className="h-48 flex items-center justify-center text-slate-400">
                        <RefreshCw size={24} className="animate-spin" />
                    </div>
                ) : dailyMsgs.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={dailyMsgs}>
                            <defs>
                                <linearGradient id="msgGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 11, fill: '#94a3b8' }}
                                tickFormatter={v => v.slice(5)} 
                            />
                            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area
                                type="monotone"
                                dataKey="messages"
                                stroke="#6366f1"
                                strokeWidth={2}
                                fill="url(#msgGrad)"
                                name="Messages"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
                        No message activity in this period
                    </div>
                )}
            </div>
        </div>
    );
}
