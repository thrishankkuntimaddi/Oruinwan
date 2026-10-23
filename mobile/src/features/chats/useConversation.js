// Messages for one conversation (or one thread), with optimistic sends and reactions.
import { useCallback, useEffect, useMemo } from 'react';
import { api, useSession } from '../../data/session.js';
import { getQueryData, invalidate, setQueryData, useQuery } from '../../data/query.js';
import { uid } from '../../lib/id.js';
import { on, toast } from '../../lib/bus.js';
import { mapChecklist, mapPoll } from '../../data/live/adapter.chats.js';
import { mentionsAI } from '../../lib/aiMention.js';
import { cancelUpload, retryUpload, sendFiles, useUploads } from './uploads.js';
import { enqueue, isNetworkError, isOffline, retryQueued, useQueuedMessages } from '../../data/outbox.js';

function toggleReaction(m, emoji, me) {
  const users = new Set(m.reactions?.[emoji] || []);
  if (users.has(me)) users.delete(me);
  else users.add(me);
  const reactions = { ...m.reactions, [emoji]: [...users] };
  if (!users.size) delete reactions[emoji];
  return { ...m, reactions };
}

export function useConversation(conv, { threadOf, name, agentId = null } = {}) {
  const me = useSession((s) => s.user?.id);
  const key = threadOf ? `thread:${threadOf}` : conv?.id && `messages:${conv.id}`;
  const query = useQuery(key, () =>
    threadOf
      ? api().threadInfo
        ? api()
            .threadInfo(conv, threadOf)
            .then(({ replies, parent, ...meta }) => ({ items: replies, parent, hasMore: false, meta }))
        : api()
            .thread(conv, threadOf)
            .then((t) => ({ items: t.replies, parent: t.parent, hasMore: false }))
      : api().messages(conv),
  );

  // Live poll votes, checklist ticks and thread resolve state, patched in place.
  useEffect(() => {
    if (!key) return undefined;
    const patchOne = (id, fn) =>
      setQueryData(key, (d) =>
        d
          ? {
              ...d,
              items: d.items.map((m) => (m.id === id ? fn(m) : m)),
              parent: d.parent?.id === id ? fn(d.parent) : d.parent,
            }
          : d,
      );
    return on('socket', ({ event, payload: p } = {}) => {
      const id = p?.messageId && String(p.messageId);
      if (!id) return;
      if (event === 'poll:vote_updated' && p.poll) patchOne(id, (m) => ({ ...m, poll: mapPoll(p.poll, m.authorId) }));
      else if (event === 'message:checklist_updated' && Array.isArray(p.checklist)) patchOne(id, (m) => ({ ...m, checklist: mapChecklist(p.checklist) }));
      else if (event === 'thread-resolved') {
        patchOne(id, (m) => ({ ...m, resolved: Boolean(p.isResolved) }));
        if (threadOf === id) setQueryData(key, (d) => (d?.meta ? { ...d, meta: { ...d.meta, resolved: Boolean(p.isResolved) } } : d));
      }
    });
  }, [key, threadOf]);

  // Mark the conversation read when it opens, whenever someone else's message arrives while it's
  // on screen, when the app comes back to the foreground and when the socket reconnects, so the
  // sender's Message info shows the read (it used to be marked only once, on open).
  const items0 = query.data?.items;
  const latestFromOthers = useMemo(() => {
    for (let i = (items0?.length || 0) - 1; i >= 0; i -= 1) {
      const m = items0[i];
      if (m && !m.pending && m.authorId && m.authorId !== me) return m.id;
    }
    return null;
  }, [items0, me]);
  useEffect(() => {
    if (!conv?.id || threadOf) return undefined;
    const mark = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      Promise.resolve(api().markRead?.(conv)).catch(() => {});
    };
    mark();
    const offRealtime = on('realtime', (s) => s?.connected && mark());
    const onVisible = () => document.visibilityState === 'visible' && mark();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      offRealtime?.();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [conv?.id, conv?.kind, threadOf, latestFromOthers]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = useCallback((fn) => setQueryData(key, (d) => (d ? { ...d, items: fn(d.items) } : d)), [key]);

  const sendNow = useCallback(
    async (text, { retryId, mentionText } = {}) => {
      const body = text.trim();
      if (!body) return;
      const tempId = retryId || uid('tmp');
      const optimistic = {
        id: tempId,
        convId: conv.id,
        authorId: me,
        text: body,
        at: new Date().toISOString(),
        reactions: {},
        pending: true,
        failed: false,
        parentId: threadOf || null,
        state: 'ok',
      };
      patch((items) => (retryId ? items.map((m) => (m.id === retryId ? optimistic : m)) : [...items, optimistic]));
      try {
        const saved = await api().sendMessage(conv, body, { parentId: threadOf, clientTempId: tempId, mentionText });
        patch((items) => {
          // The realtime echo may already have added the saved message.
          const withoutTemp = items.filter((m) => m.id !== tempId);
          return withoutTemp.some((m) => m.id === saved.id) ? withoutTemp : [...withoutTemp, saved];
        });
        if (threadOf) invalidate(`messages:${conv.id}`);
        // @ai (or a chat with an agent, where every message is for it): the assistant answers here,
        // with the recent conversation as context.
        if ((agentId || mentionsAI(body)) && api().askAiInConversation) {
          const recent = (getQueryData(key)?.items || []).slice(-40).map((m) => ({
            sender: m.authorId === me ? 'Me' : m.author?.name || 'Someone',
            text: m.text,
            isMe: m.authorId === me,
          }));
          api()
            .askAiInConversation(conv, {
              prompt: body,
              triggerMessageId: agentId ? null : saved.id,
              parentId: threadOf || null,
              messages: recent,
              conversationName: name,
              ...(agentId ? { assistant: agentId } : {}),
            })
            .catch((err) => toast(err.message || 'Oruinwan AI could not answer right now.', 'danger'));
        }
      } catch (err) {
        // No connection: hand it to the offline queue (same id, so the server dedupes a retry).
        if (isNetworkError(err)) {
          patch((items) => items.filter((m) => m.id !== tempId));
          enqueue({ conv, key, parentId: threadOf || null, text: body, clientMessageId: tempId, mentionText });
          return;
        }
        patch((items) => items.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true, error: err.message } : m)));
      }
    },
    [conv, me, patch, threadOf, key, name, agentId],
  );

  // Offline: messages are encrypted and queued, then sent in order when back online (data/outbox.js).
  const send = useCallback(
    (text, opts) => (isOffline() && text.trim() && !opts?.retryId ? enqueue({ conv, key, parentId: threadOf || null, text: text.trim(), mentionText: opts?.mentionText }) : sendNow(text, opts)),
    [conv, key, threadOf, sendNow],
  );

  const react = useCallback(
    async (messageId, emoji) => {
      const current = getQueryData(key);
      const target = current?.items?.find((m) => m.id === messageId) || (current?.parent?.id === messageId ? current.parent : null);
      const add = !(target?.reactions?.[emoji] || []).includes(me);
      patch((items) => items.map((m) => (m.id === messageId ? toggleReaction(m, emoji, me) : m)));
      if (threadOf) {
        setQueryData(key, (d) => (d?.parent?.id === messageId ? { ...d, parent: toggleReaction(d.parent, emoji, me) } : d));
      }
      try {
        await api().react(conv, messageId, emoji, add);
      } catch (err) {
        toast(err.message || 'Could not react', 'danger');
        invalidate(key);
      }
    },
    [conv, key, me, patch, threadOf],
  );

  const remove = useCallback(
    async (messageId) => {
      const before = getQueryData(key);
      patch((items) => items.filter((m) => m.id !== messageId));
      try {
        await api().deleteMessage(conv, messageId);
        // A deleted reply changes its parent's reply count in the conversation.
        if (threadOf) invalidate(`messages:${conv.id}`);
      } catch (err) {
        setQueryData(key, before);
        toast(err.message || 'Could not delete the message', 'danger');
      }
    },
    [conv, key, patch, threadOf],
  );

  const edit = useCallback(
    async (messageId, text) => {
      patch((items) => items.map((m) => (m.id === messageId ? { ...m, text, edited: true } : m)));
      try {
        await api().editMessage(conv, messageId, text);
      } catch (err) {
        toast(err.message || 'Could not edit the message', 'danger');
        invalidate(key);
      }
    },
    [conv, key, patch],
  );

  // Files still uploading (or failed, waiting for Retry) follow the sent messages.
  const uploads = useUploads(key);
  const queued = useQueuedMessages(key);
  const items = query.data?.items || [];
  const merged = uploads.length || queued.length ? [...items, ...uploads, ...queued] : items;

  /** Replaces one message (or the thread's parent) in the cache. */
  const patchMessage = useCallback(
    (id, fn) => setQueryData(key, (d) => (d ? { ...d, items: d.items.map((m) => (m.id === id ? fn(m) : m)), parent: d.parent?.id === id ? fn(d.parent) : d.parent } : d)),
    [key],
  );
  /** Adds a message sent outside send() (a poll or checklist), unless the realtime echo already did. */
  const append = useCallback((m) => setQueryData(key, (d) => (d && !d.items.some((x) => x.id === m.id) ? { ...d, items: [...d.items, m] } : d)), [key]);
  const patchMeta = useCallback((p) => setQueryData(key, (d) => (d ? { ...d, meta: { ...(d.meta || {}), ...p } } : d)), [key]);

  return {
    items: merged,
    key,
    meta: query.data?.meta || null,
    patchMessage,
    patchMeta,
    append,
    parent: query.data?.parent || null,
    hasMore: query.data?.hasMore || false,
    loading: query.loading,
    error: query.error,
    refetch: query.refetch,
    send,
    retry: (m) => (m.queued ? retryQueued(m.id) : m.upload ? retryUpload(m.id) : send(m.text, { retryId: m.id })),
    /** Uploads files and sends each one as its own message. */
    sendFiles: (files) => sendFiles({ key, conv, threadOf, me, files }),
    cancelUpload,
    react,
    remove,
    edit,
  };
}
