/**
 * ContactPickerModal.jsx — Phase 7.4
 *
 * Workspace-scoped contact picker.
 * Fetches members via GET /api/workspaces/:workspaceId/members,
 * lets the user search + select one, then calls onSelect({ name, email, phone, avatar }).
 *
 * Props:
 *   isOpen       — boolean
 *   onClose      — () => void
 *   onSelect     — (contact: { name, email, phone, avatar }) => void
 *   workspaceId  — string
 */
import React, { useEffect, useState, useMemo } from 'react';
import { X, Search, User, Loader2, AlertCircle } from 'lucide-react';
import api from '../../../../services/api';

export default function ContactPickerModal({ isOpen, onClose, onSelect, workspaceId }) {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [query, setQuery] = useState('');

    // Fetch workspace members when modal opens
    useEffect(() => {
        if (!isOpen || !workspaceId) return;
        let cancelled = false;
        setLoading(true);
        setError(null);

        api.get(`/api/workspaces/${workspaceId}/members`)
            .then(({ data }) => {
                if (cancelled) return;
                // Normalize: may be { members: [...] } or an array
                const list = Array.isArray(data) ? data : (data.members || data.users || []);
                setMembers(list);
            })
            .catch((err) => {
                if (cancelled) return;
                setError(err?.response?.data?.message || 'Could not load members');
            })
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, [isOpen, workspaceId]);

    // Reset search when modal opens
    useEffect(() => { if (isOpen) setQuery(''); }, [isOpen]);

    const filtered = useMemo(() => {
        if (!query.trim()) return members;
        const q = query.toLowerCase();
        return members.filter(m => {
            const name = (m.user?.username || m.username || m.name || '').toLowerCase();
            const email = (m.user?.email || m.email || '').toLowerCase();
            return name.includes(q) || email.includes(q);
        });
    }, [members, query]);

    const handleSelect = (member) => {
        // Normalize member object (may have nested `user`)
        const u = member.user || member;
        onSelect({
            name: u.username || u.name || 'Unknown',
            email: u.email || '',
            phone: u.phone || u.phoneNumber || '',
            avatar: u.profilePicture || u.avatar || '',
        });
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                            Share a Contact
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Select a workspace member
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <X size={18} className="text-gray-500 dark:text-gray-400" />
                    </button>
                </div>

                {/* Search */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50">
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Search by name or email…"
                            className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Member list */}
                <div className="flex-1 overflow-y-auto">
                    {loading && (
                        <div className="flex items-center justify-center gap-2 py-10 text-gray-400 text-sm">
                            <Loader2 size={16} className="animate-spin" />
                            Loading members…
                        </div>
                    )}

                    {error && !loading && (
                        <div className="flex flex-col items-center gap-2 py-10 text-red-500 text-sm px-6 text-center">
                            <AlertCircle size={20} />
                            {error}
                        </div>
                    )}

                    {!loading && !error && filtered.length === 0 && (
                        <div className="py-10 text-center text-sm text-gray-400">
                            {query ? 'No members match your search' : 'No members found'}
                        </div>
                    )}

                    {!loading && !error && filtered.map((member, i) => {
                        const u = member.user || member;
                        const name = u.username || u.name || 'Unknown';
                        const email = u.email || '';
                        const avatar = u.profilePicture || u.avatar || null;

                        return (
                            <button
                                key={u._id || u.id || i}
                                onClick={() => handleSelect(member)}
                                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors text-left border-b border-gray-50 dark:border-gray-700/30 last:border-b-0"
                            >
                                {/* Avatar */}
                                {avatar ? (
                                    <img
                                        src={avatar}
                                        alt={name}
                                        className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                                    />
                                ) : (
                                    <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                                        <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                                            {name.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{name}</p>
                                    {email && (
                                        <p className="text-xs text-gray-400 truncate">{email}</p>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
