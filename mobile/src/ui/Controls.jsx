import { forwardRef, useEffect, useId, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { cx } from './cx.js';
import { Icon } from './Icon.jsx';
import { tap } from '../native/index.js';

export function Toggle({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        tap('select');
        onChange(!checked);
      }}
      className={cx(
        'relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-45',
        checked ? 'bg-switch' : 'bg-[rgb(120_120_128/0.22)]',
      )}
    >
      <span
        className={cx(
          'absolute top-0.5 h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/0.15),0_3px_1px_rgb(0_0_0/0.06)] transition-[left] duration-300 ease-[var(--lg-ease)]',
          checked ? 'left-[22px]' : 'left-0.5',
        )}
      />
    </button>
  );
}

/** Segmented control. options: [{ value, label, count? }] */
/** A segmented control. `scroll`: many options in a row that scrolls sideways (phone widths). */
export function Segmented({ options, value, onChange, className, size = 'md', scroll = false, label, disabled = false }) {
  return (
    <div role="tablist" aria-label={label} aria-disabled={disabled || undefined} className={cx('flex gap-0.5 rounded-full glass-well p-[3px]', scroll && 'no-scrollbar overflow-x-auto', disabled && 'opacity-60', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => {
              if (!active) tap('select');
              onChange(o.value);
            }}
            ref={scroll && active ? (el) => el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }) : undefined}
            className={cx(
              'flex-1 rounded-full font-semibold transition-all inline-flex items-center justify-center gap-1.5',
              scroll && 'shrink-0 whitespace-nowrap px-3',
              size === 'sm' ? 'h-7 text-xs' : 'h-8 text-[13px]',
              active ? 'glass-selected' : 'text-text-2',
            )}
          >
            {o.label}
            {o.count ? (
              <span className={cx('rounded-full px-1.5 text-[10px] leading-4', active ? 'bg-[rgb(10_10_12/0.08)]' : 'bg-surface-3')}>
                {o.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Horizontally scrolling filter chips. */
export function Chips({ options, value, onChange, className }) {
  // Keep the chosen chip in view when it changes (e.g. a remembered view further along the row).
  const row = useRef(null);
  useEffect(() => {
    const el = row.current?.querySelector('[data-active="true"]');
    const box = row.current;
    if (!el || !box) return;
    if (el.offsetLeft < box.scrollLeft || el.offsetLeft + el.offsetWidth > box.scrollLeft + box.clientWidth) {
      box.scrollLeft = Math.max(0, el.offsetLeft - 16);
    }
  }, [value]);
  return (
    <div ref={row} className={cx('no-scrollbar relative flex gap-2 overflow-x-auto px-4', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            data-active={active ? 'true' : undefined}
            className={cx(
              'pressable h-8 shrink-0 rounded-full px-3.5 text-[13px] font-semibold',
              active ? 'glass-selected' : 'glass-ctl text-text-2',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export const Field = forwardRef(function Field(
  { label, hint, error, icon, className, inputClassName, multiline, trailing, ...rest },
  ref,
) {
  const id = useId();
  const Comp = multiline ? 'textarea' : 'input';
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-text-2">
          {label}
        </label>
      )}
      <div
        className={cx(
          'flex items-center gap-2.5 rounded-[14px] border bg-input px-3.5 shadow-[inset_0_1px_2px_rgb(0_0_0/0.06)] transition-[border-color,box-shadow] focus-within:border-line-strong focus-within:shadow-[0_0_0_3px_rgb(120_120_128/0.16)]',
          error ? 'border-danger/60' : 'border-line',
        )}
      >
        {icon && <Icon as={icon} size="sm" className="shrink-0 text-text-3" />}
        <Comp
          id={id}
          ref={ref}
          className={cx(
            'w-full min-w-0 bg-transparent text-[15px] text-text placeholder:text-text-3 outline-none',
            multiline ? 'min-h-24 resize-none py-3' : 'h-12',
            inputClassName,
          )}
          aria-invalid={Boolean(error)}
          aria-describedby={error || hint ? `${id}-d` : undefined}
          {...rest}
        />
        {trailing}
      </div>
      {(error || hint) && (
        <p id={`${id}-d`} className={cx('mt-1.5 text-xs', error ? 'text-danger' : 'text-text-2')}>
          {error || hint}
        </p>
      )}
    </div>
  );
});

export function SearchField({ value, onChange, placeholder = 'Search', className, autoFocus }) {
  return (
    <div className={cx('flex h-10 items-center gap-2 rounded-full glass-well px-3.5', className)}>
      <Icon as={Search} size="sm" className="shrink-0 text-text-3" />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        enterKeyHint="search"
        className="h-full w-full min-w-0 bg-transparent text-[15px] outline-none placeholder:text-text-3 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" aria-label="Clear search" onClick={() => onChange('')} className="text-text-3">
          <Icon as={X} size="sm" />
        </button>
      )}
    </div>
  );
}
