import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { Building, Users, Mail, Loader, Shield, CheckCircle, AlertCircle, Trash2, RefreshCw } from "lucide-react";

// Components for different admin sections
const CreateCompanyForm = ({ onSuccess }) => {
    const { showToast } = useToast();
    const [name, setName] = useState("");
    const [domain, setDomain] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch("/api/companies", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("token")}`
                },
                body: JSON.stringify({ name, domain })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            showToast("Company created successfully!", "success");
            onSuccess(data.company);
        } catch (err) {
            showToast(err.message, "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
            <div className="text-center mb-8">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <Building size={24} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Create Your Organization</h2>
                <p className="text-gray-500 mt-2">Set up a dedicated space for your team to collaborate.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                        placeholder="Acme Inc."
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Domain (Optional)
                        <span className="ml-2 text-xs text-gray-400 font-normal">Auto-join for emails @domain.com</span>
                    </label>
                    <input
                        type="text"
                        value={domain}
                        onChange={(e) => setDomain(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                        placeholder="acme.com"
                    />
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                >
                    {loading ? <Loader className="animate-spin" size={20} /> : "Create Company"}
                </button>
            </form>
        </div>
    );
};

const DomainVerification = ({ companyId }) => {
    const { showToast } = useToast();
    const [status, setStatus] = useState(null); // null, loading, generated, verified
    const [tokenData, setTokenData] = useState(null);
    const [loading, setLoading] = useState(false);

    // Initial check (simulate by trying to generate/get existing status if API supported getting status directly,
    // but for now we'll just let user click Generate to start or see existing if backend returns it on create)
    // Actually typically we'd fetch company status first. simplified here.

    const generateToken = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/companies/${companyId}/domain/generate`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
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
            const res = await fetch(`/api/companies/${companyId}/domain/check`, {
                headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
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
            await fetch(`/api/companies/${companyId}/domain/clear`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
            });
            setStatus(null);
            setTokenData(null);
            showToast("Verification cleared", "success");
        } catch (e) { console.error(e); }
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-8">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Shield size={20} className="text-gray-400" />
                    Domain Verification
                </h3>
                {status === "verified" && <span className="text-green-600 font-bold flex items-center gap-1"><CheckCircle size={16} /> Verified</span>}
            </div>

            {!status && !tokenData && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">Verify your company domain to enable auto-join and specific features.</p>
                    <button onClick={generateToken} disabled={loading} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800">
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

                        <div className="bg-white border border-yellow-200 p-3 rounded-lg font-mono text-xs text-gray-700 break-all">
                            {tokenData?.instructions?.[0] || `TXT record: ${tokenData?.token}`}
                        </div>
                        <p className="text-xs text-yellow-600 mt-2">OR</p>
                        <div className="bg-white border text-gray-500 border-yellow-200 p-3 rounded-lg font-mono text-xs break-all">
                            {tokenData?.instructions?.[1]}
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

const InviteMemberForm = ({ companyId, workspaces }) => {
    const { showToast } = useToast();
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("member");
    const [workspaceId, setWorkspaceId] = useState("");
    const [loading, setLoading] = useState(false);

    const handleInvite = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch(`/api/companies/${companyId}/invite`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("token")}`
                },
                body: JSON.stringify({ email, role, workspaceId: workspaceId || null })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            showToast("Invitation sent!", "success");
            setEmail("");
        } catch (err) {
            showToast(err.message, "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-8">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Mail size={20} className="text-gray-400" />
                Invite Team Member
            </h3>
            <form onSubmit={handleInvite} className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-grow w-full">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Email Address</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="colleague@company.com"
                        required
                    />
                </div>
                <div className="w-full md:w-48">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Role</label>
                    <select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>
                <div className="w-full md:w-48">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Workspace (Opt)</label>
                    <select
                        value={workspaceId}
                        onChange={(e) => setWorkspaceId(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    >
                        <option value="">None</option>
                        {workspaces.map(ws => (
                            <option key={ws._id} value={ws._id}>{ws.name}</option>
                        ))}
                    </select>
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full md:w-auto px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                    {loading ? <Loader className="animate-spin" size={18} /> : "Send Invite"}
                </button>
            </form>
        </div>
    );
};

const CompanyAdmin = () => {
    const { user } = useAuth();
    // const [activeTab, setActiveTab] = useState("overview"); 
    const [workspaces, setWorkspaces] = useState([]);

    // Fetch workspaces for dropdown
    React.useEffect(() => {
        if (user?.companyId) {
            fetch(`/api/workspaces/${user.companyId}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            })
                .then(res => res.json())
                .then(data => {
                    if (data.workspaces) setWorkspaces(data.workspaces);
                })
                .catch(err => console.error(err));
        }
    }, [user]);

    // If no company, show create form
    if (user && !user.companyId) {
        return (
            <div className="min-h-screen bg-gray-50 pt-20 px-4">
                <CreateCompanyForm onSuccess={() => window.location.reload()} />
            </div>
        );
    }

    // Checking if not admin? (Can be handled by component usually, showing limited view)

    return (
        <div className="min-h-screen bg-gray-50 pt-20 pb-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Admin Console</h1>
                        <p className="text-gray-500 mt-1">Manage your organization settings and team.</p>
                    </div>
                    {/* Tabs / Nav can go here */}
                </div>

                {/* Domain Verification Section */}
                <DomainVerification companyId={user?.companyId} />

                {/* Invite Section */}
                <InviteMemberForm companyId={user?.companyId} workspaces={workspaces} />

                {/* Placeholder for Member List */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Users size={20} className="text-gray-400" />
                        Team Members
                    </h3>
                    <p className="text-gray-500 text-sm">Member management list will appear here.</p>
                </div>
            </div>
        </div>
    );
};

export default CompanyAdmin;
