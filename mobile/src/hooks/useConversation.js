/**
 * Shared chat state for a channel or DM: loading, pagination, E2EE, realtime
 * events, optimistic sends through the offline queue, reactions, typing, reads.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import {
  fetchChannelMessages, fetchDMMessages, sendChannelMessageApi, sendDirectMessageApi,
} from '../services/api/messages';
import {
  decryptMessages, decryptWithKey, encryptForSend, ensureDMKey, getConversationKey, KeyError,
} from '../services/crypto';
import {
  joinChannel, joinDM, markRead, sendTyping, addReaction, removeReaction, connectSocket,
} from '../services/socket';
import { on, toast } from '../services/events';
import { useSocketEvent } from './useSocketEvent';
import { useOfflineQueue } from './useOfflineQueue';
import { errorMessage } from '../services/http';
import { setForegroundConversation, clearForegroundConversation } from '../services/push';

const PAGE = 40;
export const idOf = (v) => (v == null ? null : String(v._id ?? v.id ?? v.user?._id ?? v.user ?? v));

function sortAsc(list) {
  return list.slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

/** Merge by _id (incoming wins but keeps decrypted text if the incoming copy has none). */
function mergeMessages(prev, incoming) {
  const map = new Map(prev.map((m) => [String(m._id), m]));
  for (const m of incoming) {
    const old = map.get(String(m._id));
    map.set(String(m._id), old && !m._text ? { ...m, _text: old._text, _state: old._state } : m);
  }
  return sortAsc(Array.from(map.values()));
}

export function useConversation({ type, id, workspaceId, otherUserId, me, e2eeStatus }) {
  const [convId, setConvId] = useState(type === 'channel' ? id : null);
  // Pushes about this conversation stay silent while it is open.
  useEffect(() => {
    const open = convId || id;
    if (!open) return undefined;
    setForegroundConversation(open);
    return () => clearForegroundConversation(open);
  }, [convId, id]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [keyError, setKeyError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [hasMoreNewer, setHasMoreNewer] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [joinedAt, setJoinedAt] = useState(null);
  const [joinError, setJoinError] = useState(null);
  const [typingName, setTypingName] = useState(null);

  const msgsRef = useRef([]);
  const convRef = useRef(convId);
  const olderInFlight = useRef(false);
  const newerInFlight = useRef(false);
  const typingTimer = useRef(null);
  const { dispatch } = useOfflineQueue();

  msgsRef.current = messages;
  convRef.current = convId;
  const meId = me?._id ? String(me._id) : null;

  const fetchPage = useCallback(async (params) => {
    if (type === 'channel') {
      const { data } = await fetchChannelMessages(id, params);
      return { ...data, conv: id };
    }
    const { data } = await fetchDMMessages(workspaceId, convRef.current || id, params);
    return { ...data, conv: data.dmSessionId || convRef.current };
  }, [type, id, workspaceId]);

  const decryptList = useCallback(async (list, conv) => {
    if (type === 'dm' && e2eeStatus === 'ready' && otherUserId && meId) {
      await ensureDMKey(conv, workspaceId, [meId, String(otherUserId)]).catch(() => {});
    }
    const res = await decryptMessages(list, conv, type);
    setKeyError(res.keyError || null);
    return res.messages;
  }, [type, e2eeStatus, otherUserId, meId, workspaceId]);

  // ── Initial load ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setMessages([]);
    (async () => {
      try {
        const data = await fetchPage({ limit: PAGE });
        if (cancelled) return;
        const conv = String(data.conv);
        convRef.current = conv;
        setConvId(conv);
        const list = await decryptList(sortAsc(data.messages || []), conv);
        if (cancelled) return;
        setMessages(list);
        setHasMore(!!data.hasMore);
        setHasMoreNewer(!!data.hasMoreNewer);
        setJoinedAt(data.userJoinedAt || null);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, 'Could not load messages'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-decrypt once E2EE becomes ready (e.g. after the unlock screen).
  useEffect(() => {
    if (e2eeStatus !== 'ready' || !convId) return undefined;
    const pending = msgsRef.current.filter((m) => m._state === 'locked' || m._state === 'nokey');
    if (!pending.length) return undefined;
    let cancelled = false;
    decryptList(pending.map(({ _state, _text, ...m }) => m), convId).then((list) => {
      if (!cancelled) setMessages((prev) => mergeMessages(prev, list));
    });
    return () => { cancelled = true; };
  }, [e2eeStatus, convId, decryptList]);

  // ── Rooms ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!convId) return undefined;
    let cleanup = () => {};
    let cancelled = false;
    connectSocket().then(() => {
      if (cancelled) return;
      if (type === 'channel') {
        const room = joinChannel(convId);
        room.ack().then((ack) => {
          if (cancelled) return;
          if (ack?.error && ack.code !== 'TIMEOUT' && ack.code !== 'NOT_CONNECTED') setJoinError(ack);
          else setJoinError(null);
        });
        cleanup = room.leave;
      } else {
        cleanup = joinDM(convId);
      }
      markRead(type, convId);
    }).catch(() => {});
    return () => { cancelled = true; cleanup(); };
  }, [type, convId]);

  useEffect(() => () => clearTimeout(typingTimer.current), []);

  // ── Realtime ──────────────────────────────────────────────────────────
  const belongs = useCallback((m) => {
    if (!m || m.parentId) return false;
    const target = type === 'channel' ? idOf(m.channel) : idOf(m.dm);
    return !!target && target === convRef.current;
  }, [type]);

  const ingest = useCallback(async (raw, clientTempId) => {
    if (!belongs(raw)) return;
    let key = null;
    let kErr = null;
    try { key = await getConversationKey(convRef.current, type); } catch (e) { kErr = e; }
    const msg = decryptWithKey(raw, key, kErr);
    const fromMe = idOf(msg.sender) === meId;
    setMessages((prev) => {
      let base = prev;
      if (clientTempId) base = base.filter((m) => m._tempId !== clientTempId);
      else if (fromMe && msg._state === 'ok') {
        const i = base.findIndex((m) => m._tempId && m._status === 'sending' && m._text === msg._text);
        if (i >= 0) base = base.filter((_, j) => j !== i);
      }
      return mergeMessages(base, [msg]);
    });
    if (!fromMe) markRead(type, convRef.current);
  }, [belongs, meId, type]);

  const onNewMessage = useCallback((payload) => {
    const raw = payload?.message && payload.message._id ? payload.message : payload;
    ingest(raw, payload?.clientTempId);
  }, [ingest]);

  useSocketEvent('new-message', onNewMessage);
  useSocketEvent('message-sent', onNewMessage);

  useSocketEvent('message-deleted', ({ messageId, isLocal, deletedByName } = {}) => {
    setMessages((prev) => (isLocal
      ? prev.filter((m) => String(m._id) !== String(messageId))
      : prev.map((m) => (String(m._id) === String(messageId)
        ? { ...m, isDeletedUniversally: true, _state: 'deleted', _text: deletedByName ? `Deleted by ${deletedByName}` : 'This message was deleted' }
        : m))));
  });

  const onReactions = useCallback(({ messageId, reactions } = {}) => {
    if (!Array.isArray(reactions)) return;
    setMessages((prev) => prev.map((m) => (String(m._id) === String(messageId) ? { ...m, reactions } : m)));
  }, []);
  useSocketEvent('reaction-added', onReactions);
  useSocketEvent('reaction-removed', onReactions);
  useSocketEvent('message:reaction_added', onReactions);
  useSocketEvent('message:reaction_removed', onReactions);

  const onTypingEvent = useCallback((p = {}) => {
    const target = type === 'channel' ? p.channelId : p.dmSessionId;
    if (!target || String(target) !== convRef.current) return;
    if (idOf(p.from ?? p.userId) === meId) return;
    setTypingName(p.fromName || p.username || 'Someone');
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTypingName(null), 3500);
  }, [type, meId]);
  useSocketEvent('typing', onTypingEvent);
  useSocketEvent('user-typing', onTypingEvent);

  useSocketEvent('read-update', ({ readerId, dmSessionId, channelId } = {}) => {
    const target = dmSessionId || channelId;
    if (!target || String(target) !== convRef.current || idOf(readerId) === meId) return;
    setMessages((prev) => prev.map((m) => {
      if (idOf(m.sender) !== meId || m._tempId) return m;
      const readBy = Array.isArray(m.readBy) ? m.readBy : [];
      return readBy.some((r) => idOf(r) === idOf(readerId)) ? m : { ...m, readBy: [...readBy, readerId] };
    }));
  });

  const markTemp = useCallback((clientTempId, patch) => {
    setMessages((prev) => prev.map((m) => (m._tempId === clientTempId ? { ...m, ...patch } : m)));
  }, []);

  useSocketEvent('send-error', ({ clientTempId, message } = {}) => {
    if (!clientTempId || !msgsRef.current.some((m) => m._tempId === clientTempId)) return;
    markTemp(clientTempId, { _status: 'failed' });
    toast(message || 'Message failed to send', 'error');
  });

  // Offline-queue results for messages queued from this conversation.
  useEffect(() => {
    const a = on('queue:processed', ({ item, result }) => {
      const tmp = item?.payload?.clientTempId;
      const temp = tmp && msgsRef.current.find((m) => m._tempId === tmp);
      if (!temp) return;
      if (result?._id) {
        setMessages((prev) => mergeMessages(prev.filter((m) => m._tempId !== tmp), [
          { ...result, _text: temp._text, _state: 'ok' },
        ]));
      } else {
        markTemp(tmp, { _status: 'sent' });
      }
    });
    const b = on('queue:failed', ({ item, error: err }) => {
      const tmp = item?.payload?.clientTempId;
      if (tmp && msgsRef.current.some((m) => m._tempId === tmp)) {
        markTemp(tmp, { _status: 'failed' });
        toast(errorMessage(err, 'Queued message could not be sent'), 'error');
      }
    });
    return () => { a(); b(); };
  }, [markTemp]);

  // ── Pagination ────────────────────────────────────────────────────────
  const loadOlder = useCallback(async () => {
    if (olderInFlight.current || !hasMore || !convRef.current) return;
    const oldest = msgsRef.current.find((m) => !m._tempId);
    if (!oldest) return;
    olderInFlight.current = true;
    setLoadingOlder(true);
    try {
      const data = await fetchPage({ before: oldest._id, limit: PAGE });
      const list = await decryptList(data.messages || [], convRef.current);
      setMessages((prev) => mergeMessages(prev, list));
      setHasMore(!!data.hasMore);
    } catch (err) {
      toast(errorMessage(err, 'Could not load older messages'), 'error');
    } finally {
      olderInFlight.current = false;
      setLoadingOlder(false);
    }
  }, [hasMore, fetchPage, decryptList]);

  const loadNewer = useCallback(async ({ force = false } = {}) => {
    if (newerInFlight.current || (!hasMoreNewer && !force) || !convRef.current) return;
    const real = msgsRef.current.filter((m) => !m._tempId);
    const newest = real[real.length - 1];
    if (!newest) return;
    newerInFlight.current = true;
    try {
      let after = newest._id;
      for (let page = 0; page < 5; page++) {
        const data = await fetchPage({ after, limit: PAGE });
        const got = data.messages || [];
        const list = await decryptList(got, convRef.current);
        setMessages((prev) => mergeMessages(prev, list));
        const more = !!(data.hasMoreNewer ?? data.hasMore);
        setHasMoreNewer(type === 'channel' ? !!data.hasMoreNewer : false);
        if (!more || !got.length || !force) break;
        after = sortAsc(got)[got.length - 1]._id;
      }
    } catch (_) {
      // transient; the next reconnect will retry
    } finally {
      newerInFlight.current = false;
    }
  }, [hasMoreNewer, fetchPage, decryptList, type]);

  // Catch up after a socket reconnect.
  useEffect(() => on('socket:reconnect', () => loadNewer({ force: true })), [loadNewer]);

  /** Channel only: replace the window with messages around an anchor. Returns the new list. */
  const jumpTo = useCallback(async (anchorId) => {
    const data = await fetchPage({ around: anchorId, limit: PAGE });
    const list = sortAsc(await decryptList(data.messages || [], convRef.current));
    setMessages(list);
    setHasMore(!!data.hasMore);
    setHasMoreNewer(!!data.hasMoreNewer);
    return list;
  }, [fetchPage, decryptList]);

  /** Drop the current window and load the latest page (e.g. "jump to latest"). */
  const reloadLatest = useCallback(async () => {
    const data = await fetchPage({ limit: PAGE });
    const list = sortAsc(await decryptList(data.messages || [], convRef.current));
    setMessages((prev) => [...list, ...prev.filter((m) => m._tempId)]);
    setHasMore(!!data.hasMore);
    setHasMoreNewer(false);
  }, [fetchPage, decryptList]);

  // ── Sending ───────────────────────────────────────────────────────────
  const send = useCallback(async (text) => {
    const plain = text.trim();
    const conv = convRef.current;
    if (!plain || !conv) return false;
    let enc;
    try {
      enc = await encryptForSend(plain, conv, type);
    } catch (err) {
      if (type === 'dm' && err instanceof KeyError && err.code === 'NOT_INITIALIZED' && otherUserId) {
        try {
          await ensureDMKey(conv, workspaceId, [meId, String(otherUserId)]);
          enc = await encryptForSend(plain, conv, type);
        } catch (e2) {
          toast(e2.message || 'Encryption is not ready', 'error');
          return false;
        }
      } else {
        toast(err?.code === 'LOCKED' ? 'Unlock encryption to send messages' : (err.message || 'Encryption is not ready'), 'error');
        return false;
      }
    }
    const clientTempId = randomUUID();
    const body = type === 'channel'
      ? { channelId: conv, ...enc, clientTempId }
      : { dmSessionId: conv, ...enc, clientTempId };
    const optimistic = {
      _id: clientTempId,
      _tempId: clientTempId,
      _text: plain,
      _state: 'ok',
      _status: 'sending',
      sender: { _id: meId, username: me?.username },
      createdAt: new Date().toISOString(),
      reactions: [],
    };
    setMessages((prev) => [...prev, optimistic]);
    const call = type === 'channel' ? sendChannelMessageApi : sendDirectMessageApi;
    try {
      const res = await dispatch(
        { type: type === 'channel' ? 'SEND_CHANNEL_MESSAGE' : 'SEND_DM_MESSAGE', payload: body },
        async () => (await call(body)).data?.message,
      );
      if (res.queued) {
        markTemp(clientTempId, { _status: 'queued' });
      } else if (res.result?._id) {
        const real = { ...res.result, _text: plain, _state: 'ok' };
        setMessages((prev) => mergeMessages(prev.filter((m) => m._tempId !== clientTempId), [real]));
      } else {
        markTemp(clientTempId, { _status: 'sent' });
      }
      return true;
    } catch (err) {
      markTemp(clientTempId, { _status: 'failed' });
      toast(errorMessage(err, 'Message failed to send'), 'error');
      return false;
    }
  }, [type, otherUserId, workspaceId, meId, me?.username, dispatch, markTemp]);

  const retry = useCallback((tempMsg) => {
    setMessages((prev) => prev.filter((m) => m._tempId !== tempMsg._tempId));
    return send(tempMsg._text || '');
  }, [send]);

  const toggleReaction = useCallback((message, emoji) => {
    if (!message?._id || message._tempId) return;
    const mine = (message.reactions || []).some((r) => r.emoji === emoji && idOf(r.userId ?? r.user) === meId);
    if (mine) removeReaction(message._id);
    else addReaction(message._id, emoji);
  }, [meId]);

  const notifyTyping = useCallback(() => {
    const conv = convRef.current;
    if (!conv) return;
    sendTyping(type === 'channel' ? { channelId: conv } : { dmSessionId: conv });
  }, [type]);

  return {
    convId, messages, loading, error, keyError, hasMore, hasMoreNewer, loadingOlder,
    joinedAt, joinError, typingName,
    loadOlder, loadNewer, jumpTo, reloadLatest, send, retry, toggleReaction, notifyTyping,
  };
}
