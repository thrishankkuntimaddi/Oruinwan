import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Upload } from 'lucide-react';

const UsersAccess = ({ data }) => {
    const navigate = useNavigate();
    const stats = data?.stats || {
        total: 0,
        active: 0,
        pending: 0,
        suspended: 0,
        blocked: 0,
        guests: 0
    };

    const recentInvites = data?.recentInvites || [];

    return (
        <section>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wide">Users & Access</h3>
                    <p className="text-xs text-slate-500 dark:text-gray-500">People management & roles</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => navigate('/admin/people')}
                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors flex items-center gap-1">
                        <UserPlus size={14} /> Invite
                    </button>
                    <button
                        onClick={() => navigate('/admin/onboard')}
                        className="text-xs font-bold text-slate-600 dark:text-gray-400 bg-slate-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-1">
                        <Upload size={14} /> Import
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Stats Grid */}
                <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm">
                        <div className="text-slate-500 dark:text-gray-400 mb-2 truncate text-xs font-bold uppercase">Total Users</div>
                        <div className="text-2xl font-black text-slate-900 dark:text-white">{stats.total}</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm">
                        <div className="text-green-600 dark:text-green-400 mb-2 truncate text-xs font-bold uppercase">Active</div>
                        <div className="text-2xl font-black text-slate-900 dark:text-white">{stats.active}</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm">
                        <div className="text-yellow-600 dark:text-yellow-400 mb-2 truncate text-xs font-bold uppercase">Pending</div>
                        <div className="text-2xl font-black text-slate-900 dark:text-white">{stats.pending}</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm">
                        <div className="text-purple-600 dark:text-purple-400 mb-2 truncate text-xs font-bold uppercase">Guests</div>
                        <div className="text-2xl font-black text-slate-900 dark:text-white">{stats.guests}</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm">
                        <div className="text-red-500 dark:text-red-400 mb-2 truncate text-xs font-bold uppercase">Suspended</div>
                        <div className="text-2xl font-black text-slate-900 dark:text-white">{stats.suspended}</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm">
                        <div className="text-slate-800 dark:text-slate-300 mb-2 truncate text-xs font-bold uppercase">Blocked</div>
                        <div className="text-2xl font-black text-slate-900 dark:text-white">{stats.blocked}</div>
                    </div>
                </div>

                {/* Recent Activity / Actions */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-5">
                    <h4 className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-4">Recent Invites</h4>
                    <div className="space-y-3">
                        {recentInvites.length === 0 ? (
                            <p className="text-xs text-slate-400 dark:text-gray-500 italic">No recent invites</p>
                        ) : (
                            recentInvites.slice(0, 4).map((invite, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-slate-500 dark:text-gray-400">
                                            {invite.email?.[0]?.toUpperCase()}
                                        </div>
                                        <div className="truncate text-xs text-slate-700 dark:text-gray-300 font-medium">
                                            {invite.email}
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                                        Pending
                                    </span>
                                </div>
                            ))
                        )}
                        <button
                            onClick={() => navigate('/admin/people')}
                            className="w-full mt-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-slate-50 dark:hover:bg-gray-700 py-1.5 rounded transition-colors">
                            Manage All Users &rarr;
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default UsersAccess;
