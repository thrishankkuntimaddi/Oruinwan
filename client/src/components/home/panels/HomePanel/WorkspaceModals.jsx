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
    handleInvite,
    workspaceName
}) => {
    const { showToast } = useToast();
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
                <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center animate-fade-in backdrop-blur-md">
                    <div className="bg-white rounded-2xl shadow-2xl w-[600px] overflow-hidden transform transition-all scale-100 border border-gray-100">
                        {/* Header */}
                        <div className="px-8 py-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                            <h3 className="text-2xl font-bold text-gray-900">Invite people to {workspaceName}</h3>
                            <p className="text-gray-500 mt-1">Bring your team together to collaborate and chat.</p>
                        </div>

                        <div className="p-8">
                            {/* Invite Link Section */}
                            <div className="mb-8">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Invite Link</label>
                                <div className="flex gap-2">
                                    <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-600 font-mono text-sm flex items-center select-all shadow-inner">
                                        https://chttrix.com/invite/{workspaceName.toLowerCase().replace(/\s+/g, '-')}-{Math.random().toString(36).substr(2, 6)}
                                    </div>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(`https://chttrix.com/invite/${workspaceName.toLowerCase().replace(/\s+/g, '-')}`);
                                            showToast("Link copied to clipboard!");
                                        }}
                                        className="px-6 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm hover:shadow active:scale-95"
                                    >
                                        Copy
                                    </button>
                                </div>
                                <p className="text-xs text-gray-400 mt-2">This link expires in 7 days.</p>
                            </div>

                            {/* Email Invite Section */}
                            <div className="mb-8">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Send via Email</label>
                                <input
                                    type="email"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                    placeholder="name@example.com, colleague@work.com"
                                />
                            </div>

                            {/* Rules / Info Section */}
                            <div className="bg-blue-50/50 rounded-xl p-5 border border-blue-100">
                                <h4 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                                    <span>ℹ️</span> Quick Rules
                                </h4>
                                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside opacity-80">
                                    <li>Be kind and respectful to everyone.</li>
                                    <li>Keep conversations relevant to the channels.</li>
                                    <li>No spamming or sharing sensitive info.</li>
                                </ul>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-8 py-5 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                            <button
                                onClick={() => setShowInviteModal(false)}
                                className="px-6 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleInvite}
                                className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-md hover:shadow-lg transition-all transform active:scale-[1.02]"
                            >
                                Send Invitations
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default WorkspaceModals;
