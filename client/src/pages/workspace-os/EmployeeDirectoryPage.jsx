// client/src/pages/workspace-os/EmployeeDirectoryPage.jsx
// Paginated employee directory with search, dept/role filtering.
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import {
    Search, Filter, Users, ChevronLeft, ChevronRight,
    RefreshCw, Circle, Mail, Phone, Briefcase
} from 'lucide-react';

const ROLE_LABELS = {
    owner: { label: 'Owner', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    admin: { label: 'Admin', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    manager: { label: 'Manager', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
    member: { label: 'Member', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
    guest: { label: 'Guest', color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' }
};

const StatusDot = ({ isOnline }) => (
    <div className={`w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-800 ${isOnline ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
);

const EmployeeRow = ({ emp }) => {
    const role = ROLE_LABELS[emp.companyRole] || ROLE_LABELS.member;
    const fullName = [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.username;
    const initials = fullName.slice(0, 2).toUpperCase();
    const colors = ['bg-indigo-500', 'bg-emerald-500', 'bg-sky-500', 'bg-violet-500', 'bg-orange-500'];
    const color = colors[initials.charCodeAt(0) % colors.length];

    return (
        <tr className="border-b border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
            <td className="px-5 py-3.5">
                <div className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                        {emp.profilePicture
                            ? <img src={emp.profilePicture} alt={fullName} className="w-9 h-9 rounded-full object-cover" />
                            : <div className={`w-9 h-9 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold`}>{initials}</div>
                        }
                        <div className="absolute -bottom-0.5 -right-0.5"><StatusDot isOnline={emp.isOnline} /></div>
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{fullName}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">@{emp.username}</div>
                    </div>
                </div>
            </td>
            <td className="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-1.5">
                    <Mail size={12} className="text-slate-400" />
                    <span className="truncate max-w-[180px]">{emp.email}</span>
                </div>
                {emp.phone && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <Phone size={12} className="text-slate-400" />
                        <span className="text-xs text-slate-500">{emp.phone}</span>
                    </div>
                )}
            </td>
            <td className="px-5 py-3.5">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${role.color}`}>
                    {role.label}
                </span>
            </td>
            <td className="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">
                {emp.departmentNames?.length > 0
                    ? emp.departmentNames.join(', ')
                    : <span className="text-slate-400 italic">Unassigned</span>
                }
            </td>
            <td className="px-5 py-3.5">
                <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                    emp.accountStatus === 'active' ? 'text-emerald-600' :
                    emp.accountStatus === 'invited' ? 'text-amber-600' : 'text-slate-400'
                }`}>
                    <Circle size={7} className="fill-current" />
                    {emp.accountStatus}
                </span>
            </td>
        </tr>
    );
};

export default function EmployeeDirectoryPage({ companyId: propCompanyId }) {
    const { user } = useAuth();
    const companyId = propCompanyId || user?.companyId;

    const [employees, setEmployees] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 1 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filters
    const [search, setSearch] = useState('');
    const [dept, setDept] = useState('');
    const [role, setRole] = useState('');
    const [page, setPage] = useState(1);

    // Load departments for filter dropdown
    useEffect(() => {
        if (!companyId) return;
        api.get(`/api/departments?companyId=${companyId}`)
            .then(r => setDepartments(r.data.departments || []))
            .catch(() => {});
    }, [companyId]);

    const load = useCallback(async () => {
        if (!companyId) return;
        setLoading(true);
        setError(null);
        try {
            const params = { page, limit: 25 };
            if (search.trim()) params.search = search.trim();
            if (dept) params.dept = dept;
            if (role) params.role = role;

            const res = await api.get(`/api/companies/${companyId}/employees`, { params });
            setEmployees(res.data.employees || []);
            setPagination(res.data.pagination || { page: 1, limit: 25, total: 0, pages: 1 });
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load employees');
        } finally {
            setLoading(false);
        }
    }, [companyId, page, search, dept, role]);

    useEffect(() => { load(); }, [load]);

    // Debounced search
    useEffect(() => { setPage(1); }, [search, dept, role]);

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Users size={22} className="text-indigo-500" />
                    Employee Directory
                    {pagination.total > 0 && (
                        <span className="ml-1 text-sm font-normal text-slate-500">({pagination.total})</span>
                    )}
                </h2>
                <button onClick={load} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-indigo-500 transition-colors">
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by name or email…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                <select
                    value={dept}
                    onChange={e => setDept(e.target.value)}
                    className="px-3 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="">All Departments</option>
                    {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                </select>
                <select
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    className="px-3 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="">All Roles</option>
                    {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Employee</th>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Contact</th>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Role</th>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Department</th>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={5} className="py-16 text-center text-slate-400"><RefreshCw size={24} className="animate-spin mx-auto" /></td></tr>
                            ) : employees.length === 0 ? (
                                <tr><td colSpan={5} className="py-16 text-center text-slate-400">
                                    <Users size={40} className="mx-auto mb-3 opacity-30" />
                                    <p>No employees found</p>
                                </td></tr>
                            ) : (
                                employees.map(emp => <EmployeeRow key={emp._id} emp={emp} />)
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {pagination.pages > 1 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-slate-700">
                        <span className="text-sm text-slate-500">
                            Showing {((page - 1) * pagination.limit) + 1}–{Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{page} / {pagination.pages}</span>
                            <button
                                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                                disabled={page >= pagination.pages}
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
