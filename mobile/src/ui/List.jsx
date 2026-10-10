// Grouped list rows: the backbone of settings, pickers and detail screens.
import { ChevronRight } from 'lucide-react';
import { cx } from './cx.js';
import { Icon } from './Icon.jsx';

export function Section({ title, action, children, className, inset = true }) {
  return (
    <section className={cx('mt-6 first:mt-2', className)}>
      {(title || action) && (
        <div className={cx('mb-2 flex items-end justify-between', inset && 'px-4')}>
          {title && <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-2">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function RowGroup({ children, className, footer }) {
  return (
    <>
      <div className={cx('mx-4 overflow-hidden rounded-card border border-line-soft bg-surface divide-y divide-line-soft', className)}>
        {children}
      </div>
      {footer && <p className="mx-5 mt-2 text-xs leading-relaxed text-text-2">{footer}</p>}
    </>
  );
}

const TILE = {
  accent: 'bg-accent/15 text-accent-ink',
  neutral: 'bg-surface-3 text-text-2',
  danger: 'bg-danger/12 text-danger',
  success: 'bg-success/12 text-success',
  info: 'bg-info/15 text-info',
};

export function Row({
  icon,
  tile = 'neutral',
  leading,
  title,
  subtitle,
  value,
  trailing,
  chevron,
  onClick,
  danger,
  disabled,
  className,
  multiline = false,
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'flex w-full items-center gap-3 px-4 text-left min-h-[52px] py-2.5',
        onClick && 'active:bg-surface-2 transition-colors',
        disabled && 'opacity-45',
        className,
      )}
    >
      {leading}
      {icon && !leading && (
        <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-[10px]', danger ? TILE.danger : TILE[tile])}>
          <Icon as={icon} size="sm" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={cx('block text-[15px]', danger ? 'text-danger' : 'text-text', !multiline && 'truncate')}>{title}</span>
        {subtitle && (
          <span className={cx('mt-0.5 block text-[13px] text-text-2', !multiline && 'truncate')}>{subtitle}</span>
        )}
      </span>
      {value != null && <span className="shrink-0 text-sm text-text-2 max-w-[45%] truncate">{value}</span>}
      {trailing}
      {(chevron ?? (onClick && !trailing)) && <Icon as={ChevronRight} size="sm" className="shrink-0 text-text-3" />}
    </Comp>
  );
}
