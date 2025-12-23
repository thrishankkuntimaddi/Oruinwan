import React from 'react';
import { useToast } from "../../../../contexts/ToastContext";

const WorkspaceModals = ({
    // Rename Modal
    showRenameModal,
    setShowRenameModal,
    newName,
    setNewName,
    handleRename,
    // Invite Modal
    showInviteModal,
    setShowInviteModal,
    inviteEmail,
    setInviteEmail,
    selectedRole,
    setSelectedRole,
    isInviting,
    handleInvite,
    inviteLink,
    isGeneratingLink,
    handleGenerateLink,
    workspaceName,
    activeWorkspace
}) => {
    const { showToast } = useToast();

    // Count emails as user types
    const emailCount = inviteEmail.trim() ? inviteEmail.split(',').filter(e => e.trim()).length : 0;


    // Check if user is admin/owner (case-insensitive)
    const userRole = activeWorkspace?.role?.toLowerCase() || '';
    const isAdmin = userRole === 'admin' || userRole === 'owner';
    return (
        <>
            {/* Rename Modal */}
            {showRenameModal && (
                <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center animate-fade-in backdrop-blur-md">
                    <div className="bg-white rounded-2xl shadow-2xl w-[420px] p-8 transform transition-all scale-100 border border-gray-100">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Rename Workspace</h3>
                        <p className="text-sm text-gray-500 mb-6 leading-relaxed">Choose a new name for your team's workspace. This will be visible to everyone.</p>

                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Workspace Name</label>
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all mb-6 text-gray-900 placeholder-gray-400"
                            placeholder="e.g. Chttrix"
                            autoFocus
                        />
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowRenameModal(false)}
                                className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRename}
                                className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-md hover:shadow-lg hover:scale-[1.02] transition-all"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center animate-fade-in backdrop-blur-md p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-[650px] max-h-[90vh] overflow-hidden transform transition-all scale-100 border border-gray-100 flex flex-col">
                        {/* Header */}
                        <div className="px-8 py-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
                            <h3 className="text-2xl font-bold text-gray-900">Invite people to {workspaceName}</h3>
                            <p className="text-gray-600 mt-1">Bring your team together to collaborate and chat.</p>
                        </div>

                        {/* Scrollable Content */}
                        <div className="p-8 space-y-6 overflow-y-auto flex-1">
                            {/* Invite Link Section */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                                    📎 Shareable Invitation Link
                                </label>

                                {inviteLink ? (
                                    <div className="space-y-2">
                                        <div className="flex gap-2">
                                            <div className="flex-1 bg-green-50 border-2 border-green-200 rounded-xl px-4 py-3 text-green-700 font-mono text-sm flex items-center break-all">
                                                {inviteLink}
                                            </div>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(inviteLink);
                                                    showToast("✅ Link copied to clipboard!", "success");
                                                }}
                                                className="px-6 py-2 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-all shadow-sm hover:shadow flex items-center gap-2 flex-shrink-0"
                                            >
                                                📋 Copy
                                            </button>
                                        </div>
                                        <p className="text-xs text-green-600 font-medium">✅ Link ready! Copy and share with your team.</p>
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleGenerateLink}
                                        disabled={isGeneratingLink}
                                        className="w-full px-4 py-3 bg-blue-50 border-2 border-blue-200 text-blue-700 font-bold rounded-xl hover:bg-blue-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isGeneratingLink ? (
                                            <>
                                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                </svg>
                                                Generating...
                                            </>
                                        ) : (
                                            <>🔗 Generate Invitation Link</>
                                        )}
                                    </button>
                                )}
                                <p className="text-xs text-gray-500 mt-2">💡 Perfect for when email isn't configured - just copy and share!</p>
                            </div>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-200"></div>
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-3 bg-white text-gray-500 font-medium">OR</span>
                                </div>
                            </div>

                            {/* Email Input - Now textarea for bulk support */}
                            <div className="mb-6">
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                                    Email Addresses {emailCount > 0 && <span className="text-blue-600">({emailCount} recipient{emailCount > 1 ? 's' : ''})</span>}
                                </label>
                                <textarea
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    rows={3}
                                    disabled={isInviting}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                                    placeholder="user1@example.com, user2@example.com, user3@example.com"
                                />
                                <p className="text-xs text-gray-500 mt-2">💡 Separate multiple emails with commas</p>
                            </div>

                            {/* Role Selection - Only for admins */}
                            {isAdmin && (
                                <div className="mb-6">
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                                        Role
                                    </label>
                                    <select
                                        value={selectedRole}
                                        onChange={(e) => setSelectedRole(e.target.value)}
                                        disabled={isInviting}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <option value="member">Member - Can view and participate</option>
                                        <option value="admin">Admin - Can manage workspace and invite others</option>
                                    </select>
                                    <p className="text-xs text-gray-500 mt-2">
                                        {selectedRole === 'admin' ? '👑 Admins can manage workspace settings' : '👤 Members can participate in channels'}
                                    </p>
                                </div>
                            )}

                            {/* Info Section */}
                            <div className="bg-blue-50/50 rounded-xl p-5 border border-blue-100">
                                <h4 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                                    <span>ℹ️</span> How it works
                                </h4>
                                <ul className="text-sm text-blue-800 space-y-1.5 opacity-90">
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-600 mt-0.5">•</span>
                                        <span>Invitations are sent via email with a secure join link</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-600 mt-0.5">•</span>
                                        <span>Links expire in 7 days for security</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-600 mt-0.5">•</span>
                                        <span>Recipients will be added as {selectedRole || 'member'}s</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-8 py-5 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
                            <button
                                onClick={() => setShowInviteModal(false)}
                                disabled={isInviting}
                                className="px-6 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleInvite}
                                disabled={isInviting || !inviteEmail.trim()}
                                className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-md hover:shadow-lg transition-all transform active:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
                            >
                                {isInviting ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Sending...
                                    </>
                                ) : (
                                    <>Send Invitation{emailCount > 1 ? 's' : ''}</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default WorkspaceModals;
