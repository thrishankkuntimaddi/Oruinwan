import { cx } from '../../ui/cx.js';

export function WorkspaceTile({ workspace, size = 32, className }) {
  const name = workspace?.name || '?';
  return (
    <span
      aria-hidden
      className={cx('inline-grid shrink-0 place-items-center rounded-[9px] font-bold text-white', className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `linear-gradient(160deg, ${workspace?.color || '#b8956a'}, color-mix(in srgb, ${workspace?.color || '#b8956a'} 70%, #000))`,
        boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.18)',
      }}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
