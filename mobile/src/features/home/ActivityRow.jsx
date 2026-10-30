import { AtSign, Bell, CalendarClock, FileText, GitBranch, MessageCircle, PenTool, Smile, Sparkles, SquareCheckBig } from 'lucide-react';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { shortAgo } from '../../lib/time.js';
import { openNotification } from './openTarget.js';
import { useSession } from '../../data/session.js';
import { getQueryData } from '../../data/query.js';
import { latestText } from '../../data/live/messageIndex.js';
import { clipPreview, isGenericPreview } from '../../lib/preview.js';

const MESSAGE_KINDS = new Set(['dm', 'mention', 'thread']);

/**
 * The server can't read end-to-end encrypted messages, so its preview is "New message". Show
 * what this phone has decrypted instead: the sender's newest message in that conversation, or
 * the chat list's last message. Shortened to one line.
 */
export function messagePreview(item, ws) {
  if (!isGenericPreview(item.preview)) return item.preview;
  if (!MESSAGE_KINDS.has(item.type) || !item.target) return item.preview && !isGenericPreview(item.preview) ? item.preview : '';
  const conv = item.target.conv || item.target.id;
  const fromIndex = latestText(conv, item.actorId) || latestText(conv);
  if (fromIndex) return clipPreview(fromIndex);
  const kind = item.target.convKind || item.target.kind;
  const list = getQueryData(kind === 'channel' ? `channels:${ws}` : `dms:${ws}`) || [];
  const row = list.find((c) => c.id === conv);
  return row?.lastText && !isGenericPreview(row.lastText) ? clipPreview(row.lastText) : '';
}

export const NOTIF_ICON = {
  mention: AtSign, dm: MessageCircle, task: SquareCheckBig, thread: GitBranch, meeting: CalendarClock, reaction: Smile, note: FileText,
  design: PenTool, ai: Sparkles,
};

export function ActivityRow({ item, directory }) {
  const actor = directory[item.actorId];
  const Glyph = NOTIF_ICON[item.type] || Bell;
  const ws = useSession((st) => st.workspaceId);
  const preview = messagePreview(item, ws);
  return (
    <button
      type="button"
      onClick={() => openNotification(item)}
      className="flex w-full items-start gap-3 px-4 py-3 text-left active:bg-surface-2"
    >
      <span className="relative">
        <Avatar name={actor?.name || item.actorName || '?'} src={actor?.avatarUrl} size="md" />
        <span className="absolute -right-1 -bottom-1 grid h-5 w-5 place-items-center rounded-full bg-surface-3 text-accent-ink ring-2 ring-surface">
          <Icon as={Glyph} size={11} />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-[14px]">
            {item.title ? (
              <span className="font-medium">{item.title}</span>
            ) : (
              <>
                <span className="font-semibold">{actor?.name || item.actorName || 'Someone'}</span>{' '}
                <span className="text-text-2">{item.text}</span>
              </>
            )}
          </span>
          <span className="shrink-0 text-[11px] text-text-3">{shortAgo(item.at)}</span>
        </span>
        {preview && <span className="mt-0.5 block truncate text-[13px] text-text-2">{preview}</span>}
      </span>
      {!item.read && (item.count > 1 ? (
        <span className="mt-1 shrink-0 rounded-full bg-accent px-1.5 text-[11px] font-semibold leading-5 text-on-accent" aria-label={`${item.count} unread`}>{item.count > 99 ? '99+' : item.count}</span>
      ) : (
        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />
      ))}
    </button>
  );
}
