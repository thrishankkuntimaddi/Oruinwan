-- Pro subscriptions paid online (Razorpay; server/src/features/billing, docs/BUSINESS_MODEL.md §7).
-- A workspace owner subscribes the workspace; the quantity is its member count (Slack-style).
-- The webhook keeps `status` current and switches workspaces.plan between 'pro' and 'free'.
CREATE TABLE IF NOT EXISTS pro_subscriptions (
    id                       text PRIMARY KEY,
    workspace_id             text NOT NULL,
    owner_id                 text NOT NULL,
    provider                 text NOT NULL DEFAULT 'razorpay',
    provider_subscription_id text NOT NULL UNIQUE,
    provider_plan_id         text NOT NULL,
    cycle                    text NOT NULL,          -- 'monthly' | 'yearly'
    currency                 text NOT NULL,          -- 'USD' | 'INR'
    quantity                 integer NOT NULL DEFAULT 1,
    status                   text NOT NULL DEFAULT 'created',
    short_url                text,
    current_start            timestamptz,
    current_end              timestamptz,
    cancel_at_period_end     boolean NOT NULL DEFAULT false,
    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pro_subscriptions_workspace_idx ON pro_subscriptions (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pro_subscriptions_owner_idx ON pro_subscriptions (owner_id);

-- Every successful or failed charge, for "Plan history" in the apps.
CREATE TABLE IF NOT EXISTS pro_subscription_payments (
    provider_payment_id      text PRIMARY KEY,
    provider_subscription_id text NOT NULL,
    workspace_id             text NOT NULL,
    amount                   numeric(12, 2) NOT NULL,   -- in the currency's main unit (dollars, rupees)
    currency                 text NOT NULL,
    status                   text NOT NULL,
    invoice_id               text,
    paid_at                  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pro_subscription_payments_ws_idx ON pro_subscription_payments (workspace_id, paid_at DESC);

-- Webhook deliveries already handled (Razorpay retries; x-razorpay-event-id makes them idempotent).
CREATE TABLE IF NOT EXISTS billing_webhook_events (
    event_id     text PRIMARY KEY,
    provider     text NOT NULL,
    event        text NOT NULL,
    received_at  timestamptz NOT NULL DEFAULT now()
);
