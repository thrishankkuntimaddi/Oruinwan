import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import api from '../../../services/api';
import { Shield, Mail, Clock, CheckCircle, XCircle, RotateCw, Search, Trash, Link2, AlertTriangle, Trash2, Users } from 'lucide-react';

/**
 * InvitationsTab Component
 * Manages workspace invitations with filtering, search, and bulk actions
 * @param {Object} props
 * @param {Object} props.activeWorkspace - Current workspace object
 * @param {boolean} props.isAdmin - Whether current user is admin
 */
const InvitationsTab = ({ activeWorkspace, isAdmin }) => {
    const { showToast } = useToast();
    const [invitations, setInvitations] = useState({ pending: [], accepted: [], revoked: [], expired: [], duplicateEmails: [], duplicateCount: 0 });
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [actionLoading, setActionLoading] = useState({});
    const [selectedInvites, setSelectedInvites] = useState(new Set());
    const [bulkActionLoading, setBulkActionLoading] = useState(false);

    const fetchInvitations = useCallback(async () => {
        if (!activeWorkspace?.id) return;

        setLoading(true);
        try {
            const response = await api.get(`/api/workspaces/${activeWorkspace.id}/invites`);
            setInvitations(response.data);
        } catch (error) {
            console.error('Error fetching invitations:', error);
            showToast(error.response?.data?.message || 'Failed to load invitations', 'error');
        } finally {
            setLoading(false);
        }
    }, [activeWorkspace?.id, showToast]);

    useEffect(() => {
        fetchInvitations();
    }, [fetchInvitations]);

    const handleRevoke = async (inviteId) => {
        setActionLoading(prev => ({ ...prev, [inviteId]: 'revoking' }));
        try {
            await api.post(`/api/workspaces/${activeWorkspace.id}/invites/${inviteId}/revoke`);
            showToast('✅ Invitation revoked successfully', 'success');
            fetchInvitations();
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to revoke invitation', 'error');
        } finally {
            setActionLoading(prev => ({ ...prev, [inviteId]: null }));
        }
    };

    const handleResend = async (inviteId) => {
        setActionLoading(prev => ({ ...prev, [inviteId]: 'resending' }));
        try {
            await api.post(`/api/workspaces/${activeWorkspace.id}/invites/${inviteId}/resend`);
            showToast('✅ Invitation resent successfully', 'success');
            fetchInvitations();
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to resend invitation', 'error');
        } finally {
            setActionLoading(prev => ({ ...prev, [inviteId]: null }));
        }
    };

    const handleBulkRevoke = async () => {
        if (selectedInvites.size === 0) return;

        if (!window.confirm(`Are you sure you want to revoke ${selectedInvites.size} invitation(s)?`)) {
            return;
        }

        setBulkActionLoading(true);
        try {
            await api.post(`/api/workspaces/${activeWorkspace.id}/invites/bulk-revoke`, {
                inviteIds: Array.from(selectedInvites)
            });
            showToast(`✅ Successfully revoked ${selectedInvites.size} invitation(s)`, 'success');
            setSelectedInvites(new Set());
            fetchInvitations();
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to bulk revoke invitations', 'error');
        } finally {
            setBulkActionLoading(false);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedInvites.size === 0) return;

        if (!window.confirm(`Are you sure you want to delete ${selectedInvites.size} invitation(s)? This action cannot be undone.`)) {
            return;
        }

        setBulkActionLoading(true);
        try {
            await api.delete(`/api/workspaces/${activeWorkspace.id}/invites/bulk-delete`, {
                data: { inviteIds: Array.from(selectedInvites) }
            });
            showToast(`✅ Successfully deleted ${selectedInvites.size} invitation(s)`, 'success');
            setSelectedInvites(new Set());
            fetchInvitations();
        } catch (error) {
            console.error('❌ Delete error:', error);
            showToast(error.response?.data?.message || 'Failed to bulk delete invitations', 'error');
        } finally {
            setBulkActionLoading(false);
        }
    };

    const handleCleanupExpired = async () => {
        if (!window.confirm('Are you sure you want to delete all expired invitations? This action cannot be undone.')) {
            return;
        }

        setBulkActionLoading(true);
        try {
            const response = await api.post(`/api/workspaces/${activeWorkspace.id}/invites/cleanup-expired`);
            showToast(`✅ ${response.data.message}`, 'success');
            fetchInvitations();
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to cleanup expired invitations', 'error');
        } finally {
            setBulkActionLoading(false);
        }
    };

    const toggleSelectInvite = (inviteId) => {
        const newSelected = new Set(selectedInvites);
        if (newSelected.has(inviteId)) {
            newSelected.delete(inviteId);
        } else {
            newSelected.add(inviteId);
        }
        setSelectedInvites(newSelected);
    };

    // ✅ FIXED: Filter and search invitations with proper categorization
    // Accepted invitations should NOT appear in pending
    const allInvites = [
        // Only truly pending invitations (not used/accepted)
        ...invitations.pending.filter(inv => inv.status === 'pending' && !inv.used).map(inv => ({ ...inv, filterStatus: 'pending' })),
        // Accepted invitations (status=accepted OR used flag is true)
        ...invitations.accepted.map(inv => ({ ...inv, filterStatus: 'accepted' })),
        // Also check for used invitations that might be in pending
        ...invitations.pending.filter(inv => inv.used || inv.status === 'accepted').map(inv => ({ ...inv, filterStatus: 'accepted' })),
        ...invitations.expired.map(inv => ({ ...inv, filterStatus: 'expired' })),
        ...invitations.revoked.map(inv => ({ ...inv, filterStatus: 'revoked' }))
    ];

    // Remove duplicates (in case an invitation appears in both pending and accepted)
    const uniqueInvites = allInvites.reduce((acc, inv) => {
        if (!acc.find(existing => existing.id === inv.id)) {
            acc.push(inv);
        }
        return acc;
    }, []);

    const filteredInvites = uniqueInvites.filter(invite => {
        const matchesFilter = filter === 'all' ||
            (filter === 'duplicates' ? invite.isDuplicate : invite.filterStatus === filter);
        const matchesSearch = !searchQuery ||
            invite.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            invite.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            invite.invitedBy?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    // Count selected by type for button enabling
    const selectedPending = Array.from(selectedInvites).filter(id => {
        const invite = uniqueInvites.find(inv => inv.id === id);
        return invite?.filterStatus === 'pending';
    }).length;

    const selectedDeletable = Array.from(selectedInvites).filter(id => {
        const invite = uniqueInvites.find(inv => inv.id === id);
        // Can delete: expired, revoked, or accepted invitations
        return invite?.filterStatus === 'expired' || invite?.filterStatus === 'revoked' || invite?.filterStatus === 'accepted';
    }).length;

    const getStatusBadge = (status) => {
        const badges = {
            pending: { text: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
            accepted: { text: 'Accepted', color: 'bg-green-100 text-green-700', icon: CheckCircle },
            expired: { text: 'Expired', color: 'bg-gray-100 text-gray-700', icon: XCircle },
            revoked: { text: 'Revoked', color: 'bg-red-100 text-red-700', icon: XCircle }
        };
        const badge = badges[status] || badges.pending;
        const Icon = badge.icon;
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
                <Icon className="w-3 h-3" />
                {badge.text}
            </span>
        );
    };

    const getTimeAgo = (date) => {
        const now = new Date();
        const past = new Date(date);
        const diffInMs = now - past;
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

        if (diffInDays === 0) return 'Today';
        if (diffInDays === 1) return 'Yesterday';
        if (diffInDays < 7) return `${diffInDays} days ago`;
        return past.toLocaleDateString();
    };

    const getExpiresIn = (date) => {
        const now = new Date();
        const future = new Date(date);
        const diffInMs = future - now;
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

        if (diffInMs < 0) return 'Expired';
        if (diffInDays === 0) return 'Today';
        if (diffInDays === 1) return '1 day';
        return `${diffInDays} days`;
    };

    if (!isAdmin) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <Shield className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Admin Access Required</h3>
                    <p className="text-gray-600 dark:text-gray-400">Only workspace admins can manage invitations</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Bulk Actions Bar - Modern Design */}
            {selectedInvites.size > 0 && (
                <div className="mx-8 mt-2 mb-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg border border-blue-400/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                                <CheckCircle className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <div className="text-base font-bold text-white">
                                    {selectedInvites.size} {selectedInvites.size === 1 ? 'Invitation' : 'Invitations'} Selected
                                </div>
                                <div className="text-xs text-blue-100 dark:text-blue-200">
                                    {selectedPending > 0 && `${selectedPending} pending`}
                                    {selectedPending > 0 && selectedDeletable > 0 && ', '}
                                    {selectedDeletable > 0 && `${selectedDeletable} deletable`}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {selectedPending > 0 && (
                                <button
                                    onClick={handleBulkRevoke}
                                    disabled={bulkActionLoading}
                                    className="px-4 py-2 bg-white/90 hover:bg-white text-orange-600 text-sm font-semibold rounded-lg transition-all disabled:opacity-50 flex items-center gap-2 shadow-md hover:shadow-lg"
                                >
                                    <XCircle className="w-4 h-4" />
                                    Revoke ({selectedPending})
                                </button>
                            )}
                            {selectedDeletable > 0 && (
                                <button
                                    onClick={handleBulkDelete}
                                    disabled={bulkActionLoading}
                                    className="px-4 py-2 bg-white/90 hover:bg-white text-red-600 text-sm font-semibold rounded-lg transition-all disabled:opacity-50 flex items-center gap-2 shadow-md hover:shadow-lg"
                                >
                                    <Trash className="w-4 h-4" />
                                    Delete ({selectedDeletable})
                                </button>
                            )}
                            {/* Show info message if selected invitations have no available actions */}
                            {selectedPending === 0 && selectedDeletable === 0 && (
                                <div className="px-4 py-2 bg-white/90 text-gray-600 text-sm font-medium rounded-lg flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4" />
                                    No actions available for selected invitations
                                </div>
                            )}
                            <button
                                onClick={() => setSelectedInvites(new Set())}
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-all backdrop-blur-sm border border-white/20"
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Search and Filters Container */}
            <div className="px-8 pt-8 pb-4 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 space-y-5">
                {/* Top Row: Search and Actions */}
                <div className="flex items-center gap-4">
                    <div className="relative flex-1">
                        <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search invitations by email, role, or inviter..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:bg-white dark:focus:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm text-gray-900 dark:text-white placeholder-gray-400"
                        />
                    </div>
                    {invitations.expired.length > 0 && (
                        <button
                            onClick={handleCleanupExpired}
                            disabled={bulkActionLoading}
                            className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl transition-colors whitespace-nowrap"
                        >
                            <Trash2 className="w-4 h-4" />
                            Clean Expired
                        </button>
                    )}
                </div>

                {/* Bottom Row: Filter Tabs */}
                <div className="flex gap-2 pb-1 overflow-x-auto no-scrollbar mask-gradient-right">
                    {[
                        { value: 'all', label: 'All', count: uniqueInvites.length },
                        { value: 'pending', label: 'Pending', count: uniqueInvites.filter(inv => inv.filterStatus === 'pending').length },
                        { value: 'accepted', label: 'Accepted', count: uniqueInvites.filter(inv => inv.filterStatus === 'accepted').length },
                        { value: 'expired', label: 'Expired', count: uniqueInvites.filter(inv => inv.filterStatus === 'expired').length },
                        { value: 'revoked', label: 'Revoked', count: uniqueInvites.filter(inv => inv.filterStatus === 'revoked').length },
                        { value: 'duplicates', label: '⚠️ Duplicates', count: uniqueInvites.filter(inv => inv.isDuplicate).length }
                    ].map(({ value, label, count }) => (
                        <button
                            key={value}
                            onClick={() => { setFilter(value); setSelectedInvites(new Set()); }}
                            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${filter === value
                                ? value === 'duplicates'
                                    ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 ring-1 ring-orange-200 dark:ring-orange-800 shadow-sm'
                                    : 'bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-none'
                                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                        >
                            <span>{label}</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-xs ${filter === value
                                ? value === 'duplicates'
                                    ? 'bg-orange-200/50 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200'
                                    : 'bg-white/20 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                                }`}>
                                {count}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
            {/* Invitations List - Card Based Layout */}
            <div className="flex-1 overflow-auto px-8 py-6">
                {loading ? (
                    <div className="animate-pulse space-y-3 py-4">
                        {[75,55,85,60,70].map((w,i) => (
                            <div key={i} className="flex items-center gap-4 bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                                <div className="flex-1 space-y-1.5">
                                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded" style={{width:`${w}%`}} />
                                    <div className="h-2.5 bg-gray-100 dark:bg-gray-700/50 rounded" style={{width:`${w-25}%`}} />
                                </div>
                                <div className="h-7 w-20 bg-gray-100 dark:bg-gray-700 rounded-lg" />
                            </div>
                        ))}
                        <p className="text-gray-600">Loading invitations...</p>
                    </div>
                ) : filteredInvites.length === 0 ? (
                    <div className="text-center py-12">
                        <Mail className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-600 dark:text-gray-400">No invitations found</p>
                        {filter !== 'all' && (
                            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">Try changing the filter or search query</p>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredInvites.map((invite) => (
                            <div
                                key={invite.id}
                                className={`bg-white dark:bg-gray-900 rounded-xl border-2 transition-all hover:shadow-md ${invite.isDuplicate
                                    ? 'border-orange-200 dark:border-orange-900/50 bg-orange-50/20 dark:bg-orange-900/10'
                                    : selectedInvites.has(invite.id)
                                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 shadow-md'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                    }`}
                            >
                                <div className="p-4">
                                    <div className="flex items-start gap-4">
                                        {/* Checkbox */}
                                        <div className="pt-1">
                                            <input
                                                type="checkbox"
                                                checked={selectedInvites.has(invite.id)}
                                                onChange={() => toggleSelectInvite(invite.id)}
                                                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                            />
                                        </div>

                                        {/* Main Content */}
                                        <div className="flex-1 min-w-0">
                                            {/* Header Row */}
                                            <div className="flex items-start justify-between gap-4 mb-1.5">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        {invite.inviteType === 'email' ? (
                                                            <>
                                                                <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                                                <span className="font-semibold text-gray-900 dark:text-white truncate">
                                                                    {invite.email}
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Link2 className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                                                                <div className="flex flex-col">
                                                                    <span className="font-semibold text-gray-700 dark:text-gray-200">
                                                                        Shareable Link
                                                                    </span>
                                                                    <span className="text-xs text-gray-500 dark:text-gray-400 italic">
                                                                        Anyone with this link can join as {invite.role}
                                                                    </span>
                                                                </div>
                                                            </>
                                                        )}
                                                        {invite.isDuplicate && (
                                                            <span
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs font-medium rounded border border-orange-300 dark:border-orange-800"
                                                                title={`${invite.duplicateCount} pending invitations for this email`}
                                                            >
                                                                <AlertTriangle className="w-3 h-3" />
                                                                ×{invite.duplicateCount}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Metadata Row */}
                                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600 dark:text-gray-400">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="px-2.5 py-0.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-md border border-blue-200 dark:border-blue-800 capitalize">
                                                                {invite.role}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <Users className="w-3.5 h-3.5 text-gray-400" />
                                                            <span>by {invite.invitedBy || 'System'}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                                                            <span>{getTimeAgo(invite.createdAt)}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-gray-400">Expires:</span>
                                                            <span>{getExpiresIn(invite.expiresAt)}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Status Badge */}
                                                <div className="flex-shrink-0">
                                                    {getStatusBadge(invite.filterStatus)}
                                                </div>
                                            </div>

                                            {/* Actions Row */}
                                            {(invite.filterStatus === 'pending' || invite.filterStatus === 'expired') && (
                                                <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                                                    <button
                                                        onClick={() => handleResend(invite.id)}
                                                        disabled={actionLoading[invite.id]}
                                                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors disabled:opacity-50"
                                                    >
                                                        <RotateCw className={`w-3.5 h-3.5 ${actionLoading[invite.id] === 'resending' ? 'animate-spin' : ''}`} />
                                                        Resend
                                                    </button>
                                                    {invite.filterStatus === 'pending' && (
                                                        <button
                                                            onClick={() => handleRevoke(invite.id)}
                                                            disabled={actionLoading[invite.id]}
                                                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors disabled:opacity-50"
                                                        >
                                                            <XCircle className="w-3.5 h-3.5" />
                                                            Revoke
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div >
        </div >
    );
};

export default InvitationsTab;
