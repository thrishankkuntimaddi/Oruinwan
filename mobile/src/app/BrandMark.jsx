import mark from '../assets/brand/mark.webp';
import { cx } from '../ui/cx.js';

export function BrandMark({ size = 64, className, glow = false }) {
  return (
    <span className={cx('relative inline-grid place-items-center', className)} style={{ width: size, height: size }}>
      {glow && <span className="absolute inset-[-30%] rounded-full bg-accent/20 blur-2xl" aria-hidden />}
      <img src={mark} alt="Oruinwan" width={size} height={size} className="relative rounded-[22%]" />
    </span>
  );
}
