import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Clock, Shield, User, Layout } from 'lucide-react';

const AuditLogs = () => {
    const [logs, setLogs] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLogs(page);
    }, [page]);

    const fetchLogs = async (p) => {
        setLoading(true);
        try {
            const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/admin/audit-logs?page=${p}`, { withCredentials: true });
            setLogs(res.data.logs);
            setTotalPages(res.data.totalPages);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-black text-gray-900 dark:text-white">System Audit Logs</h2>

            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
                <div className="overflow-x-auto">
                    <table className="w-full text-left bg-white dark:bg-gray-800">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Action</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">User</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Description</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Resource</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Time</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                            {logs.map(log => (
                                <tr key={log._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                                <Shield size={14} />
                                            </div>
                                            <span className="font-bold text-gray-700 dark:text-gray-200 text-sm whitespace-nowrap">{log.action}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <User size={14} className="text-gray-400" />
                                            <span className="text-sm font-medium text-gray-900 dark:text-white">{log.userId?.username || 'System'}</span>
                                        </div>
                                        <div className="text-xs text-gray-400 ml-6">{log.companyId?.name || 'Global'}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate">
                                        {log.description || JSON.stringify(log.details)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                            <Layout size={10} /> {log.resource || 'N/A'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-xs text-gray-400 whitespace-nowrap">
                                        <Clock size={12} className="inline mr-1" />
                                        {new Date(log.createdAt).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {logs.length === 0 && !loading && (
                    <div className="p-12 text-center text-gray-400">No logs found.</div>
                )}
            </div>

            {/* Pagination */}
            <div className="flex justify-between items-center px-4">
                <button
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    className="px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-400 disabled:opacity-50 hover:text-gray-900 dark:hover:text-white"
                >
                    Previous
                </button>
                <span className="text-sm text-gray-500 dark:text-gray-400">Page {page} of {totalPages}</span>
                <button
                    disabled={page === totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-400 disabled:opacity-50 hover:text-gray-900 dark:hover:text-white"
                >
                    Next
                </button>
            </div>
        </div>
    );
};

export default AuditLogs;
