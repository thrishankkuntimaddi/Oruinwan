// Pro paid online (server/src/features/billing, docs/api/billing.md): the API calls, prices,
// and opening Razorpay Checkout. In the browser Checkout opens over the page; the desktop app
// (IS_APP, whose page loads no outside scripts) opens Razorpay's hosted payment page instead.
import api from '../../services/api';
import { IS_APP } from '../../appMode/env';

export const CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

export const getOwnedBilling = () => api.get('/api/billing/workspaces').then((r) => r.data);
export const startCheckout = (workspaceId, { cycle, currency }) =>
    api.post(`/api/billing/workspaces/${workspaceId}/checkout`, { cycle, currency }).then((r) => r.data);
export const verifyCheckout = (workspaceId, answer) =>
    api.post(`/api/billing/workspaces/${workspaceId}/verify`, answer).then((r) => r.data);
export const cancelSubscription = (workspaceId) =>
    api.post(`/api/billing/workspaces/${workspaceId}/cancel`).then((r) => r.data);

/** "$60.00", "₹4,788" from an amount in cents/paise. */
export function formatMoney(minor, currency) {
    if (minor === null || minor === undefined) return '';
    const major = Number(minor) / 100;
    try {
        return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
            style: 'currency', currency, maximumFractionDigits: Number.isInteger(major) ? 0 : 2,
        }).format(major);
    } catch {
        return `${currency} ${major}`;
    }
}

/** "$60 per member a year · 4 members = $240 a year". */
export function priceLine({ unitAmount, cycle, currency }, members) {
    if (unitAmount === null || unitAmount === undefined) return '';
    const per = cycle === 'yearly' ? 'a year' : 'a month';
    const n = Math.max(1, Number(members) || 1);
    return `${formatMoney(unitAmount, currency)} per member ${per} · ${n} member${n === 1 ? '' : 's'} = ${formatMoney(unitAmount * n, currency)} ${per}`;
}

/** The offer to preselect: yearly, in rupees for Indian browsers, else dollars. */
export function defaultOffer(offers, locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US') {
    if (!offers?.length) return null;
    const preferred = /-IN$/i.test(String(locale || '')) ? 'INR' : 'USD';
    return offers.find((o) => o.cycle === 'yearly' && o.currency === preferred)
        || offers.find((o) => o.currency === preferred)
        || offers.find((o) => o.cycle === 'yearly')
        || offers[0];
}

let scriptPromise = null;
function loadCheckoutScript() {
    if (typeof window !== 'undefined' && window.Razorpay) return Promise.resolve(window.Razorpay);
    if (!scriptPromise) {
        scriptPromise = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = CHECKOUT_SCRIPT;
            s.async = true;
            s.onload = () => (window.Razorpay ? resolve(window.Razorpay) : reject(new Error('Checkout did not load')));
            s.onerror = () => { scriptPromise = null; reject(new Error('Could not load the payment window. Check your connection.')); };
            document.head.appendChild(s);
        });
    }
    return scriptPromise;
}

/**
 * Open payment for a checkout answer. Resolves:
 *   { status: 'paid', answer }    Checkout succeeded (verify `answer` with the server)
 *   { status: 'opened' }          the hosted page opened in the browser (the webhook finishes it)
 *   { status: 'closed' }          the person closed Checkout
 */
export async function openPayment(checkout, { name, email } = {}) {
    if (IS_APP || !checkout.subscriptionId) {
        if (!checkout.shortUrl) throw new Error('The payment page is not available. Please try again.');
        window.open(checkout.shortUrl, '_blank', 'noopener');
        return { status: 'opened' };
    }
    const Razorpay = await loadCheckoutScript();
    return new Promise((resolve, reject) => {
        const rz = new Razorpay({
            key: checkout.keyId,
            subscription_id: checkout.subscriptionId,
            name: 'Oruinwan',
            description: `Pro for ${checkout.workspaceName || 'your workspace'} · ${checkout.quantity} member${checkout.quantity === 1 ? '' : 's'}`,
            prefill: { name: name || undefined, email: email || undefined },
            theme: { color: '#B8892F' },
            handler: (answer) => resolve({ status: 'paid', answer }),
            modal: { ondismiss: () => resolve({ status: 'closed' }) },
        });
        // A failed attempt stays in Checkout (it shows the error and lets them retry).
        try { rz.open(); } catch (err) { reject(err); }
    });
}
