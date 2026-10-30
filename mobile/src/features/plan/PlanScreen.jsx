// Settings → Plan & usage: which plan this is, what the free plan allows and how much of it is
// used (from GET /api/plan). Company accounts and workspaces have no free-plan limits.
import { Building2, Check, Gauge, History, LifeBuoy, Mail, Phone, Rocket, Sparkles } from 'lucide-react';
import { nav } from '../../app/nav.js';
import { openExternal } from '../../native/index.js';
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
import { COMING_SOON, EXEMPT_TEXT, PLAN_CARDS, SALES_EMAIL, planName, resetText, templateKey, templateUsage } from './planText.js';

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

const mail = (subject, body = '') => openExternal(`mailto:${SALES_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);

/** Free, Pro and Enterprise side by side (swipe), the current one marked. */
function PlanCards({ current, workspaceName }) {
  return (
    <Section title="Plans">
      <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1" data-testid="plan-cards">
        {PLAN_CARDS.map((p) => {
          const on = p.id === current;
          return (
            <div
              key={p.id}
              className={cx('flex w-[78%] max-w-[300px] shrink-0 snap-start flex-col rounded-card border p-4', on ? 'border-accent bg-accent/8' : 'border-line-soft bg-surface')}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[17px] font-semibold">{p.name}</p>
                {on && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-on-accent">Current</span>}
              </div>
              <p className="mt-1 text-[20px] font-bold tracking-tight">{p.price}</p>
              <p className="text-[12px] text-text-2">{p.note}</p>
              <ul className="mt-3 flex-1 space-y-1.5">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2 text-[13px] leading-snug">
                    <Icon as={Check} size={14} className="mt-0.5 shrink-0 text-success" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {!on && p.id === 'pro' && (
                <Button className="mt-3" size="sm" variant="secondary" icon={Rocket} onClick={() => mail('Notify me: Oruinwan Pro', `Please let me know when Pro is available for ${workspaceName || 'my workspace'}.`)}>
                  Notify me
                </Button>
              )}
              {!on && p.id === 'enterprise' && (
                <Button className="mt-3" size="sm" icon={Mail} onClick={() => mail('Oruinwan Enterprise', `We'd like to talk about Enterprise for ${workspaceName || 'our organisation'}.`)}>
                  Contact sales
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/** Help with the plan, and its history. */
function PlanFooter({ plan, workspace }) {
  const since = workspace?.createdAt ? new Date(workspace.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null;
  return (
    <>
      <Section title="Help">
        <RowGroup>
          <Row icon={LifeBuoy} tile="accent" title="Contact support" subtitle="Problems, billing questions, limits" onClick={() => nav.push('settings.support')} />
          <Row icon={Building2} title="Talk to us about Enterprise" subtitle={SALES_EMAIL} onClick={() => mail('Oruinwan Enterprise')} />
          <Row icon={Gauge} title="Compare plans on the website" onClick={() => openPricing(plan?.upgradeUrl)} />
        </RowGroup>
      </Section>
      <Section title="Plan history">
        <RowGroup footer="Paid plans aren't available yet, so there are no invoices.">
          <Row icon={History} title={planName(plan)} subtitle={since ? `Since ${since}` : 'Current plan'} value="Current" chevron={false} />
        </RowGroup>
      </Section>
    </>
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
          <>
            <EmptyState
              icon={Gauge}
              title={error ? "Couldn't load your plan" : 'No plan limits'}
              body={error ? error.message || 'Pull down to try again.' : "This server doesn't limit what you can create."}
            />
            <PlanCards current={error ? null : 'free'} workspaceName={workspace?.name} />
            <PlanFooter plan={plan} workspace={workspace} />
          </>
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
            {!plan.exempt && <PlanCards current={plan.plan || 'free'} workspaceName={workspace?.name} />}
            <PlanFooter plan={plan} workspace={workspace} />
          </>
        )}
      </Body>
    </Screen>
  );
}
