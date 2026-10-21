// Settings → Plan & usage: which plan this is, what the free plan allows and how much of it is
// used (from GET /api/plan). Company accounts and workspaces have no free-plan limits.
import { Building2, Gauge, Phone, Sparkles } from 'lucide-react';
import { useSession, useWorkspace } from '../../data/session.js';
import { invalidate } from '../../data/query.js';
import { Body, Header, Screen } from '../../ui/Screen.jsx';
import { Button } from '../../ui/Button.jsx';
import { Row, RowGroup, Section } from '../../ui/List.jsx';
import { EmptyState, SkeletonRows } from '../../ui/Feedback.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { cx } from '../../ui/cx.js';
import { TEMPLATES } from '../notes/templates.js';
import { openPricing, usePlan } from './plan.js';
import { COMING_SOON, EXEMPT_TEXT, planName, resetText, templateKey, templateUsage } from './planText.js';

function UsageBar({ used, max, atLimit }) {
  const pct = max ? Math.min(100, Math.round((used / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max ?? undefined}
      aria-valuenow={used}
      className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3"
    >
      <div className={cx('h-full rounded-full transition-[width]', atLimit ? 'bg-warning' : 'bg-accent')} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** One usage line: label, "4 of 10", a bar, and "Limit reached" at the cap. */
export function UsageRow({ item }) {
  const unlimited = item.max === null || item.max === undefined;
  return (
    <div className="px-4 py-3" data-testid={`plan-item-${item.key}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 text-[15px]">{item.label}</span>
        <span className={cx('shrink-0 text-sm tabular-nums', item.atLimit ? 'font-medium text-warning' : 'text-text-2')}>
          {unlimited ? `${item.used} · no limit` : `${item.used} of ${item.max}`}
        </span>
      </div>
      {!unlimited && <UsageBar used={item.used} max={item.max} atLimit={item.atLimit} />}
      {item.atLimit && <p className="mt-1.5 text-xs text-warning">Limit reached</p>}
    </div>
  );
}

export function PlanScreen() {
  const ws = useSession((s) => s.workspaceId);
  const workspace = useWorkspace();
  const { data: plan, loading, error } = usePlan(ws);

  // AI requests have their own section (with the reset time).
  const items = (plan?.items || []).filter((i) => !String(i.key).startsWith('ai.'));
  const userItems = items.filter((i) => i.scope !== 'workspace');
  const wsItems = items.filter((i) => i.scope === 'workspace');
  const templates = TEMPLATES.filter((t) => t.id !== 'blank');

  return (
    <Screen>
      <Header title="Plan & usage" />
      <Body onRefresh={() => invalidate('plan:')}>
        {loading ? (
          <SkeletonRows count={5} avatar={false} />
        ) : !plan ? (
          <EmptyState
            icon={Gauge}
            title={error ? "Couldn't load your plan" : 'No plan limits'}
            body={error ? error.message || 'Try again in a moment.' : "This server doesn't limit what you can create."}
          />
        ) : (
          <>
            <div
              className="mx-4 mt-1 rounded-card border border-line-soft bg-surface p-4"
              style={{ backgroundImage: 'var(--glass)' }}
              data-testid="plan-card"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-accent/15 text-accent-ink">
                  <Icon as={plan.exempt ? Building2 : Gauge} size="sm" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-2">Your plan</p>
                  <p className="truncate text-[19px] font-semibold">{planName(plan)}</p>
                </div>
              </div>
              {plan.exempt ? (
                <p className="mt-3 text-sm text-text-2">{EXEMPT_TEXT}</p>
              ) : (
                <>
                  <p className="mt-3 text-sm text-text-2">{COMING_SOON}</p>
                  {plan.plans.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {plan.plans.map((p) => (
                        <span
                          key={p.id}
                          className={cx(
                            'rounded-full border px-2.5 py-0.5 text-xs',
                            p.id === plan.plan ? 'border-accent/40 bg-accent/12 font-medium text-accent-ink' : 'border-line text-text-2',
                          )}
                        >
                          {p.name}
                          {p.comingSoon ? ' · coming soon' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                  <Button className="mt-3.5" variant="secondary" size="sm" onClick={() => openPricing(plan.upgradeUrl)}>
                    See plans
                  </Button>
                </>
              )}
            </div>

            {!plan.exempt && (
              <>
                {userItems.length > 0 && (
                  <Section title="You">
                    <RowGroup>
                      {userItems.map((i) => (
                        <UsageRow key={i.key} item={i} />
                      ))}
                    </RowGroup>
                  </Section>
                )}
                {wsItems.length > 0 && (
                  <Section title={workspace?.name || 'This workspace'}>
                    <RowGroup>
                      {wsItems.map((i) => (
                        <UsageRow key={i.key} item={i} />
                      ))}
                    </RowGroup>
                  </Section>
                )}

                {plan.notes.perTemplate !== null && (
                  <Section title="Notes per template">
                    <RowGroup footer={`Up to ${plan.notes.perTemplate} notes from each template in a workspace. Blank notes have no limit.`}>
                      {templates.map((t) => {
                        const u = templateUsage(plan, templateKey(t));
                        return (
                          <Row
                            key={t.id}
                            leading={
                              <span className="grid h-8 w-8 shrink-0 place-items-center text-lg" aria-hidden>
                                {t.emoji}
                              </span>
                            }
                            title={t.label}
                            subtitle={u?.atLimit ? 'Limit reached' : undefined}
                            trailing={
                              u ? (
                                <span className={cx('shrink-0 text-sm tabular-nums', u.atLimit ? 'font-medium text-warning' : 'text-text-2')}>
                                  {u.used} of {u.max}
                                </span>
                              ) : null
                            }
                          />
                        );
                      })}
                    </RowGroup>
                  </Section>
                )}

                {(plan.huddles.participants !== null || plan.huddles.minutes !== null) && (
                  <Section title="Calls">
                    <RowGroup>
                      {plan.huddles.participants !== null && <Row icon={Phone} title="People in one call" value={`Up to ${plan.huddles.participants}`} />}
                      {plan.huddles.minutes !== null && <Row icon={Phone} title="Length of a call" value={`${plan.huddles.minutes} minutes`} />}
                    </RowGroup>
                  </Section>
                )}

                {plan.ai && plan.ai.userMax !== null && (
                  <Section title="AI today">
                    <RowGroup footer={resetText(plan.ai.resetsAt) || undefined}>
                      <UsageRow
                        item={{ key: 'ai.user', label: 'Your AI requests', used: plan.ai.userUsed, max: plan.ai.userMax, atLimit: plan.ai.userUsed >= plan.ai.userMax }}
                      />
                      {plan.ai.workspaceMax !== null && (
                        <UsageRow
                          item={{
                            key: 'ai.workspace',
                            label: 'Workspace AI requests',
                            used: plan.ai.workspaceUsed,
                            max: plan.ai.workspaceMax,
                            atLimit: plan.ai.workspaceUsed >= plan.ai.workspaceMax,
                          }}
                        />
                      )}
                    </RowGroup>
                    <p className="mx-5 mt-1 flex items-center gap-1.5 text-xs text-text-3">
                      <Icon as={Sparkles} size={12} />
                      Requests with your own connected AI key don't count.
                    </p>
                  </Section>
                )}
              </>
            )}
          </>
        )}
      </Body>
    </Screen>
  );
}
