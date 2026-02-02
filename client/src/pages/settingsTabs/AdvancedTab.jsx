import React, { useState } from 'react';
import Card from './Card';
import { Download, Trash2, PauseCircle, AlertTriangle, Loader } from 'lucide-react';
import axios from 'axios';

/**
 * AdvancedTab - Account management and data controls
 */
const AdvancedTab = () => {
    const [exporting, setExporting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showDeactivateModal, setShowDeactivateModal] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Export user data (GDPR compliance)
    const handleExportData = async () => {
        setExporting(true);
        try {
            const response = await axios.get('/api/auth/me/export', {
                responseType: 'blob',
                withCredentials: true
            });

            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `chttrix-data-${new Date().toISOString().split('T')[0]}.json`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            const event = new CustomEvent('show-toast', { detail: { message: 'Data exported successfully', type: 'success' } });
            window.dispatchEvent(event);
        } catch (error) {
            console.error('Export failed:', error);
            const event = new CustomEvent('show-toast', { detail: { message: 'Export failed. Feature coming soon.', type: 'info' } });
            window.dispatchEvent(event);
        } finally {
            setExporting(false);
        }
    };

    // Deactivate account (temporary)
    const handleDeactivateAccount = async () => {
        try {
            await axios.post('/api/auth/me/deactivate', {}, { withCredentials: true });
            window.location.href = '/login';
        } catch (error) {
            console.error('Deactivate failed:', error);
            alert('Deactivation failed. Please contact support.');
        }
        setShowDeactivateModal(false);
    };

    // Delete account permanently
    const handleDeleteAccount = async () => {
        if (!window.confirm('Are you sure you want to permanently delete your account? This action cannot be undone!')) {
            return;
        }

        setDeleting(true);
        try {
            await axios.delete('/api/users/me', { withCredentials: true });

            // Show success message and logout
            const event = new CustomEvent('show-toast', {
                detail: { message: 'Account deleted successfully', type: 'success' }
            });
            window.dispatchEvent(event);

            // Redirect to login after a short delay
            setTimeout(() => {
                window.location.href = '/login?deleted=true';
            }, 1000);
        } catch (error) {
            console.error('Delete failed:', error);
            const errorMsg = error.response?.data?.message || 'Deletion failed. Please try again.';
            const event = new CustomEvent('show-toast', {
                detail: { message: errorMsg, type: 'error' }
            });
            window.dispatchEvent(event);
        } finally {
            setDeleting(false);
            setShowDeleteModal(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            <Card title="Data Export" subtitle="Download your account data (GDPR compliant)">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                            Export all your personal data, messages, and activity in JSON format. This includes your profile, messages, and settings.
                        </p>
                        <ul className="text-xs text-slate-500 dark:text-slate-500 space-y-1 list-disc list-inside">
                            <li>Profile information and settings</li>
                            <li>Message history (encrypted)</li>
                            <li>Workspace memberships</li>
                            <li>Channel subscriptions</li>
                        </ul>
                    </div>
                    <button
                        onClick={handleExportData}
                        disabled={exporting}
                        className="ml-4 px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                    >
                        {exporting ? (
                            <>
                                <Loader size={16} className="animate-spin" />
                                Exporting...
                            </>
                        ) : (
                            <>
                                <Download size={16} />
                                Export Data
                            </>
                        )}
                    </button>
                </div>
            </Card>

            <Card title="Deactivate Account" subtitle="Temporarily disable your account">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                            Deactivating your account will hide your profile and you won't be able to access Chttrix until you reactivate.
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-500">
                            You can reactivate anytime by logging back in.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowDeactivateModal(true)}
                        className="ml-4 px-5 py-2.5 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2 shadow-lg shadow-orange-500/20"
                    >
                        <PauseCircle size={16} />
                        Deactivate
                    </button>
                </div>
            </Card>

            <Card title="Delete Account" subtitle="Permanently remove your account and data">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <div className="flex items-start gap-2 mb-3">
                            <AlertTriangle className="text-red-600 mt-0.5 flex-shrink-0" size={18} />
                            <div>
                                <p className="text-sm font-bold text-red-600 dark:text-red-400 mb-1">
                                    This action is irreversible!
                                </p>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                                    Deleting your account will permanently remove all your data, including messages, files, and settings.
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-500">
                                    Make sure to export your data before deleting your account.
                                </p>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowDeleteModal(true)}
                        className="ml-4 px-5 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 shadow-lg shadow-red-500/20"
                    >
                        <Trash2 size={16} />
                        Delete Account
                    </button>
                </div>
            </Card>

            {/* Deactivate Confirmation Modal */}
            {showDeactivateModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-[#0B0F19] rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
                        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-3">Deactivate Account?</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                            Your profile will be hidden and you won't receive notifications. You can reactivate anytime by logging back in.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeactivateModal(false)}
                                className="flex-1 px-4 py-2.5 border border-slate-300 dark:border-white/20 rounded-lg font-bold text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeactivateAccount}
                                className="flex-1 px-4 py-2.5 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 transition-colors"
                            >
                                Deactivate
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-[#0B0F19] rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-xl">
                                <AlertTriangle className="text-red-600 dark:text-red-400" size={24} />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white">Delete Account Permanently?</h3>
                        </div>
                        <div className="mb-6 space-y-3">
                            <p className="text-sm font-bold text-red-600 dark:text-red-400">
                                ⚠️ This action cannot be undone!
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                All your data will be permanently deleted:
                            </p>
                            <ul className="text-xs text-slate-500 dark:text-slate-500 space-y-1 list-disc list-inside pl-2">
                                <li>All your messages and DM conversations</li>
                                <li>Your personal workspace and channels</li>
                                <li>All tasks and notes you created</li>
                                <li>Your profile and account information</li>
                            </ul>
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">
                                💡 Tip: Export your data first from the "Data Export" section above.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className="flex-1 px-4 py-2.5 border border-slate-300 dark:border-white/20 rounded-lg font-bold text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                                disabled={deleting}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteAccount}
                                disabled={deleting}
                                className="flex-1 px-4 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {deleting ? (
                                    <>
                                        <Loader size={16} className="animate-spin" />
                                        Deleting...
                                    </>
                                ) : (
                                    'Delete Forever'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdvancedTab;
