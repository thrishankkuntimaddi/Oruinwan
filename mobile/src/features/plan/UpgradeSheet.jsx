// "Free plan limit reached": one sheet for the whole app, opened by any refused addition
// (HTTP 403 PLAN_LIMIT from the adapter, or a huddle refusal). Mounted once at the app root.
import { useEffect } from 'react';
import { Gauge } from 'lucide-react';
import { useSession } from '../../data/session.js';
import { Sheet } from '../../ui/Overlay.jsx';
import { Button } from '../../ui/Button.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { bindPlan, closeUpgrade, openPricing, useUpgrade } from './plan.js';
import { COMING_SOON, LIMIT_TITLE } from './planText.js';

export function UpgradeSheet() {
  const info = useUpgrade((s) => s.info);
  const open = Boolean(info);
  return (
    <Sheet
      open={open}
      onClose={closeUpgrade}
      title={LIMIT_TITLE}
      footer={
        <div className="flex gap-2.5">
          <Button variant="secondary" block onClick={closeUpgrade}>
            Close
          </Button>
          <Button
            block
            onClick={() => {
              openPricing(info?.upgradeUrl);
              closeUpgrade();
            }}
          >
            See plans
          </Button>
        </div>
      }
    >
      <div className="flex gap-3.5 px-5 pb-4" data-testid="upgrade-sheet">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-accent/15 text-accent-ink">
          <Icon as={Gauge} size="sm" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-snug">{info?.message || "You've reached a free plan limit."}</p>
          {info?.max !== null && info?.max !== undefined && info?.used !== null && info?.used !== undefined && (
            <p className="mt-1.5 text-[13px] text-text-2 tabular-nums">
              {info.used} of {info.max} used
            </p>
          )}
          <p className="mt-2 text-[13px] text-text-2">{COMING_SOON}</p>
        </div>
      </div>
    </Sheet>
  );
}

/** The sheet plus the plan's live events, while signed in to a server. */
export function PlanLayer() {
  const live = useSession((s) => s.mode === 'live' && s.status === 'signed-in');
  useEffect(() => (live ? bindPlan() : undefined), [live]);
  if (!live) return null;
  return <UpgradeSheet />;
}
