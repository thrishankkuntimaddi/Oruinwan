import React, { useState, useEffect } from 'react';
import { X, Search, Users, Check, UserPlus, Globe, Lock } from 'lucide-react';
import api from '../../../../services/api';

const ShareNoteModal = ({ note, workspaceId, onClose, onShare }) => {
    const [members, setMembers] = useState([]);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(new Set(note.sharedWith || []));
    const [isPublic, setIsPublic] = useState(note.isPublic || false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await api.get(`/api/workspaces/${workspaceId}/members`);
                // Filter out the note owner
                const allMembers = (res.data.members || res.data || []).filter(
                    m => (m._id || m.id) !== (note.owner?._id || note.owner)
                );
                setMembers(allMembers);
            } catch (e) {
                console.error('Failed to load members', e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [workspaceId, note.owner]);

    const filtered = members.filter(m => {
        const name = m.name || m.username || m.displayName || '';
        const email = m.email || '';
        const q = search.toLowerCase();
        return name.toLowerCase().includes(q) || email.toLowerCase().includes(q);
    });

    const toggle = (id) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await onShare([...selected], isPublic);
            onClose();
        } catch { } finally {
            setSaving(false);
        }
    };

    const sharedCount = selected.size;

    return (
        <div
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center backdrop-blur-sm p-4"
            onClick={e => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-[420px] max-h-[85vh] flex flex-col border border-gray-200 dark:border-gray-800">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                            <Users size={15} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Share Note</h3>
                            <p className="text-[10px] text-gray-400 truncate max-w-[220px]">{note.title || 'Untitled Note'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <X size={15} />
                    </button>
                </div>

                {/* Visibility toggle */}
                <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
                    <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Visibility</p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsPublic(false)}
                            className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${!isPublic
                                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white'
                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                }`}
                        >
                            <Lock size={13} />
                            <div className="text-left">
                                <div className="text-xs font-semibold leading-tight">Private</div>
                                <div className="text-[10px] opacity-60 leading-tight">Only selected people</div>
                            </div>
                        </button>
                        <button
                            onClick={() => setIsPublic(true)}
                            className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${isPublic
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                }`}
                        >
                            <Globe size={13} />
                            <div className="text-left">
                                <div className="text-xs font-semibold leading-tight">Workspace</div>
                                <div className="text-[10px] opacity-60 leading-tight">All workspace members</div>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Member search + list */}
                {!isPublic && (
                    <>
                        <div className="px-5 pt-3 pb-2 shrink-0">
                            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
                                Invite people {sharedCount > 0 && <span className="text-blue-500">· {sharedCount} selected</span>}
                            </p>
                            <div className="relative">
                                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search by name or email..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="w-full pl-8 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-3 pb-3">
                            {loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="text-center py-8 text-gray-400 dark:text-gray-600">
                                    <Users size={28} className="mx-auto mb-2 opacity-30" />
                                    <p className="text-xs">{search ? 'No members match your search' : 'No other members in this workspace'}</p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {filtered.map(member => {
                                        const id = member._id || member.id;
                                        const name = member.name || member.username || member.displayName || 'Unknown';
                                        const email = member.email || '';
                                        const avatar = member.avatar || member.profilePicture || null;
                                        const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                                        const isSelected = selected.has(id);

                                        return (
                                            <button
                                                key={id}
                                                onClick={() => toggle(id)}
                                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${isSelected
                                                    ? 'bg-blue-50 dark:bg-blue-950/30'
                                                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                                                    }`}
                                            >
                                                {/* Avatar */}
                                                {avatar ? (
                                                    <img src={avatar} alt={name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                                                        {initials}
                                                    </div>
                                                )}
                                                <div className="flex-1 text-left min-w-0">
                                                    <p className={`text-sm font-semibold truncate ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-gray-800 dark:text-gray-100'}`}>{name}</p>
                                                    {email && <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{email}</p>}
                                                </div>
                                                {/* Checkbox */}
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-600'}`}>
                                                    {isSelected && <Check size={11} className="text-white" strokeWidth={2.5} />}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {isPublic && (
                    <div className="flex-1 flex flex-col items-center justify-center py-8 px-5 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-3">
                            <Globe size={24} className="text-blue-500" />
                        </div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">Visible to all workspace members</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Anyone in this workspace will be able to view this note.</p>
                    </div>
                )}

                {/* Footer */}
                <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 flex gap-2 shrink-0">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-semibold transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                        {saving ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <><UserPlus size={14} /> {isPublic ? 'Make Public' : sharedCount > 0 ? `Share with ${sharedCount}` : 'Save'}</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ShareNoteModal;
