import { initials } from '../lib/id.js';
import { cx } from './cx.js';

// Muted warm tones that sit well next to the gold accent in both themes.
const TONES = ['#8a6f4e', '#5f7a6a', '#6a6f8f', '#8a5f5f', '#5f7f86', '#7c6a8f', '#86774f', '#5d6b55'];

// FNV-1a: spreads similar names across the palette (a simple *31 hash does not mod 8).
export function toneFor(seed = '') {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h = (h ^ (h >>> 15)) >>> 0;
  return TONES[h % TONES.length];
}

const SIZE = { xs: 'h-6 w-6 text-[10px]', sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg', xl: 'h-20 w-20 text-2xl' };
const DOT = { xs: 'h-2 w-2', sm: 'h-2.5 w-2.5', md: 'h-3 w-3', lg: 'h-3.5 w-3.5', xl: 'h-4 w-4' };
const PRESENCE = { active: 'bg-success', online: 'bg-success', away: 'bg-warning', dnd: 'bg-danger', offline: 'bg-text-3' };

export function Avatar({ name, src, size = 'md', presence, square = false, className }) {
  return (
    <span className={cx('relative inline-flex shrink-0', className)}>
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          className={cx(SIZE[size], square ? 'rounded-xl' : 'rounded-full', 'object-cover bg-surface-3')}
        />
      ) : (
        <span
          aria-hidden
          className={cx(SIZE[size], square ? 'rounded-xl' : 'rounded-full', 'grid place-items-center font-semibold text-white/95')}
          style={{ background: toneFor(name) }}
        >
          {initials(name)}
        </span>
      )}
      {presence && (
        <span
          aria-label={presence}
          className={cx('absolute -right-0.5 -bottom-0.5 rounded-full ring-2 ring-bg', DOT[size], PRESENCE[presence] || PRESENCE.offline)}
        />
      )}
    </span>
  );
}
