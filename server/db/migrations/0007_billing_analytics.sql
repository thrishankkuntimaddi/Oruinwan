-- Billing, invoices and analytics snapshots. Money is numeric(12,2), never float.

CREATE TABLE IF NOT EXISTS billing_accounts (
    company_id         text PRIMARY KEY,
    plan               text NOT NULL DEFAULT 'free',
    amount             numeric(12,2) NOT NULL DEFAULT 0,
    billing_cycle      text NOT NULL DEFAULT 'monthly',     -- monthly | annual
    status             text NOT NULL DEFAULT 'active',      -- active | pending | overdue | cancelled
    last_payment_date  timestamptz,
    next_payment_date  timestamptz,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS billing_accounts_status ON billing_accounts (status);

CREATE TABLE IF NOT EXISTS billing_payments (
    id              bigserial PRIMARY KEY,
    company_id      text NOT NULL REFERENCES billing_accounts(company_id) ON DELETE CASCADE,
    amount          numeric(12,2) NOT NULL,
    paid_at         timestamptz NOT NULL DEFAULT now(),
    status          text NOT NULL,                       -- success | failed | pending
    transaction_id  text
);
CREATE INDEX IF NOT EXISTS billing_payments_company ON billing_payments (company_id, paid_at DESC);

CREATE TABLE IF NOT EXISTS invoices (
    id               text PRIMARY KEY,
    company_id       text NOT NULL,
    invoice_number   text NOT NULL UNIQUE,
    amount           numeric(12,2) NOT NULL CHECK (amount >= 0),
    currency         text NOT NULL DEFAULT 'USD',
    plan_type        text NOT NULL,
    plan_name        text NOT NULL,
    period_start     timestamptz,
    period_end       timestamptz,
    seats_included   integer NOT NULL DEFAULT 0,
    seats_used       integer NOT NULL DEFAULT 0,
    status           text NOT NULL DEFAULT 'pending',     -- paid | pending | failed | refunded | cancelled
    issue_date       timestamptz NOT NULL DEFAULT now(),
    due_date         timestamptz NOT NULL,
    paid_date        timestamptz,
    payment_method   jsonb,                               -- { type, last4, brand }
    transaction_id   text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoices_company_issue ON invoices (company_id, issue_date DESC);
CREATE INDEX IF NOT EXISTS invoices_company_status ON invoices (company_id, status);

-- Periodic snapshots; nested breakdowns stay jsonb, headline numbers are columns for charts.
CREATE TABLE IF NOT EXISTS analytics_snapshots (
    id              bigserial PRIMARY KEY,
    company_id      text NOT NULL,
    period          text NOT NULL,                        -- daily | weekly | monthly
    snapshot_date   date NOT NULL,
    users_total     integer NOT NULL DEFAULT 0,
    users_active    integer NOT NULL DEFAULT 0,
    users_new       integer NOT NULL DEFAULT 0,
    workspaces_total integer NOT NULL DEFAULT 0,
    messages_total  integer NOT NULL DEFAULT 0,
    tasks_total     integer NOT NULL DEFAULT 0,
    tasks_done      integer NOT NULL DEFAULT 0,
    details         jsonb NOT NULL DEFAULT '{}'::jsonb,   -- byRole, byWorkspace, ... as the old document had
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (company_id, period, snapshot_date)
);
CREATE INDEX IF NOT EXISTS analytics_snapshots_company ON analytics_snapshots (company_id, period, snapshot_date DESC);
