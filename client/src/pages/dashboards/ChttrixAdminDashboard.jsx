
import React, { useState, useEffect } from "react";
import axios from "axios";
import { Check, X, Eye, Shield, Users, Globe, ExternalLink, FileText } from "lucide-react";
import { useToast } from "../../contexts/ToastContext";
import { useNavigate } from "react-router-dom";

const ChttrixAdminDashboard = () => {
    const [companies, setCompanies] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [reason, setReason] = useState("");
    const { showToast } = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        fetchPending();
    }, []);

    const fetchPending = async () => {
        try {
            console.log("📡 [DASHBOARD] Fetching pending companies...");
            const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/admin/pending-companies`, { withCredentials: true });
            console.log("✅ [DASHBOARD] Received:", res.data);
            setCompanies(res.data);
        } catch (err) {
            console.error("❌ [DASHBOARD] Error:", err);
            console.error("❌ [DASHBOARD] Response:", err.response);
            if (err.response?.status === 403 || err.response?.status === 401) {
                console.log("🔒 [DASHBOARD] Auth failed, redirecting to login");
                navigate("/login");
            }
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
        <div className="min-h-screen bg-gray-50 p-8 font-sans">
            <div className="max-w-7xl mx-auto">
                <header className="mb-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                            <Shield size={32} className="text-indigo-600" /> Chttrix Admin
                        </h1>
                        <p className="text-gray-500 mt-1">Review pending company registrations.</p>
                    </div>
                    <button onClick={() => navigate("/login")} className="text-sm font-bold text-gray-500 hover:text-gray-900">Logout</button>
                </header>

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

                                <div className="flex gap-2 mt-auto">
                                    <button
                                        onClick={() => setSelectedCompany(company)}
                                        className="flex-1 py-2 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-black transition-colors"
                                    >
                                        Review
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ENHANCED REVIEW MODAL */}
                {selectedCompany && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
                        <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl overflow-hidden animate-fadeIn my-8">
                            <div className="p-8 max-h-[85vh] overflow-y-auto">
                                <h2 className="text-2xl font-black text-gray-900 mb-2">Review Application</h2>
                                <p className="text-gray-500 mb-8">Detailed verification for <strong className="text-gray-900">{selectedCompany.name}</strong></p>

                                {/* Company Information */}
                                <div className="mb-6 p-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100">
                                    <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <Globe size={16} /> Company Information
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-gray-500 font-bold mb-1">Company Name</p>
                                            <p className="text-sm font-bold text-gray-900">{selectedCompany.name}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 font-bold mb-1">Domain</p>
                                            <p className="text-sm font-bold text-gray-900">{selectedCompany.domain || "Not Provided"}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 font-bold mb-1">Billing Email</p>
                                            <p className="text-sm font-bold text-gray-900">{selectedCompany.billingEmail}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 font-bold mb-1">Registration Date</p>
                                            <p className="text-sm font-bold text-gray-900">{new Date(selectedCompany.createdAt).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Admin Information */}
                                {selectedCompany.admins && selectedCompany.admins.length > 0 && selectedCompany.admins[0].user && (
                                    <div className="mb-6 p-6 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl border border-blue-100">
                                        <h3 className="text-sm font-bold text-blue-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <Users size={16} /> Administrator Details
                                        </h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-xs text-gray-500 font-bold mb-1">Full Name</p>
                                                <p className="text-sm font-bold text-gray-900">{selectedCompany.admins[0].user.username}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 font-bold mb-1">Role/Title</p>
                                                <p className="text-sm font-bold text-gray-900">{selectedCompany.admins[0].user.jobTitle || "Owner"}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 font-bold mb-1">Company Email</p>
                                                <p className="text-sm font-bold text-gray-900">{selectedCompany.admins[0].user.email}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 font-bold mb-1">Personal Email</p>
                                                <p className="text-sm font-bold text-gray-900">
                                                    {selectedCompany.admins[0].user.emails && selectedCompany.admins[0].user.emails.length > 0
                                                        ? selectedCompany.admins[0].user.emails[0].email
                                                        : "Not Provided"}
                                                </p>
                                            </div>
                                            <div className="col-span-2">
                                                <p className="text-xs text-gray-500 font-bold mb-1">Phone Number</p>
                                                <p className="text-sm font-bold text-gray-900">
                                                    {selectedCompany.admins[0].user.phoneCode} {selectedCompany.admins[0].user.phone || "Not Provided"}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Documents */}
                                <div className="mb-6 p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-100">
                                    <h3 className="text-sm font-bold text-green-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <FileText size={16} /> Verification Documents
                                    </h3>
                                    {selectedCompany.documents && selectedCompany.documents.length > 0 ? (
                                        <div className="space-y-2">
                                            {selectedCompany.documents.map((doc, i) => (
                                                <a
                                                    key={i}
                                                    href={`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}${doc.url}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-3 p-3 bg-white rounded-xl hover:bg-green-100 transition-colors border border-green-200"
                                                >
                                                    <ExternalLink size={16} className="text-green-600" />
                                                    <div className="flex-1">
                                                        <p className="text-sm font-bold text-gray-900">{doc.name}</p>
                                                        <p className="text-xs text-gray-500">Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}</p>
                                                    </div>
                                                </a>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-500 italic">No documents uploaded</p>
                                    )}
                                </div>

                                {/* Verification Checklist */}
                                <div className="mb-6 p-6 bg-gray-50 rounded-2xl border border-gray-200">
                                    <h4 className="font-bold text-sm text-gray-700 uppercase mb-3">Verification Checklist</h4>
                                    <div className="space-y-2">
                                        <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white rounded-lg transition-colors">
                                            <input type="checkbox" className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" />
                                            <span className="text-sm font-medium text-gray-700">Domain matches company email address</span>
                                        </label>
                                        <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white rounded-lg transition-colors">
                                            <input type="checkbox" className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" />
                                            <span className="text-sm font-medium text-gray-700">Documents appear legitimate and valid</span>
                                        </label>
                                        <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white rounded-lg transition-colors">
                                            <input type="checkbox" className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" />
                                            <span className="text-sm font-medium text-gray-700">Administrator information is complete</span>
                                        </label>
                                        <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white rounded-lg transition-colors">
                                            <input type="checkbox" className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" />
                                            <span className="text-sm font-medium text-gray-700">No red flags or suspicious activity</span>
                                        </label>
                                    </div>
                                </div>

                                {/* Rejection Reason (Optional) */}
                                <div className="mb-6">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Rejection Reason (if rejecting)</label>
                                    <textarea
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all resize-none"
                                        placeholder="Provide a detailed reason for rejection..."
                                        rows="3"
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                    />
                                </div>

                                {/* Action Buttons */}
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => handleReject(selectedCompany._id)}
                                        className="py-4 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors border-2 border-red-200"
                                    >
                                        ❌ Reject Application
                                    </button>
                                    <button
                                        onClick={() => handleApprove(selectedCompany._id)}
                                        className="py-4 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-200"
                                    >
                                        ✅ Approve & Activate
                                    </button>
                                </div>
                                <button
                                    onClick={() => { setSelectedCompany(null); setReason(""); }}
                                    className="w-full mt-4 text-gray-400 text-sm font-bold hover:text-gray-600 py-2"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default ChttrixAdminDashboard;
