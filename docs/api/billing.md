# Billing API — Pro paid online (Razorpay)

Code: `server/src/features/billing/` · Tables: migration `0019_pro_subscriptions.sql` · Plans: [plans.md](plans.md) · Business: [BUSINESS_MODEL.md](../BUSINESS_MODEL.md)

## How it works

- **Slack-style.** The workspace **owner** subscribes the workspace. Everyone in it gets Pro. The
  quantity is the number of members (active and suspended; removed people don't count, pending
  invites don't count).
- **Members change.** A daily job (`billing-seat-sync`) sets the subscription's quantity to the
  current member count, **from the next charge on** (`schedule_change_at: cycle_end`). No mid-cycle
  proration.
- **Razorpay is the source of truth.** The webhook copies each subscription's status and switches:
  - `workspaces.plan` → `pro` while the status is `active` or `pending` (a charge failed and
    Razorpay is retrying), back to `free` for `halted`, `cancelled`, `completed`, `expired`, `paused`;
  - the owner's `users.plan` → `pro` while they pay for any workspace (more workspaces, devices, AI).
- **Plans set by hand are kept.** `enterprise` and company workspaces are never touched. A `pro` set by
  SQL for a workspace or person with no online subscription is never switched back to free.
- **Off until configured.** Without `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and at least one plan id,
  `/config` answers `enabled: false`, the apps keep the email upgrade, and checkout answers 503 `BILLING_OFF`.
- **Store builds sell nothing.** The Google Play and iPhone builds hide prices, buy buttons and links
  to the website's checkout (Play/App Store billing policy). Web, desktop and the GitHub APK pay here.

## Endpoints (`/api/billing`)

| Method | Path | Who | Answer |
|---|---|---|---|
| GET | `/config` | signed in | `{ enabled, provider, keyId, offers: [{ cycle, currency, unitAmount }] }` (amounts in cents/paise per member) |
| GET | `/workspaces` | signed in | `{ workspaces: [{ workspaceId, name, plan, seats, subscription }], billing }`: the workspaces I own |
| GET | `/workspaces/:id` | owner, admins | `{ workspaceId, plan, seats, subscription, payments, billing }` |
| POST | `/workspaces/:id/checkout` | owner | body `{ cycle: 'monthly'\|'yearly', currency: 'USD'\|'INR' }` → 201 `{ provider, keyId, subscriptionId, shortUrl, quantity, cycle, currency, unitAmount, amount, workspaceName }` |
| POST | `/workspaces/:id/verify` | owner, admins | body = Razorpay Checkout's handler answer `{ razorpay_payment_id, razorpay_subscription_id, razorpay_signature }` → the workspace status |
| POST | `/workspaces/:id/cancel` | owner | stop renewing at the end of the paid period → the workspace status |
| POST | `/webhook/razorpay` | Razorpay | checked with `X-Razorpay-Signature` over the raw body; `X-Razorpay-Event-Id` makes retries no-ops; 500 makes Razorpay retry |

`subscription` = `{ status, active, cycle, currency, quantity, seats, unitAmount, amount, currentEnd, cancelAtPeriodEnd, shortUrl }`
(`shortUrl` only while a payment was started but not finished). Errors: 400 bad choice or signature,
403 not the owner, 404 not a member, 409 `ALREADY_PRO` or already unlimited, 502 Razorpay error, 503 `BILLING_OFF`.

## Clients

- **Web** (`client/src/features/billing`): *Plans and pricing* → **Pro for your workspaces**. Opens
  Razorpay Checkout over the page (`checkout.razorpay.com` is allowed in the CSP), then calls
  `/verify` so the workspace is on Pro at once.
- **Desktop** (same web bundle, `IS_APP`) and **phone** (`mobile/src/features/plan`): open the
  subscription's `shortUrl` (Razorpay's hosted page) in the browser; the webhook finishes it and the
  Plan screen refreshes when the app comes back to the front.

## Setting it up

1. Razorpay account → activate it (needs the website's Terms, Privacy, Refund and Contact pages).
   For dollar prices, ask Razorpay to switch on **International Payments**.
2. `server/.env`: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (test keys first).
3. `node scripts/billing/create-razorpay-plans.js` (add `--only=INR` while international payments are off)
   and paste the printed `RAZORPAY_PLAN_PRO_*` lines into `server/.env`.
4. Razorpay Dashboard → Webhooks → **Add**: URL `https://api.oruinwan.poelys.com/api/billing/webhook/razorpay`,
   a secret (→ `RAZORPAY_WEBHOOK_SECRET`), events: all `subscription.*`.
5. Restart the app (migration 0019 runs on start). Try it with a test card, then repeat 2–4 with live keys.
