// Private chats on the phone: end-to-end encrypted 1:1 messages (platform/crypto/privateChatClient.js,
// the same code the web and desktop apps run). Shown when the server has `privateChats` on.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Lock, Plus, Send, ShieldCheck, Trash2 } from 'lucide-react';
import { nav } from '../../app/nav.js';
import { useMembers, useDirectory } from '../../data/hooks.js';
import { useSession } from '../../data/session.js';
import { request } from '../../data/live/http.js';
import { on, toast } from '../../lib/bus.js';
import { Body, Header, Screen } from '../../ui/Screen.jsx';
import { Button, IconButton } from '../../ui/Button.jsx';
import { Row, RowGroup, Section } from '../../ui/List.jsx';
import { SearchField } from '../../ui/Controls.jsx';
import { EmptyState, SkeletonRows } from '../../ui/Feedback.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { cx } from '../../ui/cx.js';
import { createPrivateChats, indexedDbStore, memoryStore } from '../../../../platform/crypto/privateChatClient.js';

const http = {
  get: (path, query) => request('GET', `/private${path}`, { query }),
  post: (path, body) => request('POST', `/private${path}`, { body }),
  put: (path, body) => request('PUT', `/private${path}`, { body }),
  del: (path) => request('DELETE', `/private${path}`),
};

const clients = new Map();
/** The shared client for the signed-in user (device keys load once per app start). */
export function usePrivateClient() {
  const userId = useSession((s) => s.user?.id);
  const client = useMemo(() => {
    if (!userId) return null;
    if (!clients.has(userId)) {
      const store = typeof indexedDB !== 'undefined' ? indexedDbStore('phone') : memoryStore();
      clients.set(userId, createPrivateChats({ http, userId, store, label: 'Phone' }));
    }
    return clients.get(userId);
  }, [userId]);
  const [state, setState] = useState({ ready: false, error: null });
  useEffect(() => {
    if (!client) return undefined;
    let cancelled = false;
    client.ensureDevice().then(
      () => !cancelled && setState({ ready: true, error: null }),
      (err) => !cancelled && setState({ ready: false, error: err?.message || 'Could not set up private chats on this phone' }),
    );
    return () => {
      cancelled = true;
    };
  }, [client]);
  return { client, userId: userId ? String(userId) : '', ...state };
}

const nameOf = (u) => u?.name || u?.username || 'Someone';
const useSocketEvent = (names, fn) =>
  useEffect(() => on('socket', ({ event, payload }) => names.includes(event) && fn(event, payload)), [names, fn]);
const LIST_EVENTS = ['private:chat', 'private:message'];
const CHAT_EVENTS = ['private:message', 'private:deleted'];

export function PrivateChatsScreen() {
  const ws = useSession((s) => s.workspaceId);
  const { client, userId, error } = usePrivateClient();
  const directory = useDirectory();
  const { data: members } = useMembers();
  const [chats, setChats] = useState(null);
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState('');

  const load = useCallback(() => {
    if (client && ws) client.list(ws).then(setChats, (err) => toast(err.message, 'danger'));
  }, [client, ws]);
  useEffect(load, [load]);
  useSocketEvent(LIST_EVENTS, load);

  const start = async (person) => {
    try {
      const chat = await client.open(ws, person.id);
      setPicking(false);
      nav.push('privateChat', { id: chat.id });
    } catch (err) {
      toast(err.message, 'danger');
    }
  };
  const query = q.trim().toLowerCase();
  const people = (members || []).filter((m) => String(m.id) !== userId && (!query || nameOf(m).toLowerCase().includes(query)));

  return (
    <Screen>
      <Header
        title="Private chats"
        subtitle="End-to-end encrypted"
        ai={false}
        actions={<IconButton icon={Plus} label="New private chat" onClick={() => setPicking((v) => !v)} />}
      />
      <Body onRefresh={load}>
        {error && <EmptyState icon={AlertTriangle} title="Private chats are not available" body={error} />}
        {picking ? (
          <>
            <div className="px-4 pt-2">
              <SearchField value={q} onChange={setQ} placeholder="Who do you want to talk to?" autoFocus />
            </div>
            <RowGroup className="mt-3">
              {people.slice(0, 40).map((m) => (
                <Row key={m.id} title={nameOf(m)} subtitle={m.username ? `@${m.username}` : undefined} onClick={() => start(m)} />
              ))}
            </RowGroup>
          </>
        ) : chats === null ? (
          <SkeletonRows count={3} />
        ) : chats.length ? (
          <RowGroup className="mt-3">
            {chats.map((c) => (
              <Row
                key={c.id}
                icon={Lock}
                title={nameOf(directory[c.participants.find((p) => p !== userId)])}
                chevron
                onClick={() => nav.push('privateChat', { id: c.id })}
              />
            ))}
          </RowGroup>
        ) : (
          <EmptyState
            icon={Lock}
            title="No private chats yet"
            body="Only the two of you can read a private chat: not Oruinwan, not workspace admins. No AI, no search, and messages stay on the devices they were sent to."
            action={{ label: 'New private chat', icon: Plus, onClick: () => setPicking(true) }}
          />
        )}
      </Body>
    </Screen>
  );
}

function SafetyCard({ client, chat, otherName }) {
  const [s, setS] = useState(null);
  const [open, setOpen] = useState(false);
  const refresh = useCallback(() => client.safety(chat).then(setS, () => {}), [client, chat]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  if (!s) return null;
  const accept = async (verified) => {
    await client.acceptSafety(chat, s.number, { verified });
    setOpen(false);
    refresh();
  };
  return (
    <Section>
      <div className={cx('rounded-xl border px-3 py-2.5 text-[13px]', s.changed ? 'border-warning bg-warning/10' : 'border-line bg-surface')}>
        <button type="button" className="flex w-full items-center gap-2 text-left" onClick={() => setOpen((v) => !v)}>
          <Icon as={s.changed ? AlertTriangle : ShieldCheck} size={16} className={s.changed ? 'text-warning' : 'text-accent-ink'} />
          <span className="flex-1">
            {s.changed
              ? `${otherName}’s or your devices changed. Compare the safety number again.`
              : s.verified
                ? 'Verified: you compared safety numbers.'
                : 'End-to-end encrypted. Tap to compare safety numbers.'}
          </span>
        </button>
        {open && (
          <div className="mt-2">
            <code className="block font-mono text-[15px] leading-7 tracking-wider" data-testid="safety-number">
              {s.number}
            </code>
            <p className="my-1.5 text-text-2">{otherName} sees the same 60 digits if nobody is in between. Compare them in person or on a call.</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => accept(true)}>
                They match
              </Button>
              {s.changed && (
                <Button size="sm" variant="secondary" onClick={() => accept(false)}>
                  Dismiss for now
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

export function PrivateChatScreen({ id }) {
  const { client, ready, userId } = usePrivateClient();
  const directory = useDirectory();
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const end = useRef(null);

  useEffect(() => {
    if (!client || !ready || !id) return undefined;
    let cancelled = false;
    client
      .get(id)
      .then(async (c) => {
        if (cancelled) return;
        setChat(c);
        const list = await client.messages(c);
        if (!cancelled) setMessages(list);
      })
      .catch((err) => toast(err.message, 'danger'));
    return () => {
      cancelled = true;
    };
  }, [client, ready, id]);

  const onEvent = useCallback(
    async (event, payload) => {
      if (!chat) return;
      if (event === 'private:deleted' && payload?.chatId === chat.id) setMessages((p) => (p || []).filter((m) => m.id !== payload.messageId));
      if (event === 'private:message' && payload?.message?.chatId === chat.id) {
        const m = await client.read(chat, payload.message);
        setMessages((p) => ((p || []).some((x) => x.id === m.id) ? p : [...(p || []), m]));
      }
    },
    [chat, client],
  );
  useSocketEvent(CHAT_EVENTS, onEvent);
  useEffect(() => end.current?.scrollIntoView?.({ block: 'end' }), [messages?.length]);

  const otherName = nameOf(directory[chat?.participants.find((p) => p !== userId)]);
  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const m = await client.read(chat, await client.send(chat, text));
      setMessages((p) => ((p || []).some((x) => x.id === m.id) ? p : [...(p || []), m]));
      setText('');
    } catch (err) {
      toast(err.message, 'danger');
    } finally {
      setSending(false);
    }
  };
  const remove = async (m) => {
    try {
      await client.remove(chat, m.id);
      setMessages((p) => p.filter((x) => x.id !== m.id));
    } catch (err) {
      toast(err.message, 'danger');
    }
  };

  return (
    <Screen>
      <Header title={chat ? otherName : 'Private chat'} subtitle="Private chat · end-to-end encrypted" ai={false} />
      <Body>
        {chat && <SafetyCard client={client} chat={chat} otherName={otherName} />}
        {messages === null ? (
          <SkeletonRows count={4} avatar={false} />
        ) : (
          <ol className="flex flex-col gap-1.5 px-4 pb-4" aria-live="polite">
            {!messages.length && <li className="mt-6 text-center text-[14px] text-text-2">Say hello. Only you and {otherName} can read this.</li>}
            {messages.map((m) => (
              <li key={m.id} className={cx('max-w-[80%]', m.mine ? 'self-end' : 'self-start')}>
                <div
                  className={cx(
                    'whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-[15px]',
                    m.mine ? 'bg-accent-soft' : 'bg-surface-2',
                    m.error && 'italic text-text-2',
                  )}
                >
                  {m.error || m.text}
                </div>
                {m.mine && (
                  <div className="flex justify-end">
                    <IconButton icon={Trash2} size="sm" label="Delete for everyone" onClick={() => remove(m)} />
                  </div>
                )}
              </li>
            ))}
            <li ref={end} aria-hidden />
          </ol>
        )}
      </Body>
      <form
        className="flex items-end gap-2 border-t border-line-soft bg-bg px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          rows={1}
          value={text}
          maxLength={20000}
          aria-label="Private message"
          placeholder={`Private message to ${otherName}`}
          onChange={(e) => setText(e.target.value)}
          className="min-h-[40px] flex-1 resize-none rounded-2xl glass-tile px-3 py-2 text-[15px]"
        />
        <IconButton icon={Send} label="Send" disabled={!text.trim() || sending || !chat} onClick={send} />
      </form>
    </Screen>
  );
}
