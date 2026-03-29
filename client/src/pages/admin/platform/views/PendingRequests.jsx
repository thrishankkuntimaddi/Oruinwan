import React, { useState, useEffect } from "react";
import api from '@services/api';
import { Check, X, Globe, ExternalLink } from "lucide-react";
import { useToast } from "../../../../contexts/ToastContext";

const PendingRequests = () => {
    const [companies, setCompanies] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [reason, setReason] = useState("");
    const { showToast } = useToast();

    useEffect(() => {
        fetchPending();
    }, []);

    const fetchPending = async () => {
        try {

            const res = await api.get(`/api/admin/pending-companies`);

            setCompanies(res.data);
        } catch (err) {
            console.error("❌ Error fetching pending companies:", err);
        }
    };

    const handleApprove = async (id) => {
        try {
            await api.post(`/api/admin/approve-company/${id}`, { message: reason });
            showToast("Company Approved! Email sent.", "success");
            setCompanies(prev => prev.filter(c => c._id !== id));
            setSelectedCompany(null);
            setReason("");
        } catch (err) {
            showToast("Failed to approve", "error");
        }
    };

    const handleReject = async (id) => {
        if (!reason.trim()) {
            showToast("Please provide a rejection reason", "error");
            return;
        }
        try {
            await api.post(`/api/admin/reject-company/${id}`, { message: reason });
            showToast("Company Rejected", "info");
            setCompanies(prev => prev.filter(c => c._id !== id));
            setSelectedCompany(null);
            setReason("");
        } catch (err) {
            showToast("Failed to reject", "error");
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-black text-gray-900 dark:text-white">Pending Registrations</h2>

            {companies.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 text-gray-900 dark:text-white transition-colors duration-300">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600 dark:text-green-400">
                        <Check size={32} />
                    </div>
                    <h2 className="text-xl font-bold">All Caught Up!</h2>
                    <p className="text-gray-500 dark:text-gray-400">No pending verifications.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {companies.map(company => (
                        <div key={company._id} className="bg-white rounded-3xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all flex flex-col">
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 font-bold text-xl">
                                    {company.name.charAt(0)}
                                </div>
                                <span className="text-xs font-bold px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full uppercase tracking-wide">Pending</span>
                            </div>

                            <h3 className="font-bold text-lg text-gray-900 mb-1">{company.name}</h3>
                            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                                <Globe size={14} /> {company.domain || "No Domain"}
                            </div>

                            <div className="flex-1 space-y-3 mb-6">
                                <div className="text-xs bg-gray-50 p-2 rounded-lg border border-gray-100">
                                    <span className="block font-bold text-gray-700 mb-1">Documents</span>
                                    {company.documents && company.documents.length > 0 ? (
                                        company.documents.map((doc, i) => (
                                            <a key={i} href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-indigo-600 hover:underline truncate">
                                                <ExternalLink size={12} /> {doc.name}
                                            </a>
                                        ))
                                    ) : <span className="text-gray-400">No docs uploaded</span>}
                                </div>
                                <div className="text-xs text-gray-400">
                                    Submitted: {new Date(company.createdAt).toLocaleDateString()}
                                </div>
                            </div>

                            <button
                                onClick={() => setSelectedCompany(company)}
                                className="w-full py-2 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-black transition-colors"
                            >
                                Review Application
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* REVIEW MODAL - Simplified from original for brevity but keeping core logic */}
            {selectedCompany && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl w-full max-w-4xl overflow-hidden my-8 p-8 max-h-[90vh] overflow-y-auto custom-scrollbar transition-colors">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-1">Review Application</h2>
                                <p className="text-gray-500 dark:text-gray-400">Detailed verification for <strong className="text-gray-900 dark:text-white">{selectedCompany.name}</strong></p>
                            </div>
                            <button onClick={() => setSelectedCompany(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X size={24} className="text-gray-400" />
                            </button>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                            {/* Company Details */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-slate-700 pb-2">Company Information</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-400 font-bold mb-1">Company Name</p>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{selectedCompany.name}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400 font-bold mb-1">Domain</p>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{selectedCompany.domain || "N/A"}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400 font-bold mb-1">Company Email</p>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{selectedCompany.billingEmail || "N/A"}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400 font-bold mb-1">Phone</p>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{selectedCompany.settings?.phone || selectedCompany.ownerPhone || "N/A"}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Admin Details */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-slate-700 pb-2">Admin Information</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-400 font-bold mb-1">Full Name</p>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{selectedCompany.admins[0]?.user?.username || selectedCompany.admins[0]?.user?.name || "N/A"}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400 font-bold mb-1">Personal Email</p>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{selectedCompany.admins[0]?.user?.personalEmail || selectedCompany.admins[0]?.user?.email}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400 font-bold mb-1">Job Title</p>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{selectedCompany.admins[0]?.user?.jobTitle || selectedCompany.admins[0]?.user?.role || "Admin"}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400 font-bold mb-1">Phone</p>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{selectedCompany.admins[0]?.user?.phone || "N/A"}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Documents */}
                        <div className="mb-8">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-slate-700 pb-2 mb-3">Supporting Documents</h3>
                            <div className="flex gap-3 flex-wrap">
                                {selectedCompany.documents && selectedCompany.documents.length > 0 ? (
                                    selectedCompany.documents.map((doc, i) => (
                                        <a key={i} href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors font-bold text-sm">
                                            <ExternalLink size={16} /> {doc.name || `Document ${i + 1}`}
                                        </a>
                                    ))
                                ) : <p className="text-sm text-gray-400 italic">No documents provided.</p>}
                            </div>
                        </div>

                        {/* Action Message */}
                        <div className="mb-6">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Message to User (Reason or Appreciation)</label>
                            <textarea
                                className="w-full px-4 py-3 border border-gray-200 dark:border-slate-600 rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none bg-gray-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-800 text-gray-900 dark:text-white"
                                placeholder="E.g. 'Congratulations! Welcome to the future of work.' or 'Please upload a valid business license.'"
                                rows="4"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                            />
                            <p className="text-xs text-gray-400 mt-2">This message will be included in the email sent to the user.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-slate-700">
                            <button
                                onClick={() => handleReject(selectedCompany._id)}
                                className="py-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 font-black rounded-xl hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
                            >
                                <X size={20} /> Reject Application
                            </button>
                            <button
                                onClick={() => handleApprove(selectedCompany._id)}
                                className="py-4 bg-gray-900 text-white font-black rounded-xl hover:bg-black transition-all shadow-lg hover:shadow-xl hover:scale-[1.01] flex items-center justify-center gap-2"
                            >
                                <Check size={20} /> Approve & Onboard
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PendingRequests;
