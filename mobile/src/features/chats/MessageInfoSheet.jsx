// Message info for one of my messages: when it was sent, who has read it (and when) and who it
// was delivered to but hasn't read it yet. The same server data as the web's Message info
// (GET /v2/messages/:id/info); the text shown is the copy decrypted on this device.
import { CheckCheck, Clock, History, Lock, Pin, RefreshCw } from 'lucide-react';
import { api } from '../../data/session.js';
import { useQuery } from '../../data/query.js';
import { useDirectory } from '../../data/hooks.js';
import { clock, dayLabel } from '../../lib/time.js';
import { Sheet } from '../../ui/Overlay.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Button } from '../../ui/Button.jsx';
import { Spinner } from '../../ui/Feedback.jsx';
import { plainPreview } from '../../ui/Markdown.jsx';

const when = (at) => (at ? `${dayLabel(at)} · ${clock(at)}` : '');

function Section({ icon, title, children }) {
  return (
    <section className="border-t border-line-soft px-5 py-3">
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] text-text-3 uppercase">
        <Icon as={icon} size={13} className="text-accent-ink" /> {title}
      </h3>
      {children}
    </section>
  );
}

function People({ list, directory, muted }) {
  return (
    <ul className="space-y-2.5">
      {list.map((p) => {
        const u = directory[p.id] || {};
        const name = u.name || p.username || 'Someone';
        return (
          <li key={p.id} className="flex items-center gap-3">
            <Avatar name={name} src={u.avatarUrl || p.avatarUrl} size="sm" className={muted ? 'opacity-60' : ''} />
            <span className={`min-w-0 flex-1 truncate text-[15px] ${muted ? 'text-text-2' : 'text-text'}`}>{name}</span>
            {p.readAt && <span className="shrink-0 text-[12px] text-text-2">{when(p.readAt)}</span>}
          </li>
        );
      })}
    </ul>
  );
}

export function MessageInfoSheet({ message, conv, onClose }) {
  const directory = useDirectory();
  const open = Boolean(message);
  const key = open && api().messageInfo && `messageInfo:${message.id}`;
  const { data, error, loading, refetch } = useQuery(key, () => api().messageInfo(conv, message.id, message.authorId), { staleMs: 0 });
  const isDm = conv?.kind === 'dm';
  const text = message?.state === 'ok' ? plainPreview(message.text, 240) : '';

  return (
    <Sheet open={open} onClose={onClose} title="Message info">
      {message && (
        <div className="pb-3">
          <div className="mx-5 mb-3 rounded-xl border border-line-soft bg-surface-2 px-3.5 py-3">
            <p className="text-[14px] leading-snug break-words text-text">{text || message.attachments?.[0]?.name || 'Message'}</p>
            <p className="mt-2 flex items-center gap-1 text-[11px] text-text-3">
              <Icon as={Lock} size={11} className="text-accent-ink" /> End-to-end encrypted · sent {when(data?.sentAt || message.at)}
            </p>
          </div>
          {error && !data ? (
            <div className="px-5 py-3">
              <p role="alert" className="text-[14px] text-danger">{error.message || 'Could not load message info.'}</p>
              <Button size="sm" variant="secondary" icon={RefreshCw} className="mt-3" onClick={refetch}>
                Try again
              </Button>
            </div>
          ) : !data || loading ? (
            <div className="flex items-center gap-2 px-5 py-4 text-[14px] text-text-2">
              <Spinner /> Loading…
            </div>
          ) : (
            <>
              {data.editedAt && (
                <Section icon={History} title="Edited">
                  <p className="text-[14px] text-text-2">{when(data.editedAt)}{data.editCount > 1 ? ` · ${data.editCount} edits` : ''}</p>
                </Section>
              )}
              {data.pinnedBy && (
                <Section icon={Pin} title="Pinned">
                  <p className="text-[14px] text-text-2">By {data.pinnedBy}{data.pinnedAt ? ` · ${when(data.pinnedAt)}` : ''}</p>
                </Section>
              )}
              <Section icon={CheckCheck} title={isDm && data.recipients === 1 ? 'Read' : `Read by · ${data.read.length}`}>
                {data.read.length ? <People list={data.read} directory={directory} /> : <p className="text-[14px] text-text-2">No one has read this yet.</p>}
              </Section>
              <Section icon={Clock} title={`Delivered, not read yet · ${data.unread.length}`}>
                {data.unread.length ? (
                  <People list={data.unread} directory={directory} muted />
                ) : (
                  <p className="text-[14px] text-text-2">{data.recipients ? 'Everyone has read this.' : 'No other recipients.'}</p>
                )}
              </Section>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
