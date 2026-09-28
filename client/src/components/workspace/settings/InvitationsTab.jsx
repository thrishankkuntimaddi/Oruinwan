import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import api from '@services/api';
import { Shield, Mail, Clock, CheckCircle, XCircle, RotateCw, Search, Trash, Link2, AlertTriangle, Trash2, Users } from 'lucide-react';
import logger from '../../../utils/logger';

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
            logger.error('Error fetching invitations:', error);
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
            logger.error('❌ Delete error:', error);
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

    
    
    const allInvites = [
        
        ...invitations.pending.filter(inv => inv.status === 'pending' && !inv.used).map(inv => ({ ...inv, filterStatus: 'pending' })),
        
        ...invitations.accepted.map(inv => ({ ...inv, filterStatus: 'accepted' })),
        
        ...invitations.pending.filter(inv => inv.used || inv.status === 'accepted').map(inv => ({ ...inv, filterStatus: 'accepted' })),
        ...invitations.expired.map(inv => ({ ...inv, filterStatus: 'expired' })),
        ...invitations.revoked.map(inv => ({ ...inv, filterStatus: 'revoked' }))
    ];

    
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

    
    const selectedPending = Array.from(selectedInvites).filter(id => {
        const invite = uniqueInvites.find(inv => inv.id === id);
        return invite?.filterStatus === 'pending';
    }).length;

    const selectedDeletable = Array.from(selectedInvites).filter(id => {
        const invite = uniqueInvites.find(inv => inv.id === id);
        
        return invite?.filterStatus === 'expired' || invite?.filterStatus === 'revoked' || invite?.filterStatus === 'accepted';
    }).length;

    const getStatusBadge = (status) => {
        const badges = {
            pending:  { text: 'Pending',  bg: 'var(--accent-dim)',  border: 'var(--color-warning)',  color: 'var(--color-warning)', Icon: Clock       },
            accepted: { text: 'Accepted', bg: 'var(--bg-active)',  border: 'var(--state-success)', color: 'var(--state-success)', Icon: CheckCircle },
            expired:  { text: 'Expired',  bg: 'var(--bg-active)',border: 'var(--border-default)',color: 'var(--text-muted)', Icon: XCircle },
            revoked:  { text: 'Revoked',  bg: 'var(--bg-active)', border: 'var(--state-danger)',color: 'var(--state-danger)', Icon: XCircle    },
        };
        const b = badges[status] || badges.expired;
        const Icon = b.Icon;
        return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', fontSize: '10px', fontWeight: 700, background: b.bg, border: `1px solid ${b.border}`, color: b.color, fontFamily: 'var(--font)' }}>
                <Icon style={{ width: '10px', height: '10px' }} />
                {b.text}
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontFamily: 'var(--font)' }}>
                <div style={{ textAlign: 'center' }}>
                    <Shield size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 14px', display: 'block' }} />
                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px' }}>Admin Access Required</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>Only workspace admins can manage invitations</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {}
            {selectedInvites.size > 0 && (
                <div style={{ margin: '8px 32px', padding: '12px 16px', background: 'var(--accent-dim)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-dim)', border: '1px solid var(--border-accent)', color: 'var(--accent)', flexShrink: 0 }}>
                            <CheckCircle style={{ width: '15px', height: '15px' }} />
                        </div>
                        <div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font)' }}>
                                {selectedInvites.size} {selectedInvites.size === 1 ? 'Invitation' : 'Invitations'} Selected
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font)' }}>
                                {selectedPending > 0 && `${selectedPending} pending`}
                                {selectedPending > 0 && selectedDeletable > 0 && ', '}
                                {selectedDeletable > 0 && `${selectedDeletable} deletable`}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        {selectedPending > 0 && (
                            <button onClick={handleBulkRevoke} disabled={bulkActionLoading}
                                style={{ padding: '6px 12px', background: 'var(--accent-dim)', border: '1px solid var(--color-warning)', color: 'var(--color-warning)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: '5px', opacity: bulkActionLoading ? 0.5 : 1 }}>
                                <XCircle style={{ width: '13px', height: '13px' }} />
                                Revoke ({selectedPending})
                            </button>
                        )}
                        {selectedDeletable > 0 && (
                            <button onClick={handleBulkDelete} disabled={bulkActionLoading}
                                style={{ padding: '6px 12px', background: 'var(--bg-active)', border: '1px solid var(--state-danger)', color: 'var(--state-danger)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: '5px', opacity: bulkActionLoading ? 0.5 : 1 }}>
                                <Trash style={{ width: '13px', height: '13px' }} />
                                Delete ({selectedDeletable})
                            </button>
                        )}
                        {selectedPending === 0 && selectedDeletable === 0 && (
                            <div style={{ padding: '6px 12px', background: 'var(--bg-hover)', color: 'var(--text-muted)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <AlertTriangle style={{ width: '13px', height: '13px' }} />
                                No actions available
                            </div>
                        )}
                        <button onClick={() => setSelectedInvites(new Set())}
                            style={{ padding: '6px 12px', background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                            Clear
                        </button>
                    </div>
                </div>
            )}

            {}
            <div style={{ padding: '20px 32px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
                {}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', width: '15px', height: '15px' }} />
                        <input
                            type="text"
                            placeholder="Search invitations by email, role, or inviter..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{ width: '100%', paddingLeft: '34px', paddingRight: '12px', paddingTop: '9px', paddingBottom: '9px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', fontFamily: 'var(--font)', boxSizing: 'border-box', transition: 'border-color 150ms ease' }}
                            onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                            onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                        />
                    </div>
                    {invitations.expired.length > 0 && (
                        <button onClick={handleCleanupExpired} disabled={bulkActionLoading}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font)', whiteSpace: 'nowrap', transition: '150ms ease', opacity: bulkActionLoading ? 0.5 : 1 }}
                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-accent)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                        >
                            <Trash2 style={{ width: '13px', height: '13px' }} />
                            Clean Expired
                        </button>
                    )}
                </div>

                {}
                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
                    {[
                        { value: 'all',        label: 'All',         count: uniqueInvites.length },
                        { value: 'pending',    label: 'Pending',     count: uniqueInvites.filter(inv => inv.filterStatus === 'pending').length },
                        { value: 'accepted',   label: 'Accepted',    count: uniqueInvites.filter(inv => inv.filterStatus === 'accepted').length },
                        { value: 'expired',    label: 'Expired',     count: uniqueInvites.filter(inv => inv.filterStatus === 'expired').length },
                        { value: 'revoked',    label: 'Revoked',     count: uniqueInvites.filter(inv => inv.filterStatus === 'revoked').length },
                        { value: 'duplicates', label: 'Duplicates', count: uniqueInvites.filter(inv => inv.isDuplicate).length },
                    ].map(({ value, label, count }) => {
                        const isActive = filter === value;
                        const isDup = value === 'duplicates';
                        return (
                            <button
                                key={value}
                                onClick={() => { setFilter(value); setSelectedInvites(new Set()); }}
                                style={{
                                    flexShrink: 0, display: 'flex', alignItems: 'center', gap: '5px',
                                    padding: '5px 10px', fontSize: '12px', fontWeight: isActive ? 700 : 400,
                                    background: isActive ? (isDup ? 'var(--accent-dim)' : 'var(--accent-dim)') : 'var(--bg-active)',
                                    border: `1px solid ${isActive ? (isDup ? 'var(--color-warning)' : 'var(--accent)') : 'var(--border-default)'}`,
                                    color: isActive ? (isDup ? 'var(--color-warning)' : 'var(--accent)') : 'var(--text-secondary)',
                                    cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all 150ms ease',
                                }}
                                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-accent)'; } }}
                                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-default)'; } }}
                            >
                                <span>{label}</span>
                                <span style={{ padding: '1px 5px', fontSize: '10px', fontWeight: 700, background: isActive ? (isDup ? 'var(--accent-dim)' : 'var(--accent-dim)') : 'var(--bg-hover)', color: isActive ? (isDup ? 'var(--color-warning)' : 'var(--accent)') : 'var(--text-muted)' }}>{count}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
            {}
            <div className="flex-1 overflow-auto px-8 py-6">
                {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px 0' }}>
                        {[75,55,85,60,70].map((w, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '12px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-active)', flexShrink: 0 }} />
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <div style={{ height: '10px', background: 'var(--bg-active)', width: `${w}%` }} />
                                    <div style={{ height: '8px', background: 'var(--bg-hover)', width: `${w - 25}%` }} />
                                </div>
                                <div style={{ width: '64px', height: '24px', background: 'var(--bg-active)' }} />
                            </div>
                        ))}
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font)' }}>Loading invitations...</p>
                    </div>
                ) : filteredInvites.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px 0' }}>
                        <Mail style={{ width: '40px', height: '40px', color: 'var(--text-muted)', margin: '0 auto 12px', display: 'block' }} />
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font)' }}>No invitations found</p>
                        {filter !== 'all' && (
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'var(--font)' }}>Try changing the filter or search query</p>
                        )}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {filteredInvites.map((invite) => {
                            const isSelected = selectedInvites.has(invite.id);
                            const isDup = invite.isDuplicate;
                            return (
                                <div
                                    key={invite.id}
                                    style={{
                                        background: isDup ? 'var(--accent-dim)' : isSelected ? 'var(--accent-dim)' : 'var(--bg-surface)',
                                        border: `1px solid ${isDup ? 'var(--color-warning)' : isSelected ? 'var(--border-accent)' : 'var(--border-default)'}`,
                                        transition: 'all 150ms ease',
                                    }}
                                >
                                    <div style={{ padding: '12px 14px' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                            {}
                                            <div style={{ paddingTop: '2px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelectInvite(invite.id)}
                                                    style={{ width: '14px', height: '14px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                                                />
                                            </div>

                                            {}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                {}
                                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '6px' }}>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                                            {invite.inviteType === 'email' ? (
                                                                <>
                                                                    <Mail style={{ width: '13px', height: '13px', color: 'var(--text-secondary)', flexShrink: 0 }} />
                                                                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font)' }}>
                                                                        {invite.email}
                                                                    </span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Link2 style={{ width: '13px', height: '13px', color: 'var(--text-secondary)', flexShrink: 0 }} />
                                                                    <div>
                                                                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'block', fontFamily: 'var(--font)' }}>Shareable Link</span>
                                                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font)' }}>Anyone with this link can join as {invite.role}</span>
                                                                    </div>
                                                                </>
                                                            )}
                                                            {isDup && (
                                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 6px', fontSize: '10px', fontWeight: 700, background: 'var(--accent-dim)', border: '1px solid var(--color-warning)', color: 'var(--color-warning)', fontFamily: 'var(--font)' }}
                                                                    title={`${invite.duplicateCount} pending invitations for this email`}>
                                                                    <AlertTriangle style={{ width: '9px', height: '9px' }} />
                                                                    ×{invite.duplicateCount}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {}
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font)' }}>
                                                            <span style={{ padding: '1px 6px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', fontSize: '10px', fontWeight: 700, color: 'var(--accent)', textTransform: 'capitalize' }}>
                                                                {invite.role}
                                                            </span>
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                <Users style={{ width: '11px', height: '11px' }} />
                                                                by {invite.invitedBy || 'System'}
                                                            </span>
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                <Clock style={{ width: '11px', height: '11px' }} />
                                                                {getTimeAgo(invite.createdAt)}
                                                            </span>
                                                            <span>Expires: {getExpiresIn(invite.expiresAt)}</span>
                                                        </div>
                                                    </div>

                                                    {}
                                                    <div style={{ flexShrink: 0 }}>
                                                        {getStatusBadge(invite.filterStatus)}
                                                    </div>
                                                </div>

                                                {}
                                                {(invite.filterStatus === 'pending' || invite.filterStatus === 'expired') && (
                                                    <div style={{ display: 'flex', gap: '6px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                                                        <button
                                                            onClick={() => handleResend(invite.id)}
                                                            disabled={actionLoading[invite.id]}
                                                            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-active)', border: '1px solid var(--border-default)', cursor: 'pointer', fontFamily: 'var(--font)', transition: '150ms ease', opacity: actionLoading[invite.id] ? 0.5 : 1 }}
                                                        >
                                                            <RotateCw style={{ width: '11px', height: '11px' }} className={actionLoading[invite.id] === 'resending' ? 'animate-spin' : ''} />
                                                            Resend
                                                        </button>
                                                        {invite.filterStatus === 'pending' && (
                                                            <button
                                                                onClick={() => handleRevoke(invite.id)}
                                                                disabled={actionLoading[invite.id]}
                                                                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', fontSize: '11px', fontWeight: 600, color: 'var(--state-danger)', background: 'var(--bg-active)', border: '1px solid var(--state-danger)', cursor: 'pointer', fontFamily: 'var(--font)', transition: '150ms ease', opacity: actionLoading[invite.id] ? 0.5 : 1 }}
                                                            >
                                                                <XCircle style={{ width: '11px', height: '11px' }} />
                                                                Revoke
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div >
        </div >
    );
};

export default InvitationsTab;
