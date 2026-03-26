// client/src/pages/workspace-os/PermissionMatrixPage.jsx
// Role × Module permission matrix — visual toggle table for admins.
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Shield, RefreshCw, Save, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

const ROLES = ['owner', 'admin', 'manager', 'member', 'guest'];

const MODULES = [
    { group: 'Company', keys: ['manageCompany', 'viewAnalytics', 'manageBilling'] },
    { group: 'Users', keys: ['inviteUsers', 'removeUsers', 'manageRoles'] },
    { group: 'Workspaces', keys: ['createWorkspace', 'deleteWorkspace', 'manageWorkspaceMembers'] },
    { group: 'Channels', keys: ['createChannel', 'deleteChannel', 'manageChannelMembers'] },
    { group: 'Messages', keys: ['sendMessages', 'deleteMessages', 'pinMessages'] },
    { group: 'Tasks', keys: ['createTasks', 'assignTasks', 'deleteTasks'] },
    { group: 'Notes', keys: ['createNotes', 'shareNotes'] },
    { group: 'Updates', keys: ['postUpdates', 'deleteUpdates'] }
];

const PERM_LABELS = {
    manageCompany: 'Manage Company', viewAnalytics: 'View Analytics', manageBilling: 'Billing',
    inviteUsers: 'Invite Users', removeUsers: 'Remove Users', manageRoles: 'Manage Roles',
    createWorkspace: 'Create Workspace', deleteWorkspace: 'Delete Workspace', manageWorkspaceMembers: 'Workspace Members',
    createChannel: 'Create Channel', deleteChannel: 'Delete Channel', manageChannelMembers: 'Channel Members',
    sendMessages: 'Send Messages', deleteMessages: 'Delete Messages', pinMessages: 'Pin Messages',
    createTasks: 'Create Tasks', assignTasks: 'Assign Tasks', deleteTasks: 'Delete Tasks',
    createNotes: 'Create Notes', shareNotes: 'Share Notes',
    postUpdates: 'Post Updates', deleteUpdates: 'Delete Updates'
};

const ROLE_COLORS = {
    owner: 'text-amber-600 dark:text-amber-400',
    admin: 'text-red-600 dark:text-red-400',
    manager: 'text-violet-600 dark:text-violet-400',
    member: 'text-sky-600 dark:text-sky-400',
    guest: 'text-slate-500 dark:text-slate-400'
};

const Toggle = ({ enabled, onChange, locked }) => (
    <button
        onClick={() => !locked && onChange(!enabled)}
        disabled={locked}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-all ${
            enabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
        } ${locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}`}
        title={locked ? 'Cannot modify owner permissions' : (enabled ? 'Disable' : 'Enable')}
    >
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${enabled ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
    </button>
);

export default function PermissionMatrixPage({ companyId: propCompanyId }) {
    const { user } = useAuth();
    const companyId = propCompanyId || user?.companyId;

    const [matrix, setMatrix] = useState({});
    const [draft, setDraft] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [saved, setSaved] = useState(false);
    const [dirty, setDirty] = useState(false);

    const load = useCallback(async () => {
        if (!companyId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await api.get('/api/permissions/matrix', { params: { companyId } });
            setMatrix(res.data.matrix);
            setDraft(JSON.parse(JSON.stringify(res.data.matrix)));
            setDirty(false);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load permissions');
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    useEffect(() => { load(); }, [load]);

    const handleToggle = (role, perm, val) => {
        if (role === 'owner') return; // Owner is always immutable
        setDraft(prev => ({
            ...prev,
            [role]: { ...prev[role], [perm]: val }
        }));
        setDirty(true);
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            // Only send non-owner roles (owner is immutable)
            const updates = Object.fromEntries(
                Object.entries(draft).filter(([role]) => role !== 'owner')
            );
            await api.put('/api/permissions/matrix', { companyId, updates });
            setMatrix(JSON.parse(JSON.stringify(draft)));
            setDirty(false);
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save permissions');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setDraft(JSON.parse(JSON.stringify(matrix)));
        setDirty(false);
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <Shield size={22} className="text-indigo-500" />
                        Permission Matrix
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">Define what each role can do across the platform</p>
                </div>
                <div className="flex items-center gap-2">
                    {dirty && (
                        <button onClick={handleReset} className="px-3 py-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                            Reset
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving || !dirty}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-colors"
                    >
                        {saving ? <RefreshCw size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
                        {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
                    <AlertTriangle size={14} /> {error}
                </div>
            )}

            {/* Owner notice */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 text-amber-700 dark:text-amber-400 text-sm flex items-center gap-2">
                <Shield size={14} /> Owner permissions are immutable and always have full access.
            </div>

            {/* Matrix Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-48 text-slate-400">
                        <RefreshCw size={24} className="animate-spin" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide w-44">Permission</th>
                                    {ROLES.map(role => (
                                        <th key={role} className={`px-5 py-3.5 text-center text-xs font-bold uppercase tracking-wide ${ROLE_COLORS[role]}`}>
                                            {role}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {MODULES.map(mod => (
                                    <React.Fragment key={mod.group}>
                                        {/* Group header */}
                                        <tr className="bg-slate-50/70 dark:bg-slate-700/20">
                                            <td colSpan={ROLES.length + 1} className="px-5 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                                {mod.group}
                                            </td>
                                        </tr>
                                        {mod.keys.map(key => (
                                            <tr key={key} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors">
                                                <td className="px-5 py-3 text-sm text-slate-700 dark:text-slate-300 font-medium">
                                                    {PERM_LABELS[key] || key}
                                                </td>
                                                {ROLES.map(role => (
                                                    <td key={role} className="px-5 py-3 text-center">
                                                        <div className="flex justify-center">
                                                            <Toggle
                                                                enabled={draft[role]?.[key] || false}
                                                                onChange={val => handleToggle(role, key, val)}
                                                                locked={role === 'owner'}
                                                            />
                                                        </div>
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
