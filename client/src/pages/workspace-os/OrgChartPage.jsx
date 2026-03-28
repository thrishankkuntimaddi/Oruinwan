// client/src/pages/workspace-os/OrgChartPage.jsx
// Interactive org chart tree visualization.
// Pure CSS/flex tree — no external dependency required.
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import {
    Building2, Users, ChevronDown, ChevronRight,
    RefreshCw, User2, Crown, Briefcase
} from 'lucide-react';

const Avatar = ({ name, src, size = 8 }) => {
    const initials = (name || '?').slice(0, 2).toUpperCase();
    const colors = ['bg-indigo-500', 'bg-emerald-500', 'bg-sky-500', 'bg-violet-500', 'bg-orange-500', 'bg-pink-500'];
    const color = colors[initials.charCodeAt(0) % colors.length];
    return src ? (
        <img src={src} alt={name} className={`w-${size} h-${size} rounded-full object-cover ring-2 ring-white dark:ring-slate-800`} />
    ) : (
        <div className={`w-${size} h-${size} rounded-full ${color} flex items-center justify-center text-white text-xs font-bold ring-2 ring-white dark:ring-slate-800`}>
            {initials}
        </div>
    );
};

const MemberPill = ({ member }) => (
    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs">
        <Avatar name={member.username} src={member.profilePicture} size={5} />
        <span className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-[80px]">
            {member.username}
        </span>
        {member.role === 'lead' && <Crown size={10} className="text-amber-500 flex-shrink-0" />}
    </div>
);

const TeamCard = ({ team }) => {
    const [expanded, setExpanded] = useState(false);
    return (
        <div className="bg-white dark:bg-slate-700/40 rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden">
            <button
                onClick={() => setExpanded(e => !e)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors"
            >
                <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-600 flex items-center justify-center text-sm">
                    {team.icon || '👥'}
                </div>
                <div className="flex-1 text-left">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{team.name}</div>
                    <div className="text-xs text-slate-500">{team.memberCount} members</div>
                </div>
                {expanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
            </button>

            {expanded && team.members?.length > 0 && (
                <div className="px-4 pb-3 flex flex-wrap gap-2">
                    {team.members.map(m => m.id && <MemberPill key={m.id} member={m} />)}
                </div>
            )}
        </div>
    );
};

const DepartmentNode = ({ dept, isRoot = false }) => {
    const [expanded, setExpanded] = useState(true);
    const hasTeams = dept.teams?.length > 0;

    return (
        <div className={`relative ${isRoot ? '' : 'ml-6 pl-4 border-l-2 border-slate-200 dark:border-slate-700'}`}>
            {/* Department Card */}
            <div className={`mb-3 rounded-2xl border overflow-hidden ${
                isRoot
                    ? 'border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/40'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
            }`}>
                <button
                    onClick={() => setExpanded(e => !e)}
                    className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/60 dark:hover:bg-white/5 transition-colors"
                >
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                        <Building2 size={20} className="text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="flex-1 text-left">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{dept.name}</div>
                        <div className="text-xs text-slate-500 flex gap-3 mt-0.5">
                            <span>{dept.memberCount} members</span>
                            {dept.head && <span className="flex items-center gap-1"><Crown size={10} className="text-amber-500" /> {dept.head.username}</span>}
                        </div>
                    </div>
                    <div className="text-slate-400">
                        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </div>
                </button>

                {/* Managers row */}
                {expanded && dept.managers?.length > 0 && (
                    <div className="px-5 pb-4 flex flex-wrap gap-2">
                        {dept.managers.map(mgr => (
                            <div key={mgr._id} className="flex items-center gap-1.5 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg px-2.5 py-1.5">
                                <Briefcase size={10} />
                                {mgr.username}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Teams */}
            {expanded && hasTeams && (
                <div className="ml-6 pl-4 border-l-2 border-slate-200 dark:border-slate-700 space-y-2 mb-3">
                    {dept.teams.map(team => <TeamCard key={team.id} team={team} />)}
                </div>
            )}
        </div>
    );
};

export default function OrgChartPage({ companyId }) {
    const { user } = useAuth();
    const rawCompanyId = companyId || user?.companyId;
    // Safely extract string ID — user.companyId may be a Mongoose ObjectId object
    const resolvedCompanyId = typeof rawCompanyId === 'object' && rawCompanyId !== null
        ? (rawCompanyId._id || rawCompanyId.id || String(rawCompanyId))
        : rawCompanyId;

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        if (!resolvedCompanyId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await api.get(`/api/companies/${resolvedCompanyId}/org-chart`);
            setData(res.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load org chart');
        } finally {
            setLoading(false);
        }
    }, [resolvedCompanyId]);

    useEffect(() => { load(); }, [load]);

    if (loading) return (
        <div className="flex items-center justify-center h-64 text-slate-400">
            <RefreshCw size={24} className="animate-spin mr-3" /> Loading org chart…
        </div>
    );

    if (error) return (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6 text-red-600 dark:text-red-400">
            {error}
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <Building2 size={22} className="text-indigo-500" />
                        Organization Chart
                    </h2>
                    {data && (
                        <p className="text-sm text-slate-500 mt-1">
                            {data.company?.name} · {data.totalEmployees} employees
                            {data.unassignedCount > 0 && ` · ${data.unassignedCount} unassigned`}
                        </p>
                    )}
                </div>
                <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                    <RefreshCw size={14} /> Refresh
                </button>
            </div>

            {/* Company Root */}
            {data?.company && (
                <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-5 text-white flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-2xl">
                        {data.company.logo
                            ? <img src={data.company.logo} alt="" className="w-full h-full rounded-2xl object-contain" />
                            : '🏢'
                        }
                    </div>
                    <div>
                        <div className="text-xl font-black">{data.company.name}</div>
                        <div className="text-indigo-200 text-sm">{data.totalEmployees} total employees across {data.departments?.length} departments</div>
                    </div>
                </div>
            )}

            {/* Department Tree */}
            <div className="space-y-3">
                {data?.departments?.length > 0 ? (
                    data.departments.map(dept => <DepartmentNode key={dept.id} dept={dept} />)
                ) : (
                    <div className="text-center py-16 text-slate-400">
                        <Users size={48} className="mx-auto mb-3 opacity-30" />
                        <p>No departments found. Create departments to build your org structure.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
