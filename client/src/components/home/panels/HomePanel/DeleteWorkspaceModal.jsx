import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useToast } from "../../../../contexts/ToastContext";
import api from '../../../../services/api';

const DeleteWorkspaceModal = ({
    showDeleteConfirm,
    setShowDeleteConfirm,
    workspaceName,
    deleteVerification,
    setDeleteVerification,
    setShowSettingsModal
}) => {
    const { workspaceId } = useParams();
    const { showToast } = useToast();
    const [deleting, setDeleting] = useState(false);

    const handleDeleteWorkspace = async () => {
        // Verify workspace name matches (Case Insensitive)
        if (deleteVerification.toLowerCase() !== workspaceName.toLowerCase()) {
            showToast('Workspace name does not match', 'error');
            return;
        }

        setDeleting(true);

        try {
            console.log('=== DELETE WORKSPACE DEBUG ===');
            console.log('workspaceId from params:', workspaceId);
            console.log('workspaceName:', workspaceName);
            console.log('Full URL will be:', `/api/workspaces/${workspaceId}`);

            const response = await api.delete(`/api/workspaces/${workspaceId}`);

            console.log('Delete successful:', response.data);

            // Success!
            showToast(`Workspace "${workspaceName}" has been deleted.`, 'success');
            setShowDeleteConfirm(false);
            setShowSettingsModal(false);
            setDeleteVerification('');

            // Redirect to workspaces list - FORCE RELOAD to clear context
            window.location.href = '/workspaces';
        } catch (err) {
            console.error('Delete workspace error:', err);
            showToast(err.response?.data?.message || err.message || 'Failed to delete workspace', 'error');
        } finally {
            setDeleting(false);
        }
    };

    if (!showDeleteConfirm) return null;

    return (
        <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center animate-fade-in backdrop-blur-md">
            <div className="bg-white rounded-2xl shadow-2xl w-[480px] p-8 transform transition-all scale-100 border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500"></div>

                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">Delete Workspace?</h3>
                        <p className="text-sm text-gray-500">This action is permanent.</p>
                    </div>
                </div>

                <p className="text-sm text-gray-600 mb-6 leading-relaxed bg-red-50 p-4 rounded-xl border border-red-100">
                    You are about to permanently delete <strong>{workspaceName}</strong>. This action <strong>cannot</strong> be undone. All channels, messages, and files will be irretrievably lost.
                </p>

                <div className="mb-8">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                        To confirm, type <span className="text-gray-900 select-all font-mono bg-gray-100 px-1 rounded">{workspaceName}</span> below:
                    </label>
                    <input
                        type="text"
                        value={deleteVerification}
                        onChange={(e) => setDeleteVerification(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 font-mono text-sm transition-all"
                        placeholder={workspaceName}
                        autoFocus
                    />
                </div>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={() => { setShowDeleteConfirm(false); setDeleteVerification(""); }}
                        className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleDeleteWorkspace}
                        disabled={deleteVerification.toLowerCase() !== workspaceName.toLowerCase() || deleting}
                        className={`px-5 py-2.5 text-sm font-bold text-white rounded-xl shadow-md transition-all ${deleteVerification.toLowerCase() === workspaceName.toLowerCase() && !deleting
                            ? "bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 hover:shadow-lg hover:scale-[1.02]"
                            : "bg-gray-300 cursor-not-allowed"
                            }`}
                    >
                        {deleting ? 'Deleting...' : 'Delete Workspace'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeleteWorkspaceModal;
