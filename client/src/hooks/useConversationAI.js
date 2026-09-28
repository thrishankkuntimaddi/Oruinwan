import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { aiErrorMessage } from '../services/aiService';

/** A message addressed to the assistant: @ai, @oruinwan, @oruinwan-ai, @OruinwanAI (mirrors the server). */
export const AI_MENTION_RE = /(^|[\s(])@(ai|oruinwan(?:[-_ ]?ai)?)\b/i;
export const mentionsAI = (text) => AI_MENTION_RE.test(String(text || ''));

/** Whether the message @mentions a person (anything other than the assistant). */
export const mentionsPerson = (mentionText) => String(mentionText || '')
    .split(/\s+/).filter((t) => t.startsWith('@'))
    .some((t) => !/^@(ai|oruinwan(?:[-_]?ai)?)$/i.test(t.replace(/[^@\w-]/g, '')));

const AI_NAME = 'Oruinwan AI';
const FOLLOW_UP_MS = 10 * 60 * 1000;

const TOOL_PROGRESS = {
    get_current_workspace: 'Checking the workspace', get_user_channels: 'Looking up channels', get_workspace_members: 'Looking up members',
    send_message_to_channel: 'Sending a message', send_direct_message: 'Sending a message', create_task: 'Creating a task',
    list_my_tasks: 'Reading tasks', update_task_status: 'Updating a task', create_note: 'Creating a note', list_recent_notes: 'Reading notes',
    search_workspace: 'Searching the workspace', schedule_meeting: 'Scheduling a meeting',
    remember_about_user: 'Saving to memory', forget_about_user: 'Updating memory',
};

/**
 * Oruinwan AI inside one conversation.
 *
 * - `replies`: live (still generating) AI answers for this conversation, from the
 *   `ai:reply` socket event, so every member sees the assistant typing.
 *   Each: { replyId, parentId, text, status, error }.
 * - `ask(...)`: request an in-conversation answer (call after sending a message that mentions the AI).
 */
export default function useConversationAI({ socket, conversationId, conversationType, workspaceId, currentUserId, onError }) {
    const [replies, setReplies] = useState({});
    // Follow-up sessions: after the AI answers you in a view ('main' or a thread's
    // parent id), your next message there goes to the AI without a mention.
    const [followUps, setFollowUps] = useState({}); // viewKey -> expiresAt
    const repliesRef = useRef(replies);
    repliesRef.current = replies;

    useEffect(() => { setReplies({}); setFollowUps({}); }, [conversationId]);

    const endFollowUp = useCallback((parentId = null) => {
        const key = parentId ? String(parentId) : 'main';
        setFollowUps((prev) => { if (!prev[key]) return prev; const next = { ...prev }; delete next[key]; return next; });
    }, []);

    // Expire sessions on time.
    useEffect(() => {
        const keys = Object.keys(followUps);
        if (!keys.length) return undefined;
        const soonest = Math.min(...keys.map((k) => followUps[k]));
        const t = setTimeout(() => {
            const now = Date.now();
            setFollowUps((prev) => Object.fromEntries(Object.entries(prev).filter(([, until]) => until > now)));
        }, Math.max(0, soonest - Date.now()) + 50);
        return () => clearTimeout(t);
    }, [followUps]);

    // Someone else posting in a view ends the follow-up there (you're talking to them now).
    useEffect(() => {
        if (!socket || !conversationId) return undefined;
        const isOther = (sender) => {
            const id = String(sender?._id || sender || '');
            return id && id !== String(currentUserId) && sender?.username !== AI_NAME;
        };
        const inThisConversation = (m) => String(m?.channel || m?.dm || '') === String(conversationId);
        const onMessage = (m) => { if (inThisConversation(m) && !m.parentId && isOther(m.sender)) endFollowUp(null); };
        const onThreadReply = (e) => { if (e?.reply && inThisConversation(e.reply) && isOther(e.reply.sender)) endFollowUp(e.parentId); };
        socket.on('new-message', onMessage);
        socket.on('thread-reply', onThreadReply);
        return () => { socket.off('new-message', onMessage); socket.off('thread-reply', onThreadReply); };
    }, [socket, conversationId, currentUserId, endFollowUp]);

    useEffect(() => {
        if (!socket || !conversationId) return undefined;
        const timers = new Set();
        const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };
        const drop = (id) => setReplies((prev) => { const next = { ...prev }; delete next[id]; return next; });

        const onReply = (e) => {
            if (!e || String(e.conversationId) !== String(conversationId)) return;
            const id = e.replyId;
            setReplies((prev) => {
                const cur = prev[id] || { replyId: id, parentId: e.parentId || null, requestedBy: e.requestedBy || null, text: '', status: 'Thinking…', error: null };
                switch (e.phase) {
                    case 'start': return { ...prev, [id]: cur };
                    case 'delta': return { ...prev, [id]: { ...cur, text: e.text || cur.text, status: null } };
                    case 'tool': return { ...prev, [id]: { ...cur, status: e.status === 'running' ? `${TOOL_PROGRESS[e.name] || e.name.replace(/_/g, ' ')}…` : null } };
                    case 'error': return { ...prev, [id]: { ...cur, status: null, error: e.message || 'Oruinwan AI could not answer.' } };
                    default: return prev;
                }
            });
            // The stored message has already been broadcast when 'end' arrives, so the live bubble can go.
            if (e.phase === 'end') {
                // Answered me: my next message in this view continues with the AI.
                const r = repliesRef.current[id];
                const requestedBy = r?.requestedBy || e.requestedBy;
                if (String(requestedBy) === String(currentUserId)) {
                    const key = (r?.parentId || e.parentId) ? String(r?.parentId || e.parentId) : 'main';
                    setFollowUps((f) => ({ ...f, [key]: Date.now() + FOLLOW_UP_MS }));
                }
                drop(id);
            }
            if (e.phase === 'error') later(() => drop(id), 8000);
        };
        socket.on('ai:reply', onReply);
        return () => {
            socket.off('ai:reply', onReply);
            timers.forEach(clearTimeout);
        };
    }, [socket, conversationId, currentUserId]);

    const ask = useCallback(async ({ prompt, triggerMessageId, parentId = null, messages = [], conversationName }) => {
        if (!conversationId || !prompt) return null;
        endFollowUp(parentId); // re-armed when this answer finishes
        try {
            const { data } = await api.post('/api/ai/reply', {
                workspaceId, conversationId, conversationType, parentId, triggerMessageId, conversationName,
                prompt, messages: messages.slice(-40),
            });
            return data?.replyId || null;
        } catch (err) {
            onError?.(aiErrorMessage(err, 'Oruinwan AI could not answer right now.'));
            return null;
        }
    }, [conversationId, conversationType, workspaceId, onError, endFollowUp]);

    const list = Object.values(replies);
    const isFollowUp = (parentId = null) => (followUps[parentId ? String(parentId) : 'main'] || 0) > Date.now();
    return {
        ask,
        isFollowUp,
        endFollowUp,
        mainReplies: list.filter((r) => !r.parentId),
        repliesFor: (parentId) => list.filter((r) => String(r.parentId) === String(parentId)),
    };
}
