import React, { useCallback, useEffect, useState } from 'react';
import { Sparkles, Loader2, Copy, Check, RefreshCw } from 'lucide-react';
import api from '@services/api';
import ToolbarModalShell, { PrimaryButton, SecondaryButton } from './ToolbarModalShell';
import { batchDecryptMessages } from '../../../../services/messageEncryptionService';
import { getMessageText } from '../../../../utils/messageActionUtils';
import logger from '../../../../utils/logger';

/**
 * Fetches a thread, decrypts its replies client-side (same conversation key the
 * ThreadPanel uses) and asks the server for an AI summary of the plaintext.
 */
export default function ThreadSummaryModal({ msg, conversationId, conversationType, onClose, showToast }) {
    const [state, setState] = useState({ status: 'loading', summary: '', error: null, replyCount: 0 });
    const [copied, setCopied] = useState(false);
    const messageId = msg._id || msg.id;

    const run = useCallback(async () => {
        setState({ status: 'loading', summary: '', error: null, replyCount: 0 });
        try {
            const res = await api.get(`/api/v2/messages/thread/${messageId}`);
            const raw = (res.data?.replies || [])
                .filter(r => r?._id && r.payload?.ciphertext && r.payload?.messageIv)
                .map(r => ({ ...r, id: r._id, isThreadEncrypted: false }));
            const decrypted = raw.length
                ? await batchDecryptMessages(raw, conversationId, conversationType, null)
                : [];
            const replies = decrypted
                .filter(r => r.isDecryptable && r.decryptedContent)
                .map(r => ({ sender: r.sender?.username || 'Someone', text: r.decryptedContent }));
            if (replies.length === 0) {
                setState({ status: 'error', summary: '', error: 'No readable replies to summarize.', replyCount: 0 });
                return;
            }
            const sum = await api.post('/api/v2/messages/ai/thread-summary', {
                parentMessageId: messageId,
                parentText: getMessageText(msg),
                replies,
            });
            const summary = sum.data?.summary;
            if (!summary) throw new Error('Empty summary');
            setState({ status: 'done', summary, error: null, replyCount: replies.length });
        } catch (err) {
            logger.error('[ThreadSummary] failed:', err);
            const status = err?.response?.status;
            setState({
                status: 'error',
                summary: '',
                error: status === 503 ? 'The AI service is unavailable right now. Try again later.' : (err?.response?.data?.message || 'Could not summarize this thread.'),
                replyCount: 0,
            });
        }
    }, [messageId, conversationId, conversationType, msg]);

    // Runs once per opened message.
    useEffect(() => { run(); }, [messageId]);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(state.summary);
            setCopied(true);
            showToast?.('Summary copied', 'success');
            setTimeout(() => setCopied(false), 1500);
        } catch {
            showToast?.('Could not copy to clipboard', 'error');
        }
    };

    return (
        <ToolbarModalShell
            title="Thread summary"
            icon={<Sparkles size={14} style={{ color: 'var(--accent)' }} />}
            onClose={onClose}
            width={480}
            footer={(
                <>
                    {state.status === 'error' && <SecondaryButton onClick={run}><RefreshCw size={12} /> Retry</SecondaryButton>}
                    {state.status === 'done' && (
                        <SecondaryButton onClick={copy}>{copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}</SecondaryButton>
                    )}
                    <PrimaryButton onClick={onClose}>Done</PrimaryButton>
                </>
            )}
        >
            <div style={{ padding: '16px', fontSize: '13px', lineHeight: 1.65, color: 'var(--text-primary)' }}>
                {state.status === 'loading' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
                        Reading and summarizing the thread…
                    </div>
                )}
                {state.status === 'error' && (
                    <div role="alert" style={{ color: 'var(--state-danger)' }}>{state.error}</div>
                )}
                {state.status === 'done' && (
                    <>
                        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{state.summary}</div>
                        <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
                            Based on {state.replyCount} {state.replyCount === 1 ? 'reply' : 'replies'}
                        </div>
                    </>
                )}
            </div>
        </ToolbarModalShell>
    );
}
