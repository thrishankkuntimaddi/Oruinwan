const razorpay = require('../razorpay');
const service = require('../billing.service');

const ENV = {
    RAZORPAY_KEY_ID: 'rzp_test_x',
    RAZORPAY_KEY_SECRET: 'secret',
    RAZORPAY_WEBHOOK_SECRET: 'whsec',
    RAZORPAY_PLAN_PRO_YEARLY_USD: 'plan_yu',
    RAZORPAY_PLAN_PRO_MONTHLY_INR: 'plan_mi',
};

describe('Razorpay settings and signatures', () => {
    test('off without keys or plans', () => {
        expect(razorpay.enabled({})).toBe(false);
        expect(razorpay.enabled({ RAZORPAY_KEY_ID: 'a', RAZORPAY_KEY_SECRET: 'b' })).toBe(false);
        expect(razorpay.enabled(ENV)).toBe(true);
    });

    test('offers only the plans that are set', () => {
        expect(razorpay.offered(ENV)).toEqual([{ cycle: 'monthly', currency: 'INR' }, { cycle: 'yearly', currency: 'USD' }]
            .sort((a, b) => (a.cycle > b.cycle ? 1 : -1)));
        expect(razorpay.planIdFor('yearly', 'USD', ENV)).toBe('plan_yu');
        expect(razorpay.planIdFor('monthly', 'USD', ENV)).toBeNull();
    });

    test('checkout signature is HMAC(payment|subscription, key secret)', () => {
        const signature = razorpay.hmacHex('secret', 'pay_1|sub_1');
        expect(razorpay.verifyPaymentSignature({ paymentId: 'pay_1', subscriptionId: 'sub_1', signature }, ENV)).toBe(true);
        expect(razorpay.verifyPaymentSignature({ paymentId: 'pay_2', subscriptionId: 'sub_1', signature }, ENV)).toBe(false);
        expect(razorpay.verifyPaymentSignature({ paymentId: 'pay_1', subscriptionId: 'sub_1', signature: '' }, ENV)).toBe(false);
    });

    test('webhook signature is HMAC(raw body, webhook secret)', () => {
        const body = Buffer.from('{"event":"subscription.charged"}');
        const sig = razorpay.hmacHex('whsec', body);
        expect(razorpay.verifyWebhookSignature(body, sig, ENV)).toBe(true);
        expect(razorpay.verifyWebhookSignature(Buffer.from('{}'), sig, ENV)).toBe(false);
        expect(razorpay.verifyWebhookSignature(body, sig, { ...ENV, RAZORPAY_WEBHOOK_SECRET: '' })).toBe(false);
    });
});

/** An in-memory stand-in for subscriptions.repository. */
function fakeRepo({ wsPlan = 'free', userPlan = 'free' } = {}) {
    const subs = [];
    const events = new Set();
    const payments = [];
    const ws = { id: 'w1', name: 'Acme', plan: wsPlan, company_id: null };
    const user = { id: 'u1', email: 'o@acme.test', plan: userPlan };
    const PRO = ['active', 'pending'];
    return {
        PRO_STATUSES: PRO, subs, payments, ws, user,
        insert: async (s) => { const row = { ...s, cancelAtPeriodEnd: false, createdAt: new Date(subs.length) }; subs.push(row); return row; },
        findByProviderId: async (id) => subs.find((s) => s.providerSubscriptionId === id) || null,
        latestForWorkspace: async (w) => subs.filter((s) => s.workspaceId === w).slice(-1)[0] || null,
        activeForWorkspace: async (w) => subs.filter((s) => s.workspaceId === w && PRO.includes(s.status)).slice(-1)[0] || null,
        listActive: async () => subs.filter((s) => PRO.includes(s.status)),
        updateFromEntity: async (e) => {
            const s = subs.find((x) => x.providerSubscriptionId === e.id);
            if (!s) return null;
            Object.assign(s, { status: e.status, quantity: e.quantity ?? s.quantity });
            return s;
        },
        setQuantity: async (id, q) => { subs.find((s) => s.providerSubscriptionId === id).quantity = q; },
        setCancelAtPeriodEnd: async (id, v) => { subs.find((s) => s.providerSubscriptionId === id).cancelAtPeriodEnd = v; },
        ownerHasActive: async (o) => subs.some((s) => s.ownerId === o && PRO.includes(s.status)),
        ownerHasAny: async (o) => subs.some((s) => s.ownerId === o),
        recordPayment: async (p) => { payments.push(p); },
        paymentsFor: async () => [],
        markEvent: async (id) => { if (events.has(id)) return false; events.add(id); return true; },
        forgetEvent: async (id) => { events.delete(id); },
        workspacePlanRow: async () => ws,
        setWorkspacePlan: async (_w, p) => { ws.plan = p; },
        userPlanRow: async () => user,
        setUserPlan: async (_u, p) => { user.plan = p; },
        ownedWorkspaces: async () => [ws],
    };
}

describe('Pro subscriptions', () => {
    const saved = { ...service.deps };
    const savedEnv = process.env;
    let repo;
    let rz;

    beforeEach(() => {
        process.env = { ...savedEnv, ...ENV };
        repo = fakeRepo();
        rz = {
            createSubscription: jest.fn(async () => ({ id: 'sub_1', status: 'created', short_url: 'https://rzp.io/i/x' })),
            fetchSubscription: jest.fn(async () => ({ id: 'sub_1', status: 'active', quantity: 4 })),
            updateQuantity: jest.fn(async () => ({})),
            cancel: jest.fn(async () => ({ id: 'sub_1', status: 'active' })),
        };
        Object.assign(service.deps, {
            repo,
            razorpay: () => rz,
            seats: async () => 4,
            clearPlanCache: () => {},
            membership: async (_w, userId) => ({ workspace: { name: 'Acme' }, member: {}, role: userId === 'u1' ? 'owner' : 'member', isAdmin: userId === 'u1' }),
        });
    });
    afterEach(() => { Object.assign(service.deps, saved); process.env = savedEnv; });

    test('checkout charges for the member count', async () => {
        const out = await service.startCheckout('w1', { id: 'u1', email: 'o@acme.test' }, { cycle: 'yearly', currency: 'USD' });
        expect(rz.createSubscription).toHaveBeenCalledWith(expect.objectContaining({ planId: 'plan_yu', quantity: 4, email: 'o@acme.test' }));
        expect(out).toEqual(expect.objectContaining({ subscriptionId: 'sub_1', shortUrl: 'https://rzp.io/i/x', quantity: 4, amount: 24000, keyId: 'rzp_test_x' }));
        expect(repo.subs[0].status).toBe('created');
        expect(repo.ws.plan).toBe('free'); // not paid yet
    });

    test('only the owner can buy, and not twice', async () => {
        await expect(service.startCheckout('w1', { id: 'u2' }, { cycle: 'yearly', currency: 'USD' })).rejects.toMatchObject({ status: 403 });
        await expect(service.startCheckout('w1', { id: 'u1' }, { cycle: 'monthly', currency: 'USD' })).rejects.toMatchObject({ status: 400 });
        await service.startCheckout('w1', { id: 'u1' }, { cycle: 'yearly', currency: 'USD' });
        repo.subs[0].status = 'active';
        await expect(service.startCheckout('w1', { id: 'u1' }, { cycle: 'yearly', currency: 'USD' })).rejects.toMatchObject({ status: 409, code: 'ALREADY_PRO' });
    });

    test('off when Razorpay is not set up', async () => {
        process.env = { ...savedEnv, RAZORPAY_KEY_ID: '', RAZORPAY_KEY_SECRET: '' };
        await expect(service.startCheckout('w1', { id: 'u1' }, { cycle: 'yearly', currency: 'USD' })).rejects.toMatchObject({ status: 503, code: 'BILLING_OFF' });
        expect(service.publicConfig()).toEqual({ enabled: false, provider: null, keyId: null, offers: [] });
    });

    test('webhooks switch the workspace and owner to Pro and back, once per event', async () => {
        await service.startCheckout('w1', { id: 'u1' }, { cycle: 'yearly', currency: 'USD' });
        const charged = {
            event: 'subscription.charged',
            payload: { subscription: { entity: { id: 'sub_1', status: 'active', quantity: 4 } }, payment: { entity: { id: 'pay_1', amount: 24000, currency: 'USD' } } },
        };
        expect(await service.handleWebhook(charged, 'evt_1')).toEqual({ handled: true, event: 'subscription.charged' });
        expect(repo.ws.plan).toBe('pro');
        expect(repo.user.plan).toBe('pro');
        expect(repo.payments).toHaveLength(1);

        expect(await service.handleWebhook(charged, 'evt_1')).toMatchObject({ duplicate: true });
        expect(repo.payments).toHaveLength(1);

        await service.handleWebhook({ event: 'subscription.pending', payload: { subscription: { entity: { id: 'sub_1', status: 'pending' } } } }, 'evt_2');
        expect(repo.ws.plan).toBe('pro'); // Razorpay is retrying the charge

        await service.handleWebhook({ event: 'subscription.halted', payload: { subscription: { entity: { id: 'sub_1', status: 'halted' } } } }, 'evt_3');
        expect(repo.ws.plan).toBe('free');
        expect(repo.user.plan).toBe('free');
    });

    test('plans set by hand are left alone', async () => {
        repo.ws.plan = 'enterprise';
        await service.reconcile('w1', 'u1');
        expect(repo.ws.plan).toBe('enterprise');

        // A Pro owner switched on by SQL (no online subscription) stays Pro.
        repo.ws.plan = 'free';
        repo.user.plan = 'pro';
        await service.reconcile('w1', 'u1');
        expect(repo.user.plan).toBe('pro');
    });

    test('unknown events and subscriptions are ignored', async () => {
        expect(await service.handleWebhook({ event: 'payment.captured' }, 'e')).toEqual({ handled: false, event: 'payment.captured' });
        expect(await service.handleWebhook({ event: 'subscription.activated', payload: { subscription: { entity: { id: 'sub_other', status: 'active' } } } }, 'e2'))
            .toEqual({ handled: false, event: 'subscription.activated' });
    });

    test('a failed delivery can be retried', async () => {
        await service.startCheckout('w1', { id: 'u1' }, { cycle: 'yearly', currency: 'USD' });
        repo.setWorkspacePlan = async () => { throw new Error('db down'); };
        const ev = { event: 'subscription.activated', payload: { subscription: { entity: { id: 'sub_1', status: 'active' } } } };
        await expect(service.handleWebhook(ev, 'evt_9')).rejects.toThrow('db down');
        repo.setWorkspacePlan = async (_w, p) => { repo.ws.plan = p; };
        expect(await service.handleWebhook(ev, 'evt_9')).toMatchObject({ handled: true });
        expect(repo.ws.plan).toBe('pro');
    });

    test('verify checks the signature, then reads the subscription back', async () => {
        await service.startCheckout('w1', { id: 'u1' }, { cycle: 'yearly', currency: 'USD' });
        await expect(service.verifyCheckout('w1', 'u1', { paymentId: 'pay_1', subscriptionId: 'sub_1', signature: 'bad' })).rejects.toMatchObject({ status: 400 });
        const signature = razorpay.hmacHex('secret', 'pay_1|sub_1');
        const out = await service.verifyCheckout('w1', 'u1', { paymentId: 'pay_1', subscriptionId: 'sub_1', signature });
        expect(rz.fetchSubscription).toHaveBeenCalledWith('sub_1');
        expect(out.plan).toBe('pro');
    });

    test('seat sync follows the member count; cancel stops renewal only', async () => {
        await service.startCheckout('w1', { id: 'u1' }, { cycle: 'yearly', currency: 'USD' });
        repo.subs[0].status = 'active';
        service.deps.seats = async () => 7;
        expect(await service.syncAllSeats()).toEqual({ checked: 1, changed: 1 });
        expect(rz.updateQuantity).toHaveBeenCalledWith('sub_1', 7);
        expect(await service.syncAllSeats()).toEqual({ checked: 1, changed: 0 });

        await service.cancel('w1', 'u1');
        expect(rz.cancel).toHaveBeenCalledWith('sub_1', { atCycleEnd: true });
        expect(repo.subs[0].cancelAtPeriodEnd).toBe(true);
        expect(repo.subs[0].status).toBe('active');
    });
});
