import { standingLabel } from '../lib/standing.js';
import { cx } from './cx.js';

/** "Former member" / "Deactivated" / "Suspended" beside a name; nothing for active people. */
export function StandingTag({ person, className }) {
  const label = standingLabel(person);
  if (!label) return null;
  return (
    <span
      className={cx('shrink-0 rounded-full border border-line px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-text-3', className)}
      data-testid="standing-tag"
    >
      {label}
    </span>
  );
}
