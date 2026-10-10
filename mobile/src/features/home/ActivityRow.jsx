import { AtSign, Bell, CalendarClock, FileText, GitBranch, MessageCircle, Smile, SquareCheckBig } from 'lucide-react';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { shortAgo } from '../../lib/time.js';
import { openNotification } from './openTarget.js';

export const NOTIF_ICON = {
  mention: AtSign, dm: MessageCircle, task: SquareCheckBig, thread: GitBranch, meeting: CalendarClock, reaction: Smile, note: FileText,
};

export function ActivityRow({ item, directory }) {
  const actor = directory[item.actorId];
  const Glyph = NOTIF_ICON[item.type] || Bell;
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
        {item.preview && <span className="mt-0.5 block truncate text-[13px] text-text-2">{item.preview}</span>}
      </span>
      {!item.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
    </button>
  );
}
