import React, { useState } from 'react';
import Card from './Card';
import { Download, Trash2, PauseCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import Button from '../../shared/components/ui/Button';

/**
 * AdvancedTab - Account management and data controls
 * Fixed: replaced alert() with useToast, replaced window.dispatchEvent with useToast
 */
const AdvancedTab = () => {
    const { logout } = useAuth();
    const { showToast } = useToast();
    const [exporting, setExporting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showDeactivateModal, setShowDeactivateModal] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deactivating, setDeactivating] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');

    // Export user data (GDPR compliance)
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
        } catch (error) {
            console.error('Export failed:', error);
            showToast('Export not available yet — coming soon', 'info');
        } finally {
            setExporting(false);
        }
    };

    // Deactivate account (temporary)
    const handleDeactivateAccount = async () => {
        setDeactivating(true);
        try {
            await api.post('/api/auth/me/deactivate', {});
            showToast('Account deactivated', 'success');
            try { await logout(); } catch (_) { }
            window.location.href = '/login?deactivated=true';
        } catch (error) {
            console.error('Deactivate failed:', error);
            showToast(error.response?.data?.message || 'Deactivation failed. Please try again.', 'error');
        } finally {
            setDeactivating(false);
            setShowDeactivateModal(false);
        }
    };

    // Delete account permanently
    const handleDeleteAccount = async () => {
        setDeleting(true);
        try {
            await api.delete('/api/users/me');
            showToast('Account deleted', 'success');
            setTimeout(() => { window.location.href = '/login?deleted=true'; }, 1000);
        } catch (error) {
            console.error('Delete failed:', error);
            showToast(error.response?.data?.message || 'Deletion failed. Please try again.', 'error');
        } finally {
            setDeleting(false);
            setShowDeleteModal(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Data Export */}
            <Card title="Data Export" subtitle="Download a copy of your personal data (GDPR compliant)">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-5">
                    <div className="flex-1">
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                            Export all your personal data — profile info, messages, and account settings — in JSON format.
                        </p>
                        <ul className="text-xs text-slate-500 dark:text-slate-500 space-y-1 list-disc list-inside">
                            <li>Profile information and preferences</li>
                            <li>Workspace memberships</li>
                            <li>Channel subscriptions</li>
                            <li>Account activity history</li>
                        </ul>
                    </div>
                    <Button onClick={handleExportData} disabled={exporting} isLoading={exporting} icon={<Download size={16} />}>
                        Export Data
                    </Button>
                </div>
            </Card>

            {/* Deactivate */}
            <Card title="Deactivate Account" subtitle="Temporarily disable your account — you can reactivate anytime">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-5">
                    <div className="flex-1">
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                            Deactivating hides your profile and pauses all notifications. Your data is preserved.
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-500">
                            Reactivate by logging back in with your credentials.
                        </p>
                    </div>
                    <Button onClick={() => setShowDeactivateModal(true)} variant="warning" icon={<PauseCircle size={16} />}>
                        Deactivate
                    </Button>
                </div>
            </Card>

            {/* Delete Account */}
            <Card title="Delete Account" subtitle="Permanently remove your account and all associated data">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-5">
                    <div className="flex-1">
                        <div className="flex items-start gap-2 mb-3">
                            <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
                            <p className="text-sm font-bold text-red-600 dark:text-red-400">This action is permanent and cannot be undone.</p>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                            All messages, files, tasks, notes, and account data will be deleted forever.
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                            Tip: Export your data first from the section above.
                        </p>
                    </div>
                    <Button onClick={() => { setDeleteConfirmText(''); setShowDeleteModal(true); }} variant="danger" icon={<Trash2 size={16} />}>
                        Delete Account
                    </Button>
                </div>
            </Card>

            {/* Deactivate Confirmation Modal */}
            {showDeactivateModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-[#0B0F19] rounded-2xl p-6 max-w-md w-full shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 bg-amber-100 dark:bg-amber-900/20 rounded-xl">
                                <PauseCircle className="text-amber-600 dark:text-amber-400" size={22} />
                            </div>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white">Deactivate Account?</h3>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                            Your profile will be hidden and you won't receive any notifications. You can reactivate anytime by logging back in.
                        </p>
                        <div className="flex gap-3">
                            <Button variant="secondary" onClick={() => setShowDeactivateModal(false)} className="flex-1" disabled={deactivating}>
                                Cancel
                            </Button>
                            <Button onClick={handleDeactivateAccount} className="flex-1" variant="warning" isLoading={deactivating} disabled={deactivating}>
                                Deactivate
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal — requires typing DELETE */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-[#0B0F19] rounded-2xl p-6 max-w-md w-full shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 bg-red-100 dark:bg-red-900/20 rounded-xl">
                                <AlertTriangle className="text-red-600 dark:text-red-400" size={22} />
                            </div>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white">Delete Account Permanently?</h3>
                        </div>
                        <div className="mb-5 space-y-3">
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                All your data will be permanently deleted, including:
                            </p>
                            <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1 list-disc list-inside pl-2">
                                <li>Messages and DM conversations</li>
                                <li>Tasks, notes, and canvases</li>
                                <li>Workspaces you created</li>
                                <li>Profile and account information</li>
                            </ul>
                            <div className="pt-2">
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1.5">
                                    Type <span className="text-red-500 font-mono">DELETE</span> to confirm
                                </label>
                                <input
                                    type="text"
                                    value={deleteConfirmText}
                                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                                    placeholder="DELETE"
                                    className="w-full px-3 py-2 border border-red-300 dark:border-red-800 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none bg-white dark:bg-[#111827] dark:text-white font-mono"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="secondary" onClick={() => setShowDeleteModal(false)} className="flex-1" disabled={deleting}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleDeleteAccount}
                                disabled={deleting || deleteConfirmText !== 'DELETE'}
                                isLoading={deleting}
                                variant="danger"
                                className="flex-1"
                            >
                                Delete Forever
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdvancedTab;
