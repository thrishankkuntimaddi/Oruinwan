// Shared bits of the live editors: who else is here (stacked avatars) and the offline / access
// banner. Same tokens and shapes as the rest of the phone UI.
import { CloudOff, Lock } from 'lucide-react';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { cx } from '../../ui/cx.js';

export function PresenceAvatars({ peers, max = 3 }) {
  if (!peers?.length) return null;
  const shown = peers.slice(0, max);
  const extra = peers.length - shown.length;
  const label = `Also here: ${peers.map((p) => p.name).join(', ')}`;
  return (
    <div className="mr-1 flex items-center -space-x-2" role="img" aria-label={label} title={label} data-testid="collab-presence">
      {shown.map((p) => (
        <span key={p.id} className="rounded-full ring-2 ring-bg">
          <Avatar name={p.name} src={p.avatar} size="xs" />
        </span>
      ))}
      {extra > 0 && (
        <span className="grid h-6 min-w-6 place-items-center rounded-full bg-surface-3 px-1 text-[10px] font-semibold text-text-2 ring-2 ring-bg">+{extra}</span>
      )}
    </div>
  );
}

export function CollabBanner({ text, tone = 'offline', className }) {
  if (!text) return null;
  return (
    <p
      role="status"
      className={cx('mt-3 flex items-start gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-[13px] leading-snug text-text-2', className)}
    >
      <Icon as={tone === 'locked' ? Lock : CloudOff} size={14} className="mt-0.5 shrink-0 text-text-3" />
      <span>{text}</span>
    </p>
  );
}
