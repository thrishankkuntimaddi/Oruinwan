
import React, { useState, useEffect } from 'react';
import { Users, Search, MoreHorizontal, Mail, Shield } from 'lucide-react';
import { useCompany } from '../../contexts/CompanyContext';
import AdminSidebar from '../../components/admin/AdminSidebar';
import { getCompanyMembers, updateMemberRole, removeMember } from '../../services/companyService';
import { InviteUserModal } from '../../components/company';

const UserManagement = () => {
    const { company } = useCompany();
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

    const fetchMembers = async () => {
        if (!company?._id) return;
        try {
            setLoading(true);
            const res = await getCompanyMembers(company._id);
            setMembers(res.members || []);
        } catch (err) {
            console.error("Failed to fetch members", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMembers();
    }, [company?._id]);

    const filteredMembers = members.filter(member =>
        member.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
            <AdminSidebar />

            <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 relative">
                <header className="h-16 px-8 flex items-center justify-between z-10 bg-white border-b border-slate-200">
                    <div>
                        <h2 className="text-xl font-black text-slate-800">People</h2>
                        <p className="text-xs text-slate-500 font-medium">Team & Access</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsInviteModalOpen(true)}
                            className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2"
                        >
                            <Mail size={16} /> Invite People
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto w-full px-8 py-8 z-10 custom-scrollbar">
                    <div className="relative mb-6 max-w-md">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search people..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm font-medium"
                        />
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">User</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Role</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Department</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Joined</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    <tr><td colSpan="5" className="text-center py-12 text-slate-500">Loading members...</td></tr>
                                ) : filteredMembers.length === 0 ? (
                                    <tr><td colSpan="5" className="text-center py-12 text-slate-500">No members found</td></tr>
                                ) : (
                                    filteredMembers.map(member => (
                                        <tr key={member._id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500 text-xs">
                                                        {member.username.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-800">{member.username}</div>
                                                        <div className="text-xs text-slate-400">{member.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${member.companyRole === 'owner' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                                        member.companyRole === 'admin' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                                                            'bg-slate-50 text-slate-600 border-slate-100'
                                                    }`}>
                                                    {member.companyRole}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-slate-600">
                                                {member.departmentName || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-xs font-medium text-slate-400">
                                                {new Date(member.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100">
                                                    <MoreHorizontal size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <InviteUserModal
                    isOpen={isInviteModalOpen}
                    onClose={() => setIsInviteModalOpen(false)}
                    companyId={company?._id}
                />
            </main>
        </div>
    );
};

export default UserManagement;
