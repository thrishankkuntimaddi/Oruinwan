import React, { useState, useEffect } from 'react';
import api from '../../../../../services/api';
import { Globe, MessageSquare, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ActiveCompanies = () => {
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        fetchCompanies();
    }, []);

    const fetchCompanies = async () => {
        try {
            const res = await api.get(`/api/admin/active-companies`);
            setCompanies(res.data);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    const filtered = companies.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

    if (loading) return <div className="p-8 text-center text-gray-500">Loading companies...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black text-gray-900 dark:text-white">Active Companies</h2>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search companies..."
                        className="pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 transition-colors w-64"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors">
                <div className="overflow-x-auto">
                    <table className="w-full text-left bg-white dark:bg-slate-800">
                        <thead className="bg-gray-50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-slate-700">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Company</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Plan</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Admin</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Joined</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                            {filtered.map(company => (
                                <tr key={company._id} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
                                                {company.logo ? <img src={company.logo} alt="" className="w-full h-full object-cover rounded-xl" /> : company.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900 dark:text-white">{company.name}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                                    <Globe size={10} /> {company.domain || "No domain"}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide 
                                            ${company.plan === 'enterprise' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' :
                                                company.plan === 'professional' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                                                    'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                                            {company.plan || 'Free'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">{company.admins[0]?.user?.username || 'Unknown'}</p>
                                        <p className="text-xs text-gray-400">{company.billingEmail}</p>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                        {new Date(company.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => navigate(`/chttrix-admin/dm/${company._id}`)}
                                                className="inline-flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-bold text-gray-700 dark:text-white hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-100 dark:hover:border-indigo-500/30 transition-all shadow-sm"
                                                title="Message Admin"
                                            >
                                                <MessageSquare size={14} />
                                            </button>
                                            {/* TODO: Add view details modal or page */}
                                            <button
                                                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-indigo-600 border border-transparent rounded-xl text-xs font-bold text-white hover:bg-black dark:hover:bg-indigo-700 transition-all shadow-md shadow-gray-200 dark:shadow-none"
                                            >
                                                Manage
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filtered.length === 0 && (
                    <div className="p-12 text-center text-gray-400">
                        No active companies found.
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActiveCompanies;
