import React, { useState, useEffect } from "react";
import { X, Link as LinkIcon, Mail, Copy, Check, Send, AlertCircle } from "lucide-react";
import { useToast } from "../contexts/ToastContext";

// Use backend URL for production (Vercel frontend + separate backend)
const API_BASE = import.meta.env.VITE_BACKEND_URL || '';

/**
 * InvitePeopleModal - Complete Admin Invite Management
 * 
 * Sections:
 * A. Email Invites (Primary)
 * B. Link Invites (Secondary)
 * C. Pending Invites (Admin-only list with revoke)
 */
const InvitePeopleModal = ({ isOpen, onClose, workspaceId, workspaceName }) => {
    const { showToast } = useToast();

    // Tab state
    const [inviteMethod, setInviteMethod] = useState("email"); // "link" or "email"

    // Email invite state
    const [emails, setEmails] = useState("");
    const [role, setRole] = useState("member"); // "member" or "admin"

    // Link invite state
    const [inviteLink, setInviteLink] = useState(null);
    const [copied, setCopied] = useState(false);

    // Pending invites state (Section C)
    const [pendingInvites, setPendingInvites] = useState([]);
    // loadingInvites removed as per unused var warning

    // Loading states
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    // 🔒 ADMIN-ONLY: Fetch pending invites when modal opens
    useEffect(() => {
        if (!isOpen || !workspaceId) return;

        const fetchPendingInvites = async () => {
            // Loading state removed
            try {
                const token = localStorage.getItem('accessToken');
                const response = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/invites`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    setPendingInvites(data.pending || []);
                }
            } catch (err) {
                console.error('Failed to fetch invites:', err);
            }
        };

        fetchPendingInvites();
    }, [isOpen, workspaceId]);

    if (!isOpen) return null;

    const handleGenerateLink = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/invite`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    inviteType: 'link',
                    role: 'member'
                })
            });

            if (!response.ok) {
                throw new Error('Failed to generate invite link');
            }

            const data = await response.json();
            setInviteLink(data.inviteLink);
        } catch (err) {
            showToast(err.message || 'Failed to generate invite link', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCopyLink = () => {
        if (inviteLink) {
            navigator.clipboard.writeText(inviteLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleSendEmails = async () => {
        if (!emails.trim()) {
            showToast('Please enter at least one email address', 'warning');
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/invite`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    emails,
                    inviteType: 'email',
                    role // Use selected role
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to send invites');
            }

            setSent(true);
            showToast('Invitations sent successfully!', 'success');

            // Refresh pending invites
            const refreshResponse = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/invites`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (refreshResponse.ok) {
                const data = await refreshResponse.json();
                setPendingInvites(data.pending || []);
            }

            setTimeout(() => {
                setSent(false);
                setEmails("");
            }, 2000);
        } catch (err) {
            showToast(err.message || 'Failed to send invites', 'error');
        } finally {
            setLoading(false);
        }
    };

    // 🔒 ADMIN-ONLY: Revoke invite handler
    const handleRevokeInvite = async (inviteId) => {
        if (!window.confirm('Are you sure you want to revoke this invite?')) return;

        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(
                `${API_BASE}/api/workspaces/${workspaceId}/invites/${inviteId}/revoke`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ reason: 'Revoked by admin' })
                }
            );

            if (!response.ok) {
                throw new Error('Failed to revoke invite');
            }

            // Remove from list
            setPendingInvites(prev => prev.filter(inv => inv._id !== inviteId));
            showToast('Invite revoked successfully', 'success');
        } catch (err) {
            showToast(err.message || 'Failed to revoke invite', 'error');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center backdrop-blur-sm animate-fade-in p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col md:flex-row border border-gray-100 dark:border-gray-800">

                {/* LEFT SIDEBAR - Navigation */}
                <div className="w-full md:w-64 bg-gray-50 dark:bg-gray-800/50 border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-800 flex flex-col flex-shrink-0">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Invite People</h2>
                        <p className="text-xs text-gray-500 mt-1 truncate">to {workspaceName}</p>
                    </div>

                    <div className="p-4 space-y-2 flex-1 overflow-y-auto">
                        <div className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-2 mb-2">Invite Via</div>
                        <button
                            onClick={() => setInviteMethod("email")}
                            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${inviteMethod === "email"
                                ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-md ring-1 ring-black/5 dark:ring-white/5"
                                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200"
                                }`}
                        >
                            <div className={`p-2 rounded-lg ${inviteMethod === "email" ? "bg-blue-50 dark:bg-blue-900/30" : "bg-gray-100 dark:bg-gray-800"}`}>
                                <Mail className="w-4 h-4" />
                            </div>
                            <span className="flex-1 text-left">Email Address</span>
                        </button>

                        <button
                            onClick={() => setInviteMethod("link")}
                            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${inviteMethod === "link"
                                ? "bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-md ring-1 ring-black/5 dark:ring-white/5"
                                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200"
                                }`}
                        >
                            <div className={`p-2 rounded-lg ${inviteMethod === "link" ? "bg-purple-50 dark:bg-purple-900/30" : "bg-gray-100 dark:bg-gray-800"}`}>
                                <LinkIcon className="w-4 h-4" />
                            </div>
                            <span className="flex-1 text-left">Shareable Link</span>
                        </button>

                        {/* Admin Section Divider */}
                        {pendingInvites.length > 0 && (
                            <>
                                <div className="h-px bg-gray-200 dark:bg-gray-700 my-4 mx-2"></div>
                                <div className="flex items-center justify-between px-2 mb-2">
                                    <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Pending</span>
                                    <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingInvites.length}</span>
                                </div>

                                <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                    {pendingInvites.map(invite => {
                                        const inviteId = invite._id || invite.id;
                                        return (
                                            <div key={inviteId} className="group flex items-center justify-between p-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 hover:shadow-sm border border-transparent hover:border-gray-100 dark:hover:border-gray-600 transition-all">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate max-w-[120px]">
                                                        {invite.email || 'Link invite'}
                                                    </p>
                                                    <p className="text-[10px] text-gray-400 dark:text-gray-500">
                                                        {invite.role}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleRevokeInvite(inviteId); }}
                                                    className="opacity-0 group-hover:opacity-100 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 p-1 rounded-md transition-all"
                                                    title="Revoke"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* RIGHT CONTENT - Forms */}
                <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-gray-900 relative">
                    {/* Close Button Absolute */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors z-10"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="p-8 h-full overflow-y-auto">
                        {inviteMethod === "email" ? (
                            <div className="space-y-6 max-w-lg mx-auto pt-4 animate-fade-in">
                                <div className="text-center mb-6">
                                    <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                        <Mail className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Invite by Email</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Send invitations directly to their inbox</p>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
                                        Email Addresses
                                    </label>
                                    <textarea
                                        value={emails}
                                        onChange={(e) => setEmails(e.target.value)}
                                        placeholder="colleague@example.com, partner@agency.com"
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:bg-white dark:focus:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white transition-all h-32 resize-none text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500"
                                    />
                                    <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        Comma separated emails
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
                                        Assign Role
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => setRole("member")}
                                            className={`p-3 rounded-xl border-2 text-left transition-all relative ${role === "member" ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20" : "border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700"}`}
                                        >
                                            {role === "member" && <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full"></div>}
                                            <span className="block text-sm font-bold text-gray-900 dark:text-white mb-0.5">Member</span>
                                            <span className="block text-xs text-gray-500 dark:text-gray-400">Can view and participate</span>
                                        </button>
                                        <button
                                            onClick={() => setRole("admin")}
                                            className={`p-3 rounded-xl border-2 text-left transition-all relative ${role === "admin" ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20" : "border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700"}`}
                                        >
                                            {role === "admin" && <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full"></div>}
                                            <span className="block text-sm font-bold text-gray-900 dark:text-white mb-0.5">Admin</span>
                                            <span className="block text-xs text-gray-500 dark:text-gray-400">Full workspace access</span>
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={handleSendEmails}
                                    disabled={loading || !emails.trim()}
                                    className={`w-full py-3.5 font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 ${sent
                                        ? "bg-green-500 text-white"
                                        : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                                        }`}
                                >
                                    {loading ? (
                                        <>Sending...</>
                                    ) : sent ? (
                                        <>
                                            <Check className="w-5 h-5" />
                                            Sent Successfully
                                        </>
                                    ) : (
                                        <>
                                            Send Invitations
                                            <Send className="w-4 h-4" />
                                        </>
                                    )}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6 max-w-lg mx-auto pt-4 animate-fade-in">
                                <div className="text-center mb-8">
                                    <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                        <LinkIcon className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Share Invite Link</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Anyone with this link can join instantly</p>
                                </div>

                                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-900/30 rounded-xl p-4 flex gap-3 items-start">
                                    <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-yellow-800 dark:text-yellow-200 leading-relaxed">
                                        For security, this link is valid for <strong>one-time use</strong> only. Create a new link for each person you want to invite.
                                    </p>
                                </div>

                                {!inviteLink ? (
                                    <button
                                        onClick={handleGenerateLink}
                                        disabled={loading}
                                        className="w-full py-4 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-all shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {loading ? (
                                            <>Generating...</>
                                        ) : (
                                            <>
                                                <LinkIcon className="w-5 h-5" />
                                                Generate New Link
                                            </>
                                        )}
                                    </button>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="relative">
                                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                                                Your Invite Link
                                            </label>
                                            <div className="flex bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden p-1">
                                                <div className="flex-1 p-2 font-mono text-sm text-gray-600 dark:text-gray-300 truncate flex items-center select-all">
                                                    {inviteLink}
                                                </div>
                                                <button
                                                    onClick={handleCopyLink}
                                                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${copied
                                                        ? "bg-green-500 text-white"
                                                        : "bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500 shadow-sm"
                                                        }`}
                                                >
                                                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                                    {copied ? "Copied" : "Copy"}
                                                </button>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => setInviteLink(null)}
                                            className="w-full py-3 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                                        >
                                            Generate a different link
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InvitePeopleModal;
