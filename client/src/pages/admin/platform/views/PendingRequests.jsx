import React, { useState, useEffect } from "react";
import axios from "axios";
import { Check, X, Globe, ExternalLink, Shield } from "lucide-react";
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
            const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/admin/pending-companies`, { withCredentials: true });
            setCompanies(res.data);
        } catch (err) {
            console.error("Error:", err);
        }
    };

    const handleApprove = async (id) => {
        try {
            await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/admin/approve-company/${id}`, {}, { withCredentials: true });
            showToast("Company Approved! Email sent.", "success");
            setCompanies(prev => prev.filter(c => c._id !== id));
            setSelectedCompany(null);
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
            await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/admin/reject-company/${id}`, { reason }, { withCredentials: true });
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
            <h2 className="text-2xl font-black text-gray-900">Pending Registrations</h2>

            {companies.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-gray-100">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                        <Check size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">All Caught Up!</h2>
                    <p className="text-gray-500">No pending verifications.</p>
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
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl overflow-hidden my-8 p-8">
                        <h2 className="text-2xl font-black text-gray-900 mb-2">Review Application</h2>
                        <p className="text-gray-500 mb-8">Detailed verification for <strong className="text-gray-900">{selectedCompany.name}</strong></p>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div>
                                <p className="text-xs text-gray-500 font-bold mb-1">Company Name</p>
                                <p className="text-sm font-bold text-gray-900">{selectedCompany.name}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-bold mb-1">Admin Email</p>
                                <p className="text-sm font-bold text-gray-900">{selectedCompany.admins[0]?.user?.email}</p>
                            </div>
                        </div>

                        {/* Rejection Reason */}
                        <div className="mb-6">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Rejection Reason (if rejecting)</label>
                            <textarea
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all resize-none"
                                placeholder="Provide a detailed reason..."
                                rows="3"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => handleReject(selectedCompany._id)} className="py-3 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors">
                                Reject
                            </button>
                            <button onClick={() => handleApprove(selectedCompany._id)} className="py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors">
                                Approve
                            </button>
                        </div>
                        <button onClick={() => setSelectedCompany(null)} className="w-full mt-4 text-gray-400 text-sm font-bold hover:text-gray-600">Cancel</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PendingRequests;
