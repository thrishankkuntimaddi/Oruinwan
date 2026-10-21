// The short explanation under a create action that the free plan has switched off.
import { Gauge } from 'lucide-react';
import { Icon } from '../../ui/Icon.jsx';
import { cx } from '../../ui/cx.js';
import { openPricing } from './plan.js';
import { COMING_SOON } from './planText.js';

export function PlanLimitNote({ children, className, plans = true }) {
  return (
    <div role="note" data-testid="plan-limit-note" className={cx('flex gap-2.5 rounded-xl border border-warning/30 bg-warning/10 px-3.5 py-3 text-[13px] leading-snug', className)}>
      <Icon as={Gauge} size="sm" className="mt-0.5 shrink-0 text-warning" />
      <span className="min-w-0 flex-1">
        <span className="block text-text">{children}</span>
        <span className="mt-0.5 block text-text-2">
          {COMING_SOON}
          {plans && (
            <>
              {' '}
              <button type="button" onClick={() => openPricing()} className="font-medium text-accent-ink underline-offset-2 active:underline">
                See plans
              </button>
            </>
          )}
        </span>
      </span>
    </div>
  );
}
