import React, { useCallback, useEffect, useState } from 'react';
import { History, Loader2, RotateCcw, RefreshCw } from 'lucide-react';
import api from '@services/api';
import ToolbarModalShell, { SecondaryButton, PrimaryButton } from './chatWindowComp/modals/ToolbarModalShell';
import { decryptTextOrNull } from '../../services/messageEncryptionService';
import { diffWords } from '../../utils/textDiff';
import { getMessageText } from '../../utils/messageActionUtils';
import logger from '../../utils/logger';

const fmt = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
};

async function versionText(v, conversationId, conversationType) {
    if (v.ciphertext && v.messageIv) {
        return decryptTextOrNull(v.ciphertext, v.messageIv, conversationId, conversationType);
    }
    if (v.isEncrypted) return null;
    return typeof v.text === 'string' && v.text !== '[encrypted]' ? v.text : null;
}

/**
 * Version history of a message (GET /api/v2/messages/:id/versions). Every
 * version is decrypted client-side with the conversation key, shown newest
 * first with a word diff against the version before it, and the sender can
 * restore an older version (POST /:id/restore).
 */
export default function MessageDiffViewer({ msg, conversationId, conversationType, currentUserId, onClose, onRestored, showToast }) {
    const messageId = msg._id || msg.id;
    const [state, setState] = useState({ status: 'loading', versions: [], canRestore: false, isSender: false, error: null });
    const [restoring, setRestoring] = useState(null);

    const load = useCallback(async () => {
        setState(s => ({ ...s, status: 'loading', error: null }));
        try {
            const { data } = await api.get(`/api/v2/messages/${messageId}/versions`);
            const history = Array.isArray(data?.versions) ? data.versions : [];
            const current = data?.current || null;
            const all = history.map(v => ({ ...v, isCurrent: false }));
            if (current && !all.some(v => v.version != null && v.version === current.version)) {
                all.push({ ...current, isCurrent: true });
            } else if (current) {
                all.forEach(v => { if (v.version === current.version) v.isCurrent = true; });
            }
            const texts = await Promise.all(all.map(v => versionText(v, conversationId, conversationType)));
            const withText = all.map((v, i) => ({
                ...v,
                plaintext: texts[i] ?? (v.isCurrent ? (getMessageText(msg) || null) : null),
            }));
            const enriched = withText.map((v, i) => {
                const prev = withText[i - 1];
                const diff = i > 0 && v.plaintext != null && prev?.plaintext != null ? diffWords(prev.plaintext, v.plaintext) : null;
                return { ...v, isOriginal: i === 0, position: i + 1, diff };
            });
            setState({
                status: 'done',
                versions: enriched.reverse(),
                canRestore: !!data?.canRestore,
                isSender: String(data?.senderId || '') === String(currentUserId || ''),
                error: null,
            });
        } catch (err) {
            logger.error('[VersionHistory] load failed:', err);
            setState(s => ({ ...s, status: 'error', error: err?.response?.data?.message || 'Could not load edit history.' }));
        }
    }, [messageId, conversationId, conversationType, currentUserId, msg]);

    useEffect(() => { load(); }, [messageId]);

    const restore = async (v) => {
        setRestoring(v.index);
        try {
            const { data } = await api.post(`/api/v2/messages/${messageId}/restore`, { versionIndex: v.index });
            onRestored?.(data?.message, v.plaintext, v.version ?? v.position);
            showToast?.(`Restored version ${v.version ?? v.position}`, 'success');
            await load();
        } catch (err) {
            showToast?.(err?.response?.data?.message || 'Failed to restore this version', 'error');
        } finally {
            setRestoring(null);
        }
    };

    const showRestore = state.canRestore && state.isSender;

    return (
        <ToolbarModalShell
            title="Edit history"
            icon={<History size={14} style={{ color: 'var(--accent)' }} />}
            onClose={onClose}
            width={560}
            footer={(
                <>
                    {state.status === 'error' && <SecondaryButton onClick={load}><RefreshCw size={12} /> Retry</SecondaryButton>}
                    <PrimaryButton onClick={onClose}>Close</PrimaryButton>
                </>
            )}
        >
            {state.status === 'loading' && state.versions.length === 0 && (
                <div style={{ padding: '24px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} /> Loading and decrypting versions…
                </div>
            )}
            {state.status === 'error' && (
                <div role="alert" style={{ padding: '16px', fontSize: '12px', color: 'var(--state-danger)' }}>{state.error}</div>
            )}
            {state.versions.length > 0 && (
                <div>
                    <div style={{ padding: '10px 16px', fontSize: '11px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                        {state.versions.length} {state.versions.length === 1 ? 'version' : 'versions'} · newest first
                        {' · '}<span style={{ color: 'var(--accent)' }}>added</span> / <span style={{ textDecoration: 'line-through' }}>removed</span> compared with the previous version
                    </div>
                    {state.versions.map(v => (
                        <div key={`${v.version ?? v.position}-${v.index ?? 'c'}`} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', backgroundColor: v.isCurrent ? 'rgba(184,149,106,0.05)' : 'transparent' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Version {v.version ?? v.position}</span>
                                {v.isCurrent && <Tag accent>Current</Tag>}
                                {v.isOriginal && <Tag>Original</Tag>}
                                {v.restoredFromVersion && <Tag>Restored from v{v.restoredFromVersion}</Tag>}
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>{fmt(v.editedAt)}</span>
                            </div>
                            <div style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {v.plaintext == null ? (
                                    <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Unable to decrypt this version</span>
                                ) : v.diff ? (
                                    v.diff.map((seg, i) => (
                                        seg.type === 'same' ? <span key={i}>{seg.text}</span>
                                            : seg.type === 'added'
                                                ? <span key={i} style={{ color: 'var(--accent)', backgroundColor: 'rgba(184,149,106,0.15)', borderRadius: '2px' }}>{seg.text}</span>
                                                : <span key={i} style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>{seg.text}</span>
                                    ))
                                ) : v.plaintext}
                            </div>
                            {showRestore && !v.isCurrent && v.plaintext != null && v.index != null && (
                                <div style={{ marginTop: '8px' }}>
                                    <SecondaryButton onClick={() => restore(v)} disabled={restoring != null}>
                                        {restoring === v.index ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <RotateCcw size={12} />}
                                        Restore this version
                                    </SecondaryButton>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </ToolbarModalShell>
    );
}

function Tag({ children, accent }) {
    return (
        <span style={{
            fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '2px',
            border: `1px solid ${accent ? 'var(--accent)' : 'var(--border-default)'}`,
            color: accent ? 'var(--accent)' : 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
            {children}
        </span>
    );
}
