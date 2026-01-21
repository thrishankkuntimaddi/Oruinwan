import React from 'react';
import InvitePeopleModal from "../../../InvitePeopleModal";

const WorkspaceModals = ({
    // Rename Modal
    showRenameModal,
    setShowRenameModal,
    newName,
    setNewName,
    handleRename,
    // Invite Modal props passed through to InvitePeopleModal
    showInviteModal,
    setShowInviteModal,
    workspaceName,
    activeWorkspace
}) => {
    // Unused variables removed for cleaner code

    return (
        <>
            {/* Rename Modal */}
            {showRenameModal && (
                <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center animate-fade-in backdrop-blur-md">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-[420px] p-8 transform transition-all scale-100 border border-gray-100 dark:border-gray-700">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Rename Workspace</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">Choose a new name for your team's workspace. This will be visible to everyone.</p>

                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Workspace Name</label>
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all mb-6 text-gray-900 dark:text-white placeholder-gray-400"
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

            {/* Invite Modal - Now using the polished horizontal component */}
            <InvitePeopleModal
                isOpen={showInviteModal}
                onClose={() => setShowInviteModal(false)}
                workspaceId={activeWorkspace?.id}
                workspaceName={workspaceName}
            />
        </>
    );
};

export default WorkspaceModals;
