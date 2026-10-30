// A brand's mark, white on its colour in a rounded square (integrations, agents). Falls back to
// `fallback` (an element) for brands we don't have a mark for.
import { BRANDS } from '../assets/integrations/brands.js';

export const hasBrand = (id) => Boolean(BRANDS[id]);

export function BrandLogo({ id, size = 40, fallback = null, className = '' }) {
  const b = BRANDS[id];
  if (!b) return fallback;
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-[10px] ${className}`}
      style={{ width: size, height: size, background: b.hex }}
      role="img"
      aria-label={b.title}
    >
      <svg viewBox="0 0 24 24" width={Math.round(size * 0.56)} height={Math.round(size * 0.56)} fill="#fff" aria-hidden>
        <path d={b.path} />
      </svg>
    </span>
  );
}
