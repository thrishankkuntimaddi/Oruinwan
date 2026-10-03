'use strict';

/**
 * Billing accounts, payments, invoices and analytics snapshots on PostgreSQL
 * (migration 0007). Returns the camelCase shapes the old Mongo documents had
 * (`companyId`, `paymentHistory`, `billingPeriod: { start, end }`, ...), with
 * money as numbers.
 */

const { query, withTransaction } = require('../../shared/postgres');
const { newId, camelRow, str } = require('../../identity/sql');

const num = (v) => (v == null ? v : Number(v));

function toAccount(row, payments = []) {
    if (!row) return null;
    const a = camelRow(row);
    a.amount = num(a.amount);
    a.paymentHistory = payments.map((p) => ({ amount: num(p.amount), date: p.paid_at, status: p.status, transactionId: p.transaction_id }));
    return a;
}

function toInvoice(row) {
    if (!row) return null;
    const i = camelRow(row);
    i.amount = num(i.amount);
    i.billingPeriod = { start: i.periodStart, end: i.periodEnd };
    delete i.periodStart; delete i.periodEnd;
    return i;
}

const billing = {
    async get(companyId) {
        const { rows } = await query('SELECT * FROM billing_accounts WHERE company_id = $1', [str(companyId)]);
        if (!rows[0]) return null;
        const { rows: p } = await query('SELECT * FROM billing_payments WHERE company_id = $1 ORDER BY paid_at', [str(companyId)]);
        return toAccount(rows[0], p);
    },
    /** All accounts (optionally by status) with their payment history. */
    async list({ status } = {}) {
        const { rows } = await query(
            `SELECT * FROM billing_accounts${status ? ' WHERE status = $1' : ''} ORDER BY created_at DESC`,
            status ? [status] : []
        );
        if (!rows.length) return [];
        const { rows: p } = await query('SELECT * FROM billing_payments WHERE company_id = ANY($1) ORDER BY paid_at', [rows.map((r) => r.company_id)]);
        const by = new Map();
        for (const r of p) { if (!by.has(r.company_id)) by.set(r.company_id, []); by.get(r.company_id).push(r); }
        return rows.map((r) => toAccount(r, by.get(r.company_id) || []));
    },
    async upsert(companyId, { plan, amount, billingCycle, status, lastPaymentDate, nextPaymentDate }) {
        const { rows } = await query(
            `INSERT INTO billing_accounts (company_id, plan, amount, billing_cycle, status, last_payment_date, next_payment_date)
             VALUES ($1, COALESCE($2, 'free'), COALESCE($3::numeric, 0), COALESCE($4, 'monthly'), COALESCE($5, 'active'), $6, $7)
             ON CONFLICT (company_id) DO UPDATE SET
                plan = COALESCE($2, billing_accounts.plan), amount = COALESCE($3::numeric, billing_accounts.amount),
                billing_cycle = COALESCE($4, billing_accounts.billing_cycle), status = COALESCE($5, billing_accounts.status),
                last_payment_date = COALESCE($6, billing_accounts.last_payment_date),
                next_payment_date = COALESCE($7, billing_accounts.next_payment_date), updated_at = now()
             RETURNING *`,
            [str(companyId), plan ?? null, amount ?? null, billingCycle ?? null, status ?? null, lastPaymentDate ?? null, nextPaymentDate ?? null]
        );
        return toAccount(rows[0]);
    },
    /** Record a payment and move the account dates in one transaction. */
    async recordPayment(companyId, { amount, status = 'success', transactionId = null, paidAt = new Date(), nextPaymentDate = null }) {
        return withTransaction(async (tx) => {
            await tx.query('INSERT INTO billing_accounts (company_id) VALUES ($1) ON CONFLICT DO NOTHING', [str(companyId)]);
            await tx.query('INSERT INTO billing_payments (company_id, amount, paid_at, status, transaction_id) VALUES ($1, $2, $3, $4, $5)', [str(companyId), amount, paidAt, status, transactionId]);
            if (status === 'success') {
                await tx.query('UPDATE billing_accounts SET last_payment_date = $2, next_payment_date = COALESCE($3, next_payment_date), status = \'active\', updated_at = now() WHERE company_id = $1', [str(companyId), paidAt, nextPaymentDate]);
            }
        });
    },
    /** Monthly recurring revenue across active accounts (annual plans divided by 12). */
    async mrr() {
        const { rows } = await query(
            `SELECT COALESCE(SUM(CASE WHEN billing_cycle = 'annual' THEN amount / 12 ELSE amount END), 0)::float AS mrr,
                    count(*)::int AS active
             FROM billing_accounts WHERE status = 'active'`
        );
        return rows[0];
    },
};

const invoices = {
    async list(companyId, { status, limit = 50, skip = 0 } = {}) {
        const params = [str(companyId)];
        let where = 'company_id = $1';
        if (status) { params.push(status); where += ` AND status = $${params.length}`; }
        params.push(limit, skip);
        const { rows } = await query(`SELECT * FROM invoices WHERE ${where} ORDER BY issue_date DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
        return rows.map(toInvoice);
    },
    async latest(companyId) {
        const { rows } = await query('SELECT * FROM invoices WHERE company_id = $1 ORDER BY issue_date DESC LIMIT 1', [str(companyId)]);
        return toInvoice(rows[0]);
    },
    async create(inv) {
        const { rows } = await query(
            `INSERT INTO invoices (id, company_id, invoice_number, amount, currency, plan_type, plan_name, period_start, period_end,
                seats_included, seats_used, status, issue_date, due_date, paid_date, payment_method, transaction_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17) RETURNING *`,
            [str(inv._id) || newId(), str(inv.companyId), inv.invoiceNumber, inv.amount, inv.currency || 'USD', inv.planType, inv.planName,
                inv.billingPeriod?.start || null, inv.billingPeriod?.end || null, inv.seatsIncluded || 0, inv.seatsUsed || 0,
                inv.status || 'pending', inv.issueDate || new Date(), inv.dueDate, inv.paidDate || null,
                inv.paymentMethod ? JSON.stringify(inv.paymentMethod) : null, inv.transactionId || null]
        );
        return toInvoice(rows[0]);
    },
    async markPaid(id, { paidDate = new Date(), transactionId = null } = {}) {
        const { rows } = await query("UPDATE invoices SET status = 'paid', paid_date = $2, transaction_id = COALESCE($3, transaction_id), updated_at = now() WHERE id = $1 RETURNING *", [str(id), paidDate, transactionId]);
        return toInvoice(rows[0]);
    },
    async count(companyId, { status } = {}) {
        const { rows } = await query(`SELECT count(*)::int AS n FROM invoices WHERE company_id = $1${status ? ' AND status = $2' : ''}`, status ? [str(companyId), status] : [str(companyId)]);
        return rows[0].n;
    },
};

const analytics = {
    async upsertSnapshot(companyId, period, snapshotDate, numbers = {}, details = {}) {
        await query(
            `INSERT INTO analytics_snapshots (company_id, period, snapshot_date, users_total, users_active, users_new, workspaces_total, messages_total, tasks_total, tasks_done, details)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
             ON CONFLICT (company_id, period, snapshot_date) DO UPDATE SET users_total = EXCLUDED.users_total, users_active = EXCLUDED.users_active,
                users_new = EXCLUDED.users_new, workspaces_total = EXCLUDED.workspaces_total, messages_total = EXCLUDED.messages_total,
                tasks_total = EXCLUDED.tasks_total, tasks_done = EXCLUDED.tasks_done, details = EXCLUDED.details`,
            [str(companyId), period, snapshotDate, numbers.usersTotal || 0, numbers.usersActive || 0, numbers.usersNew || 0,
                numbers.workspacesTotal || 0, numbers.messagesTotal || 0, numbers.tasksTotal || 0, numbers.tasksDone || 0, JSON.stringify(details)]
        );
    },
    /** Time series for charts, newest last. */
    async series(companyId, period = 'daily', limit = 30) {
        const { rows } = await query(
            'SELECT * FROM (SELECT * FROM analytics_snapshots WHERE company_id = $1 AND period = $2 ORDER BY snapshot_date DESC LIMIT $3) s ORDER BY snapshot_date',
            [str(companyId), period, limit]
        );
        return rows.map((r) => camelRow(r));
    },
};

module.exports = { billing, invoices, analytics };
