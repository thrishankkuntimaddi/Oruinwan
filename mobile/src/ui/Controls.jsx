import { forwardRef, useId } from 'react';
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
        'relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-45',
        checked ? 'bg-accent' : 'bg-surface-3 border border-line',
      )}
    >
      <span
        className={cx(
          'absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full shadow transition-all duration-200',
          checked ? 'left-6 bg-on-accent' : 'left-1 bg-text-2',
        )}
      />
    </button>
  );
}

/** Segmented control. options: [{ value, label, count? }] */
export function Segmented({ options, value, onChange, className, size = 'md' }) {
  return (
    <div role="tablist" className={cx('flex rounded-xl bg-surface-2 p-1 border border-line-soft', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => {
              if (!active) tap('select');
              onChange(o.value);
            }}
            className={cx(
              'flex-1 rounded-lg font-medium transition-all inline-flex items-center justify-center gap-1.5',
              size === 'sm' ? 'h-7 text-xs' : 'h-8 text-[13px]',
              active ? 'bg-surface text-text shadow-sm' : 'text-text-2',
            )}
          >
            {o.label}
            {o.count ? (
              <span className={cx('rounded-full px-1.5 text-[10px] leading-4', active ? 'bg-accent text-on-accent' : 'bg-surface-3')}>
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
  return (
    <div className={cx('no-scrollbar flex gap-2 overflow-x-auto px-4', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cx(
              'pressable h-8 shrink-0 rounded-full border px-3.5 text-[13px] font-medium',
              active ? 'border-accent bg-accent/15 text-accent-ink' : 'border-line bg-surface text-text-2',
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
          'flex items-center gap-2.5 rounded-xl border bg-input px-3.5 transition-colors focus-within:border-accent',
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
    <div className={cx('flex h-10 items-center gap-2 rounded-xl bg-surface-2 px-3 border border-line-soft', className)}>
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
