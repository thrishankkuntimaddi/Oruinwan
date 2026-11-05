import React, { useCallback, useEffect, useState } from 'react';
import { CreditCard, ExternalLink, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { invalidatePlan } from '../plan/usePlan';
import {
    cancelSubscription, defaultOffer, formatMoney, getOwnedBilling, openPayment, priceLine, startCheckout, verifyCheckout,
} from './billing';

const offerKey = (o) => `${o.cycle}:${o.currency}`;
const offerLabel = (o) => `${o.cycle === 'yearly' ? 'Yearly' : 'Monthly'} · ${o.currency} · ${formatMoney(o.unitAmount, o.currency)} per member`;
const day = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const errText = (err) => err?.response?.data?.message || err?.message || 'Something went wrong. Please try again.';

/** One owned workspace: its Pro subscription, or the upgrade choice. */
function WorkspaceRow({ ws, offers, onChanged }) {
    const { user } = useAuth();
    const [offer, setOffer] = useState(() => defaultOffer(offers));
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState('');
    const [confirmCancel, setConfirmCancel] = useState(false);
    const sub = ws.subscription;
    const isPro = ws.plan === 'pro' || sub?.active;
    const unlimited = ws.plan === 'enterprise' || ws.plan === 'company';

    const upgrade = async () => {
        if (!offer) return;
        setBusy(true); setNote('');
        try {
            const checkout = await startCheckout(ws.workspaceId, offer);
            const result = await openPayment(checkout, { name: user?.name || user?.username, email: user?.email });
            if (result.status === 'paid') {
                setNote('Payment received. Switching the workspace to Pro…');
                await verifyCheckout(ws.workspaceId, result.answer);
                invalidatePlan();
                setNote('This workspace is on Pro now.');
            } else if (result.status === 'opened') {
                setNote('Finish paying in your browser. The workspace moves to Pro a minute after the payment goes through.');
            }
            await onChanged();
        } catch (err) {
            setNote(errText(err));
        } finally {
            setBusy(false);
        }
    };

    const cancel = async () => {
        if (!confirmCancel) { setConfirmCancel(true); return; }
        setBusy(true); setNote('');
        try {
            await cancelSubscription(ws.workspaceId);
            setNote('Renewal stopped. The workspace stays on Pro until the paid period ends.');
            setConfirmCancel(false);
            await onChanged();
        } catch (err) {
            setNote(errText(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="prc-limits__row prc-bill__row" data-testid={`billing-${ws.workspaceId}`}>
            <dt>
                {ws.name}
                <span className={`prc-tag${isPro || unlimited ? ' prc-tag--good' : ''}`}>
                    {unlimited ? 'No limits' : isPro ? 'Pro' : 'Free'}
                </span>
            </dt>
            <dd>
                {unlimited && <p>This workspace has no plan limits.</p>}
                {!unlimited && sub?.active && (
                    <>
                        <p>
                            {sub.quantity} member{sub.quantity === 1 ? '' : 's'} · {formatMoney(sub.amount, sub.currency)} {sub.cycle === 'yearly' ? 'a year' : 'a month'}
                            {sub.currentEnd ? ` · ${sub.cancelAtPeriodEnd ? 'ends' : 'renews'} ${day(sub.currentEnd)}` : ''}
                        </p>
                        {sub.seats !== null && sub.seats !== sub.quantity && (
                            <p className="prc-bill__hint">Now {sub.seats} members: the next charge is for {sub.seats}.</p>
                        )}
                        {!sub.cancelAtPeriodEnd && (
                            <button type="button" className="gl-btn gl-btn--sm" disabled={busy} onClick={cancel}>
                                {confirmCancel ? 'Yes, stop renewing' : 'Stop renewing'}
                            </button>
                        )}
                    </>
                )}
                {!unlimited && isPro && !sub?.active && <p>Pro, switched on by our team.</p>}
                {!unlimited && !isPro && (
                    <>
                        {sub?.status === 'created' && sub.shortUrl && (
                            <p className="prc-bill__hint">
                                A payment was started but not finished.{' '}
                                <a href={sub.shortUrl} target="_blank" rel="noopener noreferrer">Finish it <ExternalLink size={11} aria-hidden="true" /></a>
                            </p>
                        )}
                        <div className="prc-bill__buy">
                            <select
                                aria-label={`Billing for ${ws.name}`}
                                value={offer ? offerKey(offer) : ''}
                                onChange={(e) => setOffer(offers.find((o) => offerKey(o) === e.target.value) || null)}
                                disabled={busy}
                            >
                                {offers.map((o) => <option key={offerKey(o)} value={offerKey(o)}>{offerLabel(o)}</option>)}
                            </select>
                            <button type="button" className="gl-btn gl-btn--primary gl-btn--sm" disabled={busy || !offer} onClick={upgrade}>
                                <Sparkles size={13} aria-hidden="true" /> {busy ? 'Opening…' : 'Upgrade to Pro'}
                            </button>
                        </div>
                        {offer && <p className="prc-bill__hint">{priceLine(offer, ws.seats)}. Members who join later are added at the next charge.</p>}
                    </>
                )}
                {note && <p className="prc-bill__note" role="status">{note}</p>}
            </dd>
        </div>
    );
}

/**
 * "Pro for your workspaces" on the signed-in pricing page. Hidden while online payments are off
 * on this server (the Pro card's email link still works then).
 */
export default function ProBilling({ onEnabled }) {
    const [state, setState] = useState({ loading: true, data: null });
    const load = useCallback(async () => {
        try {
            setState({ loading: false, data: await getOwnedBilling() });
        } catch {
            setState({ loading: false, data: null });
        }
    }, []);
    useEffect(() => { load(); }, [load]);

    const data = state.data;
    const on = Boolean(data?.billing?.enabled);
    useEffect(() => { onEnabled?.(on); }, [on, onEnabled]);
    if (state.loading || !data?.billing?.enabled) return null;
    const offers = data.billing.offers || [];

    return (
        <section className="prc-limits" id="prc-billing" aria-labelledby="prc-billing-title">
            <div className="prc-limits__head">
                <h2 id="prc-billing-title"><CreditCard size={16} aria-hidden="true" /> Pro for your workspaces</h2>
                <p>
                    Pro is paid per member: everyone in the workspace gets Pro, and the price follows how many people
                    are in it. Payments are handled by Razorpay (cards, UPI, net banking). Stop renewing at any time.
                </p>
            </div>
            {data.workspaces.length === 0 ? (
                <p className="prc-note">Only a workspace's owner can upgrade it. Ask the owner of your workspace.</p>
            ) : (
                <dl className="prc-bill">
                    {data.workspaces.map((ws) => <WorkspaceRow key={ws.workspaceId} ws={ws} offers={offers} onChanged={load} />)}
                </dl>
            )}
        </section>
    );
}
