import React, { useEffect, useMemo, useState } from 'react';
import { UserPlus, Users } from 'lucide-react';
import api from '@services/api';
import { Dialog, Btn, SearchBox, SelectBox, Avatar, EmptyState, LoadingState, errorMessage } from '../../components/ui/page';

/**
 * Roles the file library understands. Everyone in the workspace can already open and download
 * a library file; an explicit "edit" grant lets someone rename it, change its tags and upload or
 * restore versions. ("download" is an older role that the server treats as edit too.)
 */
export const SHARE_ROLES = [
    { value: 'view', label: 'Can view' },
    { value: 'edit', label: 'Can edit' },
];
const roleValue = (r) => (r === 'download' ? 'edit' : r || 'view');

const idOf = (u) => String(u?._id || u?.id || u || '');

/**
 * Diff the rows the dialog shows against what the file had, as the `permissions` array
 * POST /api/v2/files/:id/share expects ([{ user, role }]). Only changed rows are sent.
 */
export function permissionChanges(original = [], rows = []) {
    const before = new Map(original.map((p) => [idOf(p.user), roleValue(p.role)]));
    return rows
        .filter((r) => before.get(String(r.user)) !== r.role)
        .map((r) => ({ user: String(r.user), role: r.role }));
}

export default function FileShareDialog({ open, file, workspaceId, isOwner, onClose, shareFile, onShared, showToast }) {
    const [members, setMembers] = useState([]);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [rows, setRows] = useState([]);
    const [query, setQuery] = useState('');
    const [newRole, setNewRole] = useState('edit');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setRows((file?.permissions || []).map((p) => ({ user: idOf(p.user), role: roleValue(p.role) })));
        setQuery('');
    }, [open, file]);

    useEffect(() => {
        if (!open || !workspaceId) return undefined;
        let cancelled = false;
        setLoadingMembers(true);
        api.get(`/api/workspaces/${workspaceId}/members`)
            .then(({ data }) => { if (!cancelled) setMembers(Array.isArray(data) ? data : (data?.members || [])); })
            .catch(() => { if (!cancelled) setMembers([]); })
            .finally(() => { if (!cancelled) setLoadingMembers(false); });
        return () => { cancelled = true; };
    }, [open, workspaceId]);

    const byId = useMemo(() => new Map(members.map((m) => [idOf(m), m])), [members]);
    const ownerId = idOf(file?.createdBy);
    const candidates = useMemo(() => {
        const listed = new Set(rows.map((r) => String(r.user)));
        const q = query.trim().toLowerCase();
        if (!q) return [];
        return members
            .filter((m) => idOf(m) !== ownerId && !listed.has(idOf(m)))
            .filter((m) => `${m.username || ''} ${m.email || ''}`.toLowerCase().includes(q))
            .slice(0, 6);
    }, [members, query, ownerId, rows]);

    const addPerson = (m) => {
        setRows((prev) => [...prev, { user: idOf(m), role: newRole }]);
        setQuery('');
    };
    const setRole = (user, role) => setRows((prev) => prev.map((r) => (r.user === user ? { ...r, role } : r)));

    const changes = permissionChanges(file?.permissions || [], rows);

    const save = async () => {
        if (!changes.length) { onClose(); return; }
        setSaving(true);
        try {
            const data = await shareFile(file._id, changes);
            onShared?.(data?.file);
            showToast?.('Access updated', 'success');
            onClose();
        } catch (err) {
            showToast?.(errorMessage(err, 'Couldn’t update access'), 'error');
        } finally {
            setSaving(false);
        }
    };

    const nameOf = (id) => {
        const m = byId.get(String(id));
        return m?.username || m?.email || 'Workspace member';
    };
    const owner = file?.createdBy && typeof file.createdBy === 'object' ? file.createdBy : byId.get(ownerId);

    return (
        <Dialog
            open={open}
            title={`Share “${file?.name || 'file'}”`}
            lead="Everyone in this workspace can open and download it. People who can edit may rename it, change its tags and upload or restore versions."
            onClose={onClose}
            busy={saving}
            footer={isOwner ? (
                <>
                    <Btn variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn>
                    <Btn variant="primary" loading={saving} onClick={save} disabled={!changes.length}>Save access</Btn>
                </>
            ) : <Btn variant="ghost" onClick={onClose}>Close</Btn>}
        >
            {isOwner && (
                <div className="fl-share-add">
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <SearchBox value={query} onChange={setQuery} placeholder="Add people by name or email" label="Add people" />
                    </div>
                    <SelectBox value={newRole} onChange={setNewRole} label="Role for new people" style={{ width: 120 }}>
                        {SHARE_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </SelectBox>
                </div>
            )}
            {candidates.length > 0 && (
                <ul className="fl-share-list gl-card" aria-label="Matching people">
                    {candidates.map((m) => (
                        <li key={idOf(m)}>
                            <button type="button" className="fl-share-pick" onClick={() => addPerson(m)}>
                                <Avatar name={m.username || m.email} src={m.profilePicture} size="sm" />
                                <span className="fl-share-name">{m.username || m.email}<small>{m.email}</small></span>
                                <UserPlus size={14} style={{ color: 'var(--accent)' }} />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <div className="fl-share-section">People with access</div>
            {loadingMembers && !members.length ? <LoadingState label="Loading people…" /> : (
                <ul className="fl-share-list gl-card">
                    <li className="fl-share-row">
                        <Avatar name={owner?.username || 'Owner'} src={owner?.profilePicture} size="sm" />
                        <span className="fl-share-name">{owner?.username || nameOf(ownerId)}<small>Owner</small></span>
                        <span className="fl-meta" style={{ marginTop: 0 }}>Full access</span>
                    </li>
                    {rows.map((r) => (
                        <li key={r.user} className="fl-share-row">
                            <Avatar name={nameOf(r.user)} src={byId.get(String(r.user))?.profilePicture} size="sm" />
                            <span className="fl-share-name">{nameOf(r.user)}<small>{byId.get(String(r.user))?.email || ''}</small></span>
                            {isOwner ? (
                                <SelectBox value={r.role} onChange={(v) => setRole(r.user, v)} label={`Access for ${nameOf(r.user)}`} style={{ width: 120 }}>
                                    {SHARE_ROLES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </SelectBox>
                            ) : (
                                <span className="fl-meta" style={{ marginTop: 0 }}>{SHARE_ROLES.find((o) => o.value === r.role)?.label}</span>
                            )}
                        </li>
                    ))}
                    {rows.length === 0 && (
                        <li><EmptyState icon={Users} title="Only the owner can edit" text={isOwner ? 'Add people above to let them edit this file.' : 'Ask the owner if you need to change this file.'} /></li>
                    )}
                </ul>
            )}
            {!isOwner && <p className="fl-meta" style={{ whiteSpace: 'normal' }}>Only the person who uploaded the file can change who has access.</p>}
        </Dialog>
    );
}

export const FILE_SHARE_CSS = `
.fl-share-add { display: flex; gap: 8px; align-items: center; }
.fl-share-section { margin: 14px 0 6px; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--text-muted); }
.fl-share-list { list-style: none; margin: 8px 0 0; padding: 0; max-height: 260px; overflow-y: auto; }
.fl-share-list > li + li { border-top: 1px solid var(--border-subtle); }
.fl-share-row, .fl-share-pick { display: flex; align-items: center; gap: 10px; padding: 8px 12px; min-width: 0; }
.fl-share-pick { width: 100%; background: none; border: 0; font: inherit; color: inherit; text-align: left; cursor: pointer; }
.fl-share-pick:hover, .fl-share-pick:focus-visible { background: var(--bg-hover); }
.fl-share-name { flex: 1; min-width: 0; font-size: 13px; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fl-share-name small { display: block; font-size: 11px; font-weight: 400; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; }
`;
