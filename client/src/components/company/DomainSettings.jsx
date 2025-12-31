import React, { useState } from "react";
import { Shield, CheckCircle, AlertCircle, RefreshCw, Trash2, Loader } from "lucide-react";
import { useToast } from "../../contexts/ToastContext";

const API_BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const DomainSettings = ({ companyId }) => {
    const { showToast } = useToast();
    const [status, setStatus] = useState(null); // null, loading, generated, verified
    const [tokenData, setTokenData] = useState(null);
    const [loading, setLoading] = useState(false);

    const generateToken = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/companies/${companyId}/domain/generate`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${localStorage.getItem("accessToken")}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setTokenData(data);
            setStatus("generated");
            showToast("Verification token generated", "success");
        } catch (err) {
            showToast(err.message, "error");
        } finally {
            setLoading(false);
        }
    };

    const checkVerification = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/companies/${companyId}/domain/verify`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${localStorage.getItem("accessToken")}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            if (data.domainVerified) {
                setStatus("verified");
                showToast("Domain verified successfully!", "success");
            } else {
                showToast("Token not found yet. DNS changes can take time.", "info");
            }
        } catch (err) {
            showToast(err.message, "error");
        } finally {
            setLoading(false);
        }
    };

    const clearVerification = async () => {
        if (!window.confirm("Are you sure? This will remove the verification token.")) return;
        try {
            await fetch(`${API_BASE}/api/companies/${companyId}/domain/clear`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${localStorage.getItem("accessToken")}` }
            });
            setStatus(null);
            setTokenData(null);
            showToast("Verification cleared", "success");
        } catch (e) { console.error(e); }
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Shield size={20} className="text-gray-400" />
                    Domain Verification
                </h3>
                {status === "verified" && <span className="text-green-600 font-bold flex items-center gap-1"><CheckCircle size={16} /> Verified</span>}
            </div>

            {!status && !tokenData && (
                <div className="flex items-center justify-between">
                    <div className="pr-4">
                        <p className="text-sm text-gray-500">Verify your company domain to enable auto-join functionality.</p>
                        <p className="text-xs text-gray-400 mt-1">Users with @yourdomain.com will automatically join your company.</p>
                    </div>
                    <button onClick={generateToken} disabled={loading} className="shrink-0 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800">
                        {loading ? <Loader className="animate-spin" size={16} /> : "Verify Domain"}
                    </button>
                </div>
            )}

            {(status === "generated" || tokenData) && status !== "verified" && (
                <div className="space-y-4 animate-fade-in">
                    <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-xl">
                        <h4 className="font-bold text-yellow-800 flex items-center gap-2 mb-2">
                            <AlertCircle size={16} /> DNS Configuration Required
                        </h4>
                        <p className="text-sm text-yellow-700 mb-3">Add the following TXT record to your DNS settings:</p>

                        <div className="bg-white border border-yellow-200 p-3 rounded-lg font-mono text-xs text-gray-700 break-all select-all cursor-pointer hover:bg-gray-50 transition-colors" title="Click to copy" onClick={() => { navigator.clipboard.writeText(tokenData?.instructions?.[0] || tokenData?.token); showToast("Copied to clipboard", "success") }}>
                            {tokenData?.instructions?.[0] || `TXT record: ${tokenData?.token}`}
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={checkVerification} disabled={loading} className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium flex items-center justify-center gap-2">
                            {loading ? <Loader className="animate-spin" size={16} /> : <><RefreshCw size={16} /> Check Status</>}
                        </button>
                        <button onClick={clearVerification} className="px-4 py-2 bg-white border border-gray-200 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            )}

            {status === "verified" && (
                <div className="bg-green-50 border border-green-100 p-4 rounded-xl flex items-center gap-3">
                    <div className="bg-green-100 p-2 rounded-full text-green-600">
                        <CheckCircle size={20} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-green-800">Domain Successfully Verified</p>
                        <p className="text-xs text-green-600">Employees with this email domain can now auto-join.</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DomainSettings;
