import React, { useState } from 'react';
import Card from './Card';
import { Download, Trash2, PauseCircle, AlertTriangle } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

const AdvancedTab = () => {
    const { logout } = useAuth();
    const { showToast } = useToast();
    const [exporting, setExporting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showDeactivateModal, setShowDeactivateModal] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deactivating, setDeactivating] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');

    const handleExportData = async () => {
        setExporting(true);
        try {
            const response = await api.get('/api/auth/me/export', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `chttrix-data-${new Date().toISOString().split('T')[0]}.json`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            showToast('Data exported successfully', 'success');
        } catch { showToast('Export not available yet — coming soon', 'info'); }
        finally { setExporting(false); }
    };

    const handleDeactivateAccount = async () => {
        setDeactivating(true);
        try {
            await api.post('/api/auth/me/deactivate', {});
            try { await logout(); } catch { }
            window.location.href = '/login?deactivated=true';
        } catch (error) {
            showToast(error.response?.data?.message || 'Deactivation failed', 'error');
        } finally { setDeactivating(false); setShowDeactivateModal(false); }
    };

    const handleDeleteAccount = async () => {
        setDeleting(true);
        try {
            await api.delete('/api/users/me');
            showToast('Account deleted', 'success');
            setTimeout(() => { window.location.href = '/login?deleted=true'; }, 1000);
        } catch (error) {
            showToast(error.response?.data?.message || 'Deletion failed', 'error');
        } finally { setDeleting(false); setShowDeleteModal(false); }
    };

    const btnBase = "flex items-center gap-2 px-3 py-2 text-[12.5px] font-semibold rounded-lg transition-colors flex-shrink-0";

    return (
        <div className="space-y-4">
            {/* Data Export */}
            <Card title="Data Export" subtitle="Download your personal data (GDPR compliant)">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-[12.5px] text-gray-600 dark:text-gray-400 mb-2">
                            Export all personal data — profile, messages, and settings — as a JSON file.
                        </p>
                        <ul className="text-[11.5px] text-gray-400 space-y-0.5 list-disc list-inside">
                            <li>Profile information & preferences</li>
                            <li>Workspace memberships</li>
                            <li>Account activity history</li>
                        </ul>
                    </div>
                    <button onClick={handleExportData} disabled={exporting}
                        className={`${btnBase} bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50`}>
                        <Download size={13} />
                        {exporting ? 'Exporting…' : 'Export Data'}
                    </button>
                </div>
            </Card>

            {/* Deactivate */}
            <Card title="Deactivate Account" subtitle="Temporarily disable your account">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-[12.5px] text-gray-600 dark:text-gray-400 mb-1">
                            Hides your profile and pauses notifications. Your data is preserved.
                        </p>
                        <p className="text-[11.5px] text-gray-400">Reactivate anytime by logging back in.</p>
                    </div>
                    <button onClick={() => setShowDeactivateModal(true)}
                        className={`${btnBase} bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800`}>
                        <PauseCircle size={13} /> Deactivate
                    </button>
                </div>
            </Card>

            {/* Delete */}
            <Card title="Delete Account" subtitle="Permanently remove your account and all data">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle size={13} className="text-red-500 flex-shrink-0" />
                            <span className="text-[12.5px] font-bold text-red-600 dark:text-red-400">This action cannot be undone.</span>
                        </div>
                        <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-1">All messages, files, tasks, and account data will be permanently deleted.</p>
                        <p className="text-[11.5px] text-amber-600 dark:text-amber-400">Export your data first.</p>
                    </div>
                    <button onClick={() => { setDeleteConfirmText(''); setShowDeleteModal(true); }}
                        className={`${btnBase} bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800`}>
                        <Trash2 size={13} /> Delete Account
                    </button>
                </div>
            </Card>

            {/* Deactivate modal */}
            {showDeactivateModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 max-w-sm w-full shadow-xl">
                        <h3 className="text-[14px] font-bold text-gray-900 dark:text-white mb-1">Deactivate Account?</h3>
                        <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-5">
                            Your profile will be hidden. You can reactivate anytime by logging back in.
                        </p>
                        <div className="flex gap-2">
                            <button onClick={() => setShowDeactivateModal(false)} disabled={deactivating}
                                className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-[12.5px] font-semibold rounded-lg transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleDeactivateAccount} disabled={deactivating}
                                className="flex-1 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-[12.5px] font-semibold rounded-lg transition-colors disabled:opacity-50">
                                {deactivating ? 'Deactivating…' : 'Deactivate'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 max-w-sm w-full shadow-xl">
                        <div className="flex items-center gap-2.5 mb-3">
                            <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                                <AlertTriangle size={15} className="text-red-600 dark:text-red-400" />
                            </div>
                            <h3 className="text-[14px] font-bold text-gray-900 dark:text-white">Delete Account Permanently?</h3>
                        </div>
                        <p className="text-[12px] font-bold text-red-500 mb-2">⚠️ This cannot be undone.</p>
                        <ul className="text-[11.5px] text-gray-500 dark:text-gray-400 space-y-0.5 list-disc list-inside mb-4">
                            <li>All messages & conversations</li>
                            <li>Tasks, notes, and workspaces</li>
                            <li>Profile and account data</li>
                        </ul>
                        <div className="mb-4">
                            <label className="text-[10.5px] font-bold uppercase tracking-widest text-gray-500 block mb-1.5">
                                Type <span className="text-red-500 font-mono">DELETE</span> to confirm
                            </label>
                            <input
                                type="text"
                                value={deleteConfirmText}
                                onChange={e => setDeleteConfirmText(e.target.value)}
                                placeholder="DELETE"
                                className="w-full px-3 py-2 border border-red-300 dark:border-red-800 rounded-lg text-[12.5px] focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none bg-gray-50 dark:bg-gray-800 dark:text-white font-mono"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setShowDeleteModal(false)} disabled={deleting}
                                className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300 text-[12.5px] font-semibold rounded-lg transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleDeleteAccount} disabled={deleting || deleteConfirmText !== 'DELETE'}
                                className="flex-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-[12.5px] font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                {deleting ? 'Deleting…' : 'Delete Forever'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdvancedTab;
