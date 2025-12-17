import React, { useState } from "react";
import { X, Link as LinkIcon, Mail, Copy, Check, Send } from "lucide-react";

const InvitePeopleModal = ({ isOpen, onClose, workspaceId, workspaceName }) => {
    const [inviteMethod, setInviteMethod] = useState("link"); // "link" or "email"
    const [emails, setEmails] = useState("");
    const [loading, setLoading] = useState(false);
    const [inviteLink, setInviteLink] = useState(null);
    const [copied, setCopied] = useState(false);
    const [sent, setSent] = useState(false);

    if (!isOpen) return null;

    const handleGenerateLink = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`/api/workspaces/${workspaceId}/invite`, {
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
            alert(err.message);
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
            alert('Please enter at least one email address');
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`/api/workspaces/${workspaceId}/invite`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    emails,
                    inviteType: 'email',
                    role: 'member'
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to send invites');
            }

            setSent(true);
            setTimeout(() => {
                setSent(false);
                setEmails("");
                onClose();
            }, 2000);
        } catch (err) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-[550px] max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">Invite People</h2>
                            <p className="text-sm text-gray-500 mt-1">to {workspaceName}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* Method Selector */}
                <div className="p-6 border-b border-gray-100">
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setInviteMethod("link")}
                            className={`p-4 rounded-xl border-2 transition-all ${inviteMethod === "link"
                                    ? "border-blue-500 bg-blue-50 text-blue-700"
                                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                                }`}
                        >
                            <LinkIcon className="w-6 h-6 mx-auto mb-2" />
                            <p className="font-semibold text-sm">Invite Link</p>
                            <p className="text-xs opacity-70 mt-1">One-time use link</p>
                        </button>
                        <button
                            onClick={() => setInviteMethod("email")}
                            className={`p-4 rounded-xl border-2 transition-all ${inviteMethod === "email"
                                    ? "border-blue-500 bg-blue-50 text-blue-700"
                                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                                }`}
                        >
                            <Mail className="w-6 h-6 mx-auto mb-2" />
                            <p className="font-semibold text-sm">Send via Email</p>
                            <p className="text-xs opacity-70 mt-1">Enter email addresses</p>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto">
                    {inviteMethod === "link" ? (
                        <div className="space-y-4">
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                <p className="text-sm text-yellow-800">
                                    <strong>⚠️ Important:</strong> This link can only be used <strong>once</strong> to prevent spam and unauthorized access.
                                </p>
                            </div>

                            {!inviteLink ? (
                                <button
                                    onClick={handleGenerateLink}
                                    disabled={loading}
                                    className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>Generating...</>
                                    ) : (
                                        <>
                                            <LinkIcon className="w-5 h-5" />
                                            Generate Invite Link
                                        </>
                                    )}
                                </button>
                            ) : (
                                <div className="space-y-3">
                                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                        <p className="text-sm text-gray-600 mb-2 font-medium">Your invite link:</p>
                                        <p className="text-xs text-gray-700 break-all font-mono bg-white p-3 rounded border border-gray-200">
                                            {inviteLink}
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleCopyLink}
                                        className={`w-full py-3 font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${copied
                                                ? "bg-green-600 text-white"
                                                : "bg-blue-600 text-white hover:bg-blue-700"
                                            }`}
                                    >
                                        {copied ? (
                                            <>
                                                <Check className="w-5 h-5" />
                                                Copied!
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-5 h-5" />
                                                Copy Link
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Email Addresses
                                </label>
                                <textarea
                                    value={emails}
                                    onChange={(e) => setEmails(e.target.value)}
                                    placeholder="user1@example.com, user2@example.com"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all h-32 resize-none"
                                />
                                <p className="text-xs text-gray-500 mt-2">
                                    Separate multiple email addresses with commas
                                </p>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <p className="text-sm text-blue-800">
                                    Each recipient will receive a unique one-time invitation link via email.
                                </p>
                            </div>

                            <button
                                onClick={handleSendEmails}
                                disabled={loading || !emails.trim()}
                                className={`w-full py-3 font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${sent
                                        ? "bg-green-600 text-white"
                                        : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    }`}
                            >
                                {loading ? (
                                    <>Sending...</>
                                ) : sent ? (
                                    <>
                                        <Check className="w-5 h-5" />
                                        Invitations Sent!
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-5 h-5" />
                                        Send Invitations
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InvitePeopleModal;
