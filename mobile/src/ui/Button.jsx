import { Loader2 } from 'lucide-react';
import { cx } from './cx.js';
import { Icon } from './Icon.jsx';

const VARIANTS = {
  primary: 'bg-gold text-on-accent active:brightness-95',
  secondary: 'bg-surface-2 text-text border border-line active:bg-surface-3',
  ghost: 'text-text active:bg-surface-2',
  danger: 'bg-danger/12 text-danger border border-danger/25 active:bg-danger/20',
  'danger-solid': 'bg-danger text-white active:opacity-90',
};

const SIZES = {
  sm: 'h-9 px-3.5 text-sm gap-1.5 rounded-[10px]',
  md: 'h-11 px-4 text-[15px] gap-2 rounded-[10px]',
  lg: 'h-12 px-5 text-base gap-2 rounded-xl',
};

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  block = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cx(
        'pressable inline-flex items-center justify-center font-medium select-none whitespace-nowrap',
        'disabled:opacity-45 disabled:active:scale-100',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="animate-spin" size={18} aria-hidden /> : icon && <Icon as={icon} size="sm" />}
      {children}
      {iconRight && !loading && <Icon as={iconRight} size="sm" />}
    </button>
  );
}

export function IconButton({ icon, label, onClick, className, badge, tone = 'default', size = 'md', active = false, ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cx(
        'pressable relative inline-flex shrink-0 items-center justify-center rounded-full',
        size === 'sm' ? 'h-9 w-9' : 'h-10 w-10',
        tone === 'accent' ? 'bg-gold text-on-accent' : active ? 'text-accent-ink active:bg-surface-2 [&_svg]:fill-current' : 'text-text active:bg-surface-2',
        className,
      )}
      {...rest}
    >
      <Icon as={icon} size={size === 'sm' ? 'sm' : 'md'} />
      {badge ? (
        <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-accent text-on-accent text-[10px] font-semibold leading-4 text-center">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </button>
  );
}
