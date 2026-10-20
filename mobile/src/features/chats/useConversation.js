// Messages for one conversation (or one thread), with optimistic sends and reactions.
import { useCallback, useEffect } from 'react';
import { api, useSession } from '../../data/session.js';
import { getQueryData, invalidate, setQueryData, useQuery } from '../../data/query.js';
import { uid } from '../../lib/id.js';
import { toast } from '../../lib/bus.js';
import { mentionsAI } from '../../lib/aiMention.js';
import { cancelUpload, retryUpload, sendFiles, useUploads } from './uploads.js';

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
        patch((items) => items.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true, error: err.message } : m)));
      }
    },
    [conv, me, patch, threadOf, key, name, agentId],
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
  const items = query.data?.items || [];
  const merged = uploads.length ? [...items, ...uploads] : items;

  return {
    items: merged,
    parent: query.data?.parent || null,
    hasMore: query.data?.hasMore || false,
    loading: query.loading,
    error: query.error,
    refetch: query.refetch,
    send,
    retry: (m) => (m.upload ? retryUpload(m.id) : send(m.text, { retryId: m.id })),
    /** Uploads files and sends each one as its own message. */
    sendFiles: (files) => sendFiles({ key, conv, threadOf, me, files }),
    cancelUpload,
    react,
    remove,
    edit,
  };
}
