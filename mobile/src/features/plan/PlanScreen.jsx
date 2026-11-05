// Settings → Plan & usage: which plan this is, what the free plan allows and how much of it is
// used (from GET /api/plan). Company accounts and workspaces have no free-plan limits.
import { useEffect, useState } from 'react';
import { Building2, Check, CreditCard, Gauge, History, LifeBuoy, Mail, Phone, Rocket, Sparkles } from 'lucide-react';
import { nav } from '../../app/nav.js';
import { onAppState, openExternal } from '../../native/index.js';
import { toast } from '../../lib/bus.js';
import { useSession, useWorkspace } from '../../data/session.js';
import { invalidate } from '../../data/query.js';
import { Body, Header, Screen } from '../../ui/Screen.jsx';
import { Button } from '../../ui/Button.jsx';
import { Row, RowGroup, Section } from '../../ui/List.jsx';
import { Chips } from '../../ui/Controls.jsx';
import { EmptyState, SkeletonRows } from '../../ui/Feedback.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { cx } from '../../ui/cx.js';
import { TEMPLATES } from '../notes/templates.js';
import { openPricing, sellsInApp, startProCheckout, useBilling, usePlan } from './plan.js';
import {
  COMING_SOON, EXEMPT_TEXT, PLAN_CARDS, PLAY_LIMIT_TEXT, SALES_EMAIL, defaultOffer, enterpriseEmail, money, offerText, planName, resetText,
  templateKey, templateUsage, upgradeEmail,
} from './planText.js';

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

const offerId = (o) => `${o.cycle}:${o.currency}`;

/** Pro's button: Razorpay's payment page when the server takes payments, else the email. */
function ProBuy({ ws, workspaceName, billing }) {
  const offers = billing?.enabled ? billing.offers : [];
  const [chosen, setChosen] = useState(null);
  const [busy, setBusy] = useState(false);
  const offer = offers.find((o) => offerId(o) === chosen) || defaultOffer(offers);
  if (!offers.length) {
    return (
      <Button className="mt-3" size="sm" icon={Rocket} onClick={() => { const e = upgradeEmail(workspaceName); mail(e.subject, e.body); }}>
        Upgrade to Pro
      </Button>
    );
  }
  const seats = Math.max(1, billing.seats || 1);
  const pay = async () => {
    setBusy(true);
    try {
      await startProCheckout(ws, offer);
      toast('Finish paying in your browser. The workspace moves to Pro a minute after the payment goes through.');
    } catch (err) {
      toast(err?.message || "Couldn't start the payment.", 'danger');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-3 -mx-4" data-testid="pro-buy">
      <Chips options={offers.map((o) => ({ value: offerId(o), label: offerText(o) }))} value={offer ? offerId(offer) : ''} onChange={setChosen} />
      {offer && (
        <p className="mx-4 mt-2 text-[12px] text-text-2 tabular-nums">
          {seats} member{seats === 1 ? '' : 's'} · {money(offer.unitAmount * seats, offer.currency)} {offer.cycle === 'yearly' ? 'a year' : 'a month'}
        </p>
      )}
      <div className="mx-4 mt-2">
        <Button size="sm" icon={CreditCard} loading={busy} onClick={pay}>
          Upgrade to Pro
        </Button>
      </div>
    </div>
  );
}

/** Free, Pro and Enterprise side by side (swipe), the current one marked. Store builds show no prices for Pro. */
function PlanCards({ current, workspaceName, ws, billing }) {
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
              {(sellsInApp || p.id !== 'pro') && (
                <>
                  <p className="mt-1 text-[20px] font-bold tracking-tight">{p.price}</p>
                  <p className="text-[12px] text-text-2">{p.note}</p>
                </>
              )}
              <ul className="mt-3 flex-1 space-y-1.5">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2 text-[13px] leading-snug">
                    <Icon as={Check} size={14} className="mt-0.5 shrink-0 text-success" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {!on && p.id === 'pro' && sellsInApp && <ProBuy ws={ws} workspaceName={workspaceName} billing={billing} />}
              {!on && p.id === 'enterprise' && (
                <Button className="mt-3" size="sm" variant="secondary" icon={Mail} onClick={() => { const e = enterpriseEmail(workspaceName); mail(e.subject, e.body); }}>
                  Talk to us
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

const dateText = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/** Help with the plan, and its history. */
function PlanFooter({ plan, workspace, billing }) {
  const sub = billing?.subscription;
  const payments = billing?.payments || [];
  const since = workspace?.createdAt ? new Date(workspace.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null;
  return (
    <>
      <Section title="Help">
        <RowGroup>
          <Row icon={LifeBuoy} tile="accent" title="Contact support" subtitle="Problems, billing questions, limits" onClick={() => nav.push('settings.support')} />
          <Row icon={Building2} title="Talk to us about Enterprise" subtitle={SALES_EMAIL} onClick={() => mail('Oruinwan Enterprise')} />
          {sellsInApp && <Row icon={Gauge} title="Compare plans on the website" onClick={() => openPricing(plan?.upgradeUrl)} />}
        </RowGroup>
      </Section>
      <Section title="Plan history">
        <RowGroup footer={payments.length ? 'Razorpay emails a receipt for every payment.' : 'No payments yet.'}>
          <Row
            icon={History}
            title={planName(plan)}
            subtitle={
              sub?.active && sub.currentEnd
                ? `${sub.cancelAtPeriodEnd ? 'Ends' : 'Renews'} ${dateText(sub.currentEnd)} · ${sub.quantity} member${sub.quantity === 1 ? '' : 's'}`
                : since ? `Since ${since}` : 'Current plan'
            }
            value="Current"
            chevron={false}
          />
          {payments.map((pay) => (
            <Row
              key={pay.id}
              icon={CreditCard}
              title={money(Math.round((pay.amount || 0) * 100), pay.currency)}
              subtitle={dateText(pay.paidAt)}
              value={pay.status === 'captured' ? 'Paid' : pay.status}
              chevron={false}
            />
          ))}
        </RowGroup>
      </Section>
    </>
  );
}

export function PlanScreen() {
  const ws = useSession((s) => s.workspaceId);
  const workspace = useWorkspace();
  const { data: plan, loading, error } = usePlan(ws);
  const { data: billing } = useBilling(ws);

  // Back from paying in the browser: read the plan and billing again.
  useEffect(() => {
    let off;
    onAppState((active) => {
      if (active) { invalidate('plan:'); invalidate('billing:'); }
    }).then((f) => { off = f; });
    return () => off?.();
  }, []);

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
            <PlanCards current={error ? null : 'free'} workspaceName={workspace?.name} ws={ws} billing={billing} />
            <PlanFooter plan={plan} workspace={workspace} billing={billing} />
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
                  {(plan.plan || 'free') === 'free' && <p className="mt-3 text-sm text-text-2">{sellsInApp ? COMING_SOON : PLAY_LIMIT_TEXT}</p>}
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

                        </span>
                      ))}
                    </div>
                  )}
                  {sellsInApp && (
                    <Button className="mt-3.5" variant="secondary" size="sm" onClick={() => openPricing(plan.upgradeUrl)}>
                      See plans
                    </Button>
                  )}
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
            {!plan.exempt && <PlanCards current={plan.plan || 'free'} workspaceName={workspace?.name} ws={ws} billing={billing} />}
            <PlanFooter plan={plan} workspace={workspace} billing={billing} />
          </>
        )}
      </Body>
    </Screen>
  );
}
