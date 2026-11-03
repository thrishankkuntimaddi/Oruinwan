# Oruinwan — Business model

| | |
|---|---|
| Status | Adopted 2026-11-03, replaces "Pro and Enterprise coming soon" |
| Owner | Founder (repository owner) |
| Sources of truth | Limits: `server/src/shared/plans/plans.js` · Prices and website copy: `client/src/pages/pricing/plans.js` · Phone copy: `mobile/src/features/plan/planText.js` |
| Related | [PRD](PRD.md) · [Plans API](api/plans.md) · [Scaling](SCALING.md) |

---

## 1. The angle: one workspace, every conversation

**One line:** *Follow one workspace, not five apps.*

Teams talk in a chat app, meet in a video app, track work on a task board, write in a docs tool and
ask an AI assistant in yet another tab. Each has its own login, notifications, search and bill, and
the context is lost between them: the decision made in chat never reaches the task, the meeting
notes never reach the people who missed it.

In Oruinwan **every conversation lives in one workspace** (channels, DMs, groups, threads, huddles,
meetings and agent chats), and everything that comes out of a conversation stays linked to it:

- a message, note or file becomes a task that points back to where it came from;
- a call's recap and action items are posted into the channel that held it;
- `@ai` works inside any conversation, with the model the team chooses;
- one sidebar, one search, one set of notifications, on web, desktop, Android and phone browsers.

What we are **not** selling: "Slack, but cheaper". The promise is that a team only has to follow one
place. Price is the second reason to switch, not the first.

### Who we sell to first

| Segment | Why they buy | Plan |
|---|---|---|
| Startups and small teams (3–30 people) | One tool instead of five, free to start | Free → Pro |
| Agencies and studios working with clients | Tasks, notes and calls next to the client channel | Pro |
| Companies (50–2,000 people) that want their own server: IT services, healthcare, education, government suppliers, finance | Data on their own servers, their own sign-in and AI keys, an open-source codebase they can audit | Enterprise |

The open-source, self-hostable codebase (MIT) is the trust argument for Enterprise and the
distribution channel for everyone else: developers find it on GitHub, try it, and bring it to work.

---

## 2. Plans

Every plan has **every feature**. Plans differ in room (limits), support and who runs it. This
keeps the product simple to explain and means nobody hits a paywall in the middle of a task, only a
limit that grows.

| | **Free** | **Pro** | **Enterprise** |
|---|---|---|---|
| Price | $0, no card | **$5 per member / month billed yearly**, $6 monthly | Custom: one-time setup + yearly licence |
| Who it's for | Small teams getting started | Teams that run their work in one workspace | Companies that want it set up for them |
| Signed-in devices | 4 per person | 10 per person | Unlimited |
| Workspaces | Create 2, join 2 | Create 10, join 20 | Unlimited |
| Members per workspace | Owner + 10 | Owner + 100 | Unlimited |
| Channels | 10 besides the defaults | Unlimited | Unlimited |
| Huddles | 10 people, 30 minutes | 25 people, 5 hours | 25 people, no time cap |
| Notes | 2 per template, blank unlimited | Unlimited | Unlimited |
| Active tasks | 300 per workspace; 30 + 30 per person | 10,000 per workspace | Unlimited |
| AI on Oruinwan's key | 50 per person, 300 per workspace a day | 100 per person, 2,000 per workspace a day | Unlimited, or their own keys / model |
| AI with your own key | Unlimited | Unlimited | Unlimited |
| Support | Docs and GitHub issues | Email, one business day | Priority, named contact, agreed response time |
| Who runs it | Oruinwan cloud | Oruinwan cloud | Their servers or cloud, or a dedicated instance run by us |
| Setup | Self-serve | Self-serve, switched on by us | Done by us: install, SSO, domain, email, workspaces, departments, onboarding |

Rules that apply to every plan:

- **Per member, not per workspace, for Pro.** Everyone inside a Pro workspace gets Pro limits in it,
  including their AI allowance (the server takes the better of the person's and the workspace's plan).
- **Grandfathering.** Downgrading or an expired plan never deletes or hides anything. Only new
  additions over a limit are refused.
- **Company accounts** (registered through *Register company* and approved by us) are on Enterprise
  terms: no plan limits.
- **Self-hosters** can change or remove every limit (`PLAN_LIMITS_JSON`, `ORUINWAN_UNLIMITED=1`,
  `DEVICE_LIMIT`, `PRO_DEVICE_LIMIT`). The licence is MIT; Enterprise sells the work and the support,
  not permission.

### Why these prices

- Rough list prices of what a small team pays today *(check before quoting, they change)*: a
  chat app's paid plan (≈ $7–9 per user), a video meeting plan (≈ $13–15 per host), a task tool
  (≈ $8–11 per user) and AI seats (≈ $20+ per user). Oruinwan Pro at **$5** replaces most of that
  for a typical team, which makes the switch an easy yes.
- $5 is also low enough that a founder can pay it on a card without a purchasing process.
- Prices are in US dollars. For India we can quote **₹399 per member / month yearly (₹499 monthly)**;
  keep that in one place (`PRO_PRICE` in `client/src/pages/pricing/plans.js`) when we add local
  currencies.

---

## 3. How a team buys Pro today (manual, until online billing)

No payment provider is connected yet (the company console's billing sits behind the `billing` flag).
Until it is, Pro is sold by email. This is deliberate: the first 20–50 paying teams are worth a
personal conversation.

1. The owner presses **Upgrade to Pro** (website, web app, desktop or phone). It opens an email to
   `admin@poelys.com` with the workspace name, owner email, member count, yearly/monthly and country
   filled in as blanks.
2. We reply the same business day with a payment link (Razorpay for India, Stripe or PayPal for
   everyone else) or an invoice for bank transfer. Count members who are active, not invited.
3. When it is paid, switch the workspace **and its owner** to Pro on the server (see §7), and reply
   with a short welcome: what changed, how to reach support.
4. Put a renewal reminder 14 days before the period ends. If it isn't renewed, set the plan back to
   `free` (nothing is deleted; see grandfathering).

**Refunds:** monthly, none after the month starts; yearly, pro-rata within the first 30 days.
**Adding members mid-year:** invoice the difference at the next renewal (no surprise bills).

When this takes more than an hour a week, connect Stripe / Razorpay checkout and turn on the `billing`
flag (see §8).

---

## 4. Enterprise: we set it up for you

Enterprise is a service plus a licence. The customer writes through **Talk to us** (prefilled email:
company, size, where it should run, sign-in, current tools, phone number) and gets an answer within
two business days.

| Step | What happens | Who |
|---|---|---|
| 1. Call (30 min) | Team size, tools, where it should run (their servers, their AWS/Azure/GCP, or a dedicated instance run by us), sign-in, compliance needs | Founder |
| 2. Proposal | Fixed setup price + yearly price per member, in writing, with what is and isn't included | Founder |
| 3. Setup (1–2 weeks) | Install with Docker Compose (see README → Self-hosting), HTTPS, backups and snapshots, SAML/Google single sign-on, their domain and sending email, company console, departments and workspaces, AI keys or a self-hosted model | Oruinwan team |
| 4. Rollout | Invites, two onboarding sessions (admins, everyone), a named support contact | Oruinwan team |
| 5. Run | Updates applied by us or by their IT (signed quick updates for the apps), priority support | Shared, per contract |

**Internal price guide** (not published; adjust per deal):

| Item | Starting point |
|---|---|
| Setup on their servers or cloud | from $1,500 (≈ ₹1.25 lakh) one-time; more for SSO with several providers or strict compliance work |
| Licence + support | from $8 per member / month, billed yearly, minimum 25 members |
| Dedicated instance run by us | licence + hosting at cost + 20%, priced after sizing |
| Extra work (custom integrations, branding, migration scripts) | day rate, quoted up front |

Never promise features that don't exist (for example, importing history from Slack is not built).
Put anything custom in the proposal as paid work with a date.

---

## 5. Unit economics

### AI is the cost to watch

Oruinwan's own AI key defaults to `claude-sonnet-5-5` ($2 per million input tokens, $10 per million
output) with `claude-haiku-5-5` ($0.10 / $0.50) as the fast model. A typical request (≈ 3,000 tokens
in, ≈ 500 out) costs about **$0.011 on Sonnet** and **$0.0006 on Haiku**.

| Case | AI cost per member per month | Against $5 Pro |
|---|---|---|
| Typical member: 10 requests a working day (≈ 220 a month) | ≈ $2.40 | covered |
| Heavy member at the Pro cap: 100 a day every day | ≈ $33 | loses money, but the workspace cap stops it spreading |
| Workspace at the Pro cap: 2,000 a day | ≈ $660 a month | only reachable by large Pro teams |

That is why Pro's AI allowance is 100 per person and 2,000 per workspace per day, not more. Levers,
in order:

1. **Bring your own key** is unlimited on every plan and costs us nothing. Push it in the upgrade copy.
2. Route short tasks (smart replies, rewrites, classification) to the fast model.
3. Prompt caching for the system prompt and long conversation context.
4. Watch real usage for the first paying teams before raising any AI limit.

### Hosting

Today one t3.micro EC2 instance runs everything (see [Scaling](SCALING.md)). It is enough for the free
beta, not for paying teams. Before the first ~10 paying teams: move to at least a t3.medium (or
t3.large), managed backups, uptime monitoring and error alerts. Rough cost at that size is
$40–80 a month, covered by about ten 5-person Pro teams.

### Targets for the first year

| Milestone | Signal |
|---|---|
| 50 active Free workspaces | the product is worth trying |
| 10 paying Pro teams | the product is worth paying for |
| 1 Enterprise setup | the service model works |
| Free → Pro conversion ≥ 3% of active workspaces | pricing and limits are right |
| Monthly churn of paying teams < 3% | it stays the one place teams follow |

Measure workspaces, members, plan and AI usage from the server's own tables. **No per-person
activity metrics** and no message analytics: privacy is part of the product.

---

## 6. Go to market

1. **Product-led:** Free plan, sign-up in a minute, the setup wizard, invite links. The limits are
   generous enough to get a whole small team in, and hit at the moment the team is growing.
2. **Open source:** GitHub README, releases and the self-hosting guide. Developers try it, then bring
   it to work. Ask happy teams for a GitHub star and a sentence for the website.
3. **Direct outreach for Enterprise:** IT services companies, colleges and hospitals that cannot put
   their conversations on someone else's cloud. Lead with "your servers, your sign-in, we set it up".
4. **Launches:** Play Store listing, Product Hunt, Hacker News "Show HN", and Indian startup
   communities, once the stability checklist (§8) is done.

---

## 7. Operating the plans (runbook)

Plans are columns in PostgreSQL: `users.plan` and `workspaces.plan` (`free`, `pro`, `enterprise`).
Run these on the server's database (`docker compose exec postgres psql -U oruinwan oruinwan`), and
always find the ids first.

```sql
-- Find the workspace (created_by is the owner) and the owner's account
SELECT id, name, created_by, plan FROM workspaces WHERE name ILIKE '%acme%';
SELECT id, email, plan FROM users WHERE email = 'owner@acme.com';

-- Pro: the workspace (members, channels, calls, tasks, AI) and its owner (workspaces, devices, AI)
UPDATE workspaces SET plan = 'pro' WHERE id = '<workspace id>';
UPDATE users      SET plan = 'pro' WHERE id = '<owner user id>';

-- Enterprise on our cloud (no limits for the workspace)
UPDATE workspaces SET plan = 'enterprise' WHERE id = '<workspace id>';

-- Back to Free (nothing is deleted)
UPDATE workspaces SET plan = 'free' WHERE id = '<workspace id>';
UPDATE users      SET plan = 'free' WHERE id = '<owner user id>';
```

Plan changes take effect within a minute (the server caches workspace plans for 60 seconds). Keep a
simple sheet of paying customers: workspace id, owner email, plan, period, amount, renewal date.

For Enterprise on the customer's own server, set `ORUINWAN_UNLIMITED=1` (or company accounts through
*Register company* + approval) in their `server/.env`.

---

## 8. Before charging money: checklist

| Item | Why | Status |
|---|---|---|
| Rotate the credentials in the old prototype `.env` (MongoDB URI, JWT secret, Cloudinary keys) that are still in public git history | Anyone can read them | **Owner to do**; the file is no longer in the code, only in history |
| GIPHY production key instead of the beta key (100 calls an hour) | GIF search stops working under load | **Owner to do** (apply at developers.giphy.com, then `GIPHY_API_KEY` in `server/.env`) |
| Play Store declarations (full-screen intent, foreground service, Data safety) and AAB upload | Android distribution | **Owner to do** |
| Bigger server, monitoring and alerts (§5) | Paying teams expect uptime | To do before 10 paying teams |
| Terms of service and refund policy pages that mention Pro and Enterprise | Needed for payment providers | To do with the payment provider |
| Online checkout (Stripe / Razorpay) + the `billing` flag | Removes the manual step | When manual sales take > 1 hour a week |
| Encryption wording: "encrypted, with a sealed server copy of each key", never "zero-knowledge" | Honesty; Enterprise buyers check | Done (README, PRD, landing, in-app docs) |

---

## 9. What changed in the code (2026-11-03)

- Server: Pro and Enterprise are no longer `comingSoon`; limit messages name the plan and the next
  step ("Upgrade to Pro for more room, or talk to us about Enterprise."); Pro calls use the higher
  technical cap so 25 people fit; members of a Pro workspace get its per-person AI allowance; Pro
  accounts get 10 devices (`PRO_DEVICE_LIMIT`) and Enterprise accounts unlimited; Pro AI set to
  100 / 2,000 a day.
- Web, desktop and phone: prices on the plan cards; **Upgrade to Pro** and **Talk to us** open the
  prefilled emails; the pricing page shows Free and Pro limits and the Enterprise setup steps, and
  reads the person's real plan; "coming soon" removed from plan copy.
- Landing page: a *Why Oruinwan* section ("Follow one workspace. Not five apps."), new pricing and
  FAQ copy.
