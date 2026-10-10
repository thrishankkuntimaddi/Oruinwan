// Messages for one conversation (or one thread), with optimistic sends and reactions.
import { useCallback, useEffect } from 'react';
import { api, useSession } from '../../data/session.js';
import { getQueryData, invalidate, setQueryData, useQuery } from '../../data/query.js';
import { uid } from '../../lib/id.js';
import { toast } from '../../lib/bus.js';

function toggleReaction(m, emoji, me) {
  const users = new Set(m.reactions?.[emoji] || []);
  if (users.has(me)) users.delete(me);
  else users.add(me);
  const reactions = { ...m.reactions, [emoji]: [...users] };
  if (!users.size) delete reactions[emoji];
  return { ...m, reactions };
}

export function useConversation(conv, { threadOf } = {}) {
  const me = useSession((s) => s.user?.id);
  const key = threadOf ? `thread:${threadOf}` : conv?.id && `messages:${conv.id}`;
  const query = useQuery(key, () =>
    threadOf
      ? api()
          .thread(conv, threadOf)
          .then((t) => ({ items: t.replies, parent: t.parent, hasMore: false }))
      : api().messages(conv),
  );

  useEffect(() => {
    if (!conv?.id || threadOf) return;
    api().markRead?.(conv).catch(() => {});
  }, [conv?.id, conv?.kind, threadOf]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = useCallback((fn) => setQueryData(key, (d) => (d ? { ...d, items: fn(d.items) } : d)), [key]);

  const send = useCallback(
    async (text, { retryId } = {}) => {
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
        const saved = await api().sendMessage(conv, body, { parentId: threadOf, clientTempId: tempId });
        patch((items) => {
          // The realtime echo may already have added the saved message.
          const withoutTemp = items.filter((m) => m.id !== tempId);
          return withoutTemp.some((m) => m.id === saved.id) ? withoutTemp : [...withoutTemp, saved];
        });
        if (threadOf) invalidate(`messages:${conv.id}`);
      } catch (err) {
        patch((items) => items.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true, error: err.message } : m)));
      }
    },
    [conv, me, patch, threadOf],
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
      } catch (err) {
        setQueryData(key, before);
        toast(err.message || 'Could not delete the message', 'danger');
      }
    },
    [conv, key, patch],
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

  return {
    items: query.data?.items || [],
    parent: query.data?.parent || null,
    hasMore: query.data?.hasMore || false,
    loading: query.loading,
    error: query.error,
    refetch: query.refetch,
    send,
    retry: (m) => send(m.text, { retryId: m.id }),
    react,
    remove,
    edit,
  };
}
