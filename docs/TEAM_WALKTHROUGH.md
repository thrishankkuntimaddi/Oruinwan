# A week with a 5-person team

A hands-on walkthrough of Oruinwan, start to finish: one person signs up, creates a workspace,
invites four teammates, connects GitHub and Jira, and the team runs a one-week sprint with chat,
huddles, tasks, notes, pull requests, CI, workflows and AI.

Follow it on the live server (`https://oruinwan.poelys.com`) or on your own machine
([LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md)). Button and menu names are written exactly as they
appear in the app, in **bold**. Boxes marked **Watch out** are current gaps you will hit; they are
also listed in [PRODUCT_MAP.md](PRODUCT_MAP.md#5-gaps-ranked).

> To walk through it alone, use five browser profiles (or one normal window, one private window,
> the desktop app, the Android app and a second browser). Each needs its own email address;
> `you+asha@gmail.com` style addresses work with Gmail.

---

## The team

| Person | Role in the story | Workspace role | Uses |
|---|---|---|---|
| **Asha** | Founder and product lead | Owner | Web app + Android phone |
| **Ben** | Backend developer | Admin | Desktop app (Mac) |
| **Chen** | Frontend developer | Member | Desktop app (Windows) |
| **Divya** | Designer | Member | Web app + tablet |
| **Eli** | QA and DevOps | Member | Web app + Android phone |

They are building **"Pulse"**, a small web app, in a GitHub repository `asha/pulse`, and track bugs
from customers in Jira project **PUL**.

Free plan, which this team fits inside: 11 people per workspace (owner + 10), 10 extra channels,
calls of up to 10 people and 30 minutes, 300 active tasks, 50 AI requests per person per day,
4 signed-in devices per person. See **Settings → Plan & usage**.

---

## Day 0 — Asha sets everything up

### 1. Create the account

1. Open the site → **Sign in** → **Create account** tab (or go to `/login?mode=signup`).
2. **Your details:** Username `asha`, Email, Date of birth → **Continue**.
3. **Secure your account:** Password (8–16 characters with an uppercase letter, a number and a
   symbol) → **Create account**. The password also unlocks your encrypted messages.
4. **Check your email** → click the link → `/verify-email` → back to **Sign in**.

   Or skip the password: **Continue with Google**, pick a username and date of birth →
   **Create my account**.
5. Sign in. You land on **Workspaces** ("Welcome back, Asha").

**Make the account safe now** (**Settings → Password & security**):
- **Two-factor authentication → Turn on**, scan the code with an authenticator app, enter the code →
  **Confirm**.
- **Passkeys → Add a passkey** (Touch ID / Windows Hello / phone).
- On the phone: install the Android app, open it → **Sign in with QR** on the computer, then on the
  phone **Settings → Scan to sign in** → **Approve**. That's device 2 of 4.

### 2. Create the workspace

1. **New workspace**. The wizard **Set up your space** has three steps:
2. **Name:** Workspace name `Pulse Team`, pick an icon and colour. Leave **Start from a template**
   on **Blank workspace** → **Next**.
3. **Project:** "What's your team working on right now?" → type `pulse` (or tap a chip such as
   Product launch). The preview shows the channels you'll get: **#general, #random, #pulse** →
   **Create workspace**.
4. **Teammates:** keep this open for the next step.

What the server created: the workspace with Asha as owner, three public channels (these three never
count toward the 10-channel limit) and an encryption key for each channel.

### 3. Invite the team

In the wizard's **Teammates** step, or later from the workspace name menu → **Invite people**:

- **Invite by email:** paste
  `ben@…, chen@…, divya@…, eli@…`. **Join as:** **Member**. → **Send invites and open**.
- Or **Share a link** → **Copy** and drop it into your team chat. A **Team link** works for 7 days;
  a **One-time link** works for one person.

Pending invites show under **Invite people → Pending invites** (you can **Revoke**). They count
toward the 11-person limit.

**Each teammate:** opens the email → **You're invited to Pulse Team** → **Create account** (or sign
in) → lands in `/workspace/…/home`.

**Make Ben an admin:** Workspace admin (rail) → **Members** → Ben → **Promote to Admin**.

### 4. Shape the workspace

**Channels** (rail → **Channels** → **Create channel**):

| Channel | Visibility | For |
|---|---|---|
| `#engineering` | Public | Dev talk, PR and CI cards |
| `#design` | Public | Mockups and reviews |
| `#bugs` | Public | Jira issues, QA |
| `#leads` | Private (Asha, Ben) | Planning, hiring |

For each: **Channel Name**, **Description (Optional)**, **Channel Visibility** → **Next Step** →
pick members → **Create Channel**.

> **Watch out:** integrations and workflows can only post into a channel after **someone has sent at
> least one message there** (the server needs the channel's key, which is created with the first
> message). Post "Channel for PR and CI updates 👋" in `#engineering`, `#bugs` and `#design` now, or
> the GitHub and Jira cards later will be skipped silently.

**Workspace admin → Features**: leave Tasks, Notes, Polls, Huddles, File uploads, Threads,
Reminders and Oruinwan AI on.

**Workspace admin → Permissions**: Channel Creation and Invite Members for members — your call.
Asha leaves both on.

**Settings → Notifications** (each person): turn on **Desktop notifications**; pick
"Only mentions and direct messages" if you want it quiet. Per channel: channel **Options → Mute
Notifications**.

---

## Day 0 (afternoon) — Ben connects the tools

Integrations live under **Settings → Integrations** (also **Agents & tools → Apps →
Integration settings**). Admins connect them for the whole workspace.

> **Watch out:** GitHub, Jira and CI send events to the server over the internet. On the live server
> that just works. On your own machine, run a tunnel (`cloudflared tunnel --url http://localhost:8080`
> or ngrok) and set `INTEGRATIONS_PUBLIC_URL` to the tunnel URL in `server/.env`, then restart.

### 5. GitHub

**a. Create a token on GitHub.** GitHub → Settings → Developer settings → **Fine-grained tokens** →
Generate. Repository access: `asha/pulse`. Permissions: **Pull requests: Read**, **Contents: Read**,
**Checks: Read**, **Commit statuses: Read**, **Issues: Read and write**.

**b. Connect in Oruinwan.** **Settings → Integrations → GitHub → Connect** → paste the token →
**Test and connect**.

**c. Say where events go.** Under **Where events are posted** add routes:

| Repository | Channel | Events |
|---|---|---|
| `asha/pulse` | `#engineering` | pull_request, pull_request_review, push, check_suite, workflow_run |
| `asha/pulse` | `#bugs` | issues |

→ **Save routes**.

**d. Add the webhook on GitHub.** Copy the **Payload URL** and **Secret** (the secret is shown once;
**Rotate secret** makes a new one). On GitHub: repo → Settings → Webhooks → **Add webhook** →
paste the URL, content type `application/json`, paste the secret, choose "Let me select individual
events" → Pull requests, Pull request reviews, Pushes, Issues, Check suites, Workflow runs → **Add
webhook**. GitHub sends a ping; it should show a green tick.

**e. Behaviour toggles** (same GitHub card):
- **Link tasks** — task keys like `PUL-12` in a PR title, branch or body link the PR to that task.
- **Sync task status** — PR opened → task **In review** (draft → **In progress**), merged → **Done**.
- **Oruinwan AI auto-review** — Oruinwan AI reviews each new PR and posts the review in its thread. Ben leaves it off and asks for
  reviews by hand.

**Personal GitHub (optional, each developer):** the same card offers **Connect my own** so
`/github issue` is created as you. It uses GitHub sign-in when the server has a GitHub OAuth app
(`GITHUB_CONNECT_CLIENT_ID` / `GITHUB_CONNECT_CLIENT_SECRET`), otherwise a personal token.

> **Watch out:** there is no repository picker yet (you type `owner/name`) and the webhook is added
> by hand on GitHub. AI reviews stay inside Oruinwan; they are not posted back to the PR on GitHub.

### 6. Jira

1. **Settings → Integrations → Jira**: Jira site (`pulse.atlassian.net`), account email, API token
   (from id.atlassian.com → Security → API tokens) → **Connect and test**.
2. Route: project `PUL` → `#bugs`.
3. Copy the webhook URL (shown once; **Rotate webhook token** to replace). In Jira: Settings →
   System → **WebHooks** → Create → paste the URL → tick Issue **created**, **updated**,
   **deleted** → Save.
4. Turn on **Link tasks** (new issues become Oruinwan tasks) and **Sync task status** (Jira status moves the task).

> **Watch out:** Jira sync is **one way**. New issues and status changes come into Oruinwan; task
> changes in Oruinwan do not go back to Jira. Use `/jira` to create issues from Oruinwan.

### 7. CI (GitHub Actions)

**Settings → Integrations → CI/CD → GitHub Actions** → copy the URL. In the repo add a final step to
the workflow (or use the GitHub webhook "Workflow runs" event you already ticked):

```yaml
- name: Tell Oruinwan
  if: always()
  run: |
    curl -s -X POST "$ORUINWAN_CI_URL" -H 'Content-Type: application/json' \
      -d "{\"status\":\"${{ job.status }}\",\"pipeline\":\"${{ github.workflow }}\",\"branch\":\"${{ github.ref_name }}\",\"url\":\"${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}\"}"
  env:
    ORUINWAN_CI_URL: ${{ secrets.ORUINWAN_CI_URL }}
```

Build cards land in `#engineering`.

### 8. Other tools (optional)

| Tool | Where | Use |
|---|---|---|
| Google Drive / OneDrive / Dropbox | Settings → Integrations (token connectors) | `/drive` picks a file to share or attach to a task |
| Notion / Confluence | same | `/notion` share a page or import it into Knowledge |
| Zoom / Google Meet | same | `/zoom`, `/gmeet` create a meeting link |
| Slack / Teams | same | Bridge a channel during a migration |
| Zapier / Make / n8n | same | Post messages or create tasks from 5,000 other apps |
| Outgoing webhooks | Settings → Integrations → Outgoing webhooks | Your own service gets `task.created`, `task.completed`… signed with `X-Oruinwan-Signature` |

> Google Calendar and Gmail are not available yet.

### 9. AI agents

**Agents & tools → All agents**. **Oruinwan AI** is already there. Asha adds Claude for everyone:
**Directory** tab → **Claude** → **Install for everyone** → paste an Anthropic API key (checked
live before saving). Chen prefers his own ChatGPT: **Directory → ChatGPT → Connect my own**.

Now anyone can type `@claude` or `@ai` in a conversation, or open a DM with an agent from the Home
panel's **Agents** section.

### 10. Workflows

**Agents & tools → Workflows** (admins). Ben creates three from templates:

| Workflow | Trigger | Condition | Action |
|---|---|---|---|
| **PR merged → Post in #engineering** | GitHub PR merged | — | Send message: "🚀 {{pr.title}} merged by {{pr.author}}" |
| **CI failed → bug task** | Webhook received | `webhookType` equals `cicd` and `status` equals `failure` | Create task in `#bugs`, assign Eli, priority High |
| **Weekday standup** | Schedule, weekdays 09:30 | — | Send message in `#pulse`: "Standup: yesterday / today / blockers 🧵" |

Each has **Test** (a dry run with sample data) and **Run now**, and a run history.

---

## Monday — Sprint planning

### 11. Kick-off huddle

At 10:00 Asha opens `#pulse` → **Start huddle** (or types `/video`). Everyone in the channel gets a
ring / notification → **Join huddle**.

In the call: mute, camera, **screen share**, raise hand. The side panel has **Overview, Agenda,
Notes, Transcript, Summary, Whiteboard, Brainstorm, Chat**.

- **Agenda:** Asha adds "Sprint goal", "Bugs from Jira", "Design status".
- **Notes:** everyone types into the shared huddle note at once.
- **Transcript / captions:** turn on **Captions**; the transcript builds as people talk.
- **Action items** (in the note): "Login page redesign — Divya", "Rate-limit API — Ben",
  "Fix flaky test — Eli". Each item → **Convert to task**.

Asha ends the call. The **Summary** tab fills with an AI recap from the transcript, and the huddle
note stays in **Notes** shared with everyone who joined.

**Since 2.2:** the call opens a full call screen; minimise it (Esc or the chevron) to a floating
mini call and keep working. On the desktop app the call floats in its own small window above other
apps. Trying to join a second call asks **Stay** or **Switch**. Asha leaves her desk mid-call: her
phone shows **In a call on MacBook · Move here** → tap → the call continues on the phone after a
1–2 second pause, mute and camera kept. On Android the call keeps running in the background with
**Mute** and **Leave** in the notification.

### 12. Build the sprint in Tasks

Rail → **Tasks**.

1. **Planning → Milestones → New milestone**: "Pulse v0.3", due Friday.
2. Open the tasks created from the huddle. For each: set **Status** (To do), **Priority**,
   **Due date**, **Milestone** = Pulse v0.3.
3. Asha adds a bigger task: **New task** → title "Onboarding checklist" → **Assign to: Members**
   → Ben, Chen, Divya, Eli → **Task mode: Split**. Each of the four gets their own copy (their own
   key, their own status).
4. And a shared one: "Prepare demo" → **Members** → Asha, Chen → **Task mode: Shared**. One task,
   both assigned.
5. And a channel one: "Write release notes" → **Full channel** → channel `#pulse`. Everyone in
   `#pulse` sees it, and `#pulse` gets a "New task" notice.
6. Switch the layout: **List → Board** (drag cards between columns), **Sprint**, **Timeline**,
   **Workload** (who has too much).

Note each task's key, e.g. `PUL-12` for "Rate-limit API" — developers put it in branch names.

> **Watch out:** split copies are not grouped, so Asha can't see "all 4 onboarding copies" in one
> place, and only **Full channel** tasks post notices to the channel.

### 13. Roadmap

Rail → **Notes → Roadmap** tab → **New item** "Public beta" → link milestone "Pulse v0.3" and the
key tasks. Group **By status** or **By owner**. Progress follows the linked tasks.

---

## Tuesday — Building

### 14. Discussion becomes work

Chen in `#engineering`: "The dashboard double-loads on Safari 🤔". Ben replies **in thread**
(hover → **Reply in thread**). After five replies they agree on a fix.

- Hover Chen's message → **Convert to task** → title, priority, due date → create. The message now
  shows **☑ Task**.
- Or type `/task Fix Safari double-load` in the composer.
- Long thread? **Summarize thread** gives a short recap in the thread.
- **Remind me → Tomorrow at 9:00** on a message you need to come back to.

> **Watch out:** the **☑ Task** chip doesn't open the task yet, and the task doesn't link back to the
> message.

### 15. Pull request flow

Ben works on `PUL-12`:

```bash
git checkout -b PUL-12-rate-limit
# …code…
git push -u origin PUL-12-rate-limit
```

He opens a PR titled **"PUL-12: rate-limit the public API"**. What happens:

1. A **PR card** appears in `#engineering` (title, author, branch, checks).
2. Because of **Link tasks**, task `PUL-12` gets the PR under **Linked pull requests** and an
   activity note; with **Sync task status** it moves to **In review**.
3. CI runs; the check result updates the same card (a failure posts a thread reply under it).
4. Chen clicks the card (or types `/review asha/pulse#7`). The **code review drawer** opens:
   **Files** (diff, click a file for the whole file), **Overview**, **AI review**.
5. **Ask Oruinwan AI to review** → the review is posted as a thread reply under the PR card and
   noted on the task.
6. Chen approves on GitHub. The review shows up as a thread reply. Ben merges.
7. On merge: the card updates, task `PUL-12` → **Done**, and the **PR merged → Post in
   #engineering** workflow posts "🚀 …merged by ben".

Other GitHub commands: `/github issue Add dark mode` (creates an issue in the channel's repo),
`/github pr asha/pulse#7` (shows a PR card).

### 16. A bug from a customer

A customer reports a crash; Eli creates **PUL-31** in Jira. Seconds later:

- A Jira card appears in `#bugs`, and a task **PUL-31** is created there (Link tasks on).
- Eli moves the Jira issue to **In Progress** → the task moves to **In progress** and a 🔀 reply is
  added under the card.
- From Oruinwan, Eli files a follow-up: `/jira PUL Crash when the session expires`.

### 17. CI fails

Chen pushes a branch that breaks a test. The GitHub Actions step posts a red build card to
`#engineering`, and the **CI failed → bug task** workflow creates a High-priority task for Eli in
`#bugs`.

---

## Wednesday — Design and knowledge

### 18. Design review

Divya uploads the new login mockups: open Files (Split view → **Files**, or `/workspace/…/files`)
→ upload `login-v2.fig.png` → open it → **Start review**: Title "Login v2", "What should reviewers
look at?" → "Spacing and the error state", Due Thursday, Reviewers Asha and Chen.

Reviewers pin comments on the image, reply, resolve, and pick **Approve** or **Request changes**.
Divya uploads a new version for round 2.

> **Watch out:** Files and Knowledge are not on the rail yet; use **Split view** (Ctrl+\\) or search.
> Files shared in chat don't appear in the Files library. Design reviews aren't linked to tasks.

### 19. Notes and knowledge

- Ben: **Notes → New note → Tech design** template → "Rate limiting" → **Share → Workspace** so
  everyone can read it. Chen opens it at the same time — live co-editing with cursors.
- Asha: **New note → SOP** → "How we release" → share with Ben and Eli with **Edit**.
- Knowledge base (`/workspace/…/knowledge`): Asha creates a **Handbook** page "Onboarding" and links
  it to "How we release". The **graph** view shows how pages connect. Imports from Notion or Drive
  go through `/notion` or the cloud picker.

### 20. Ask the AI

Open the AI panel (top bar → **Toggle Oruinwan AI**) or DM an agent:

- "What's left in milestone Pulse v0.3?" — it reads tasks.
- "Summarize the rate-limiting design note" — it reads notes.
- "Create a task for Eli: retest PUL-31 on Android, due Friday" — it creates the task.
- "Schedule a 20-minute demo rehearsal with Asha and Chen tomorrow at 4" — it schedules a meeting.
- In `#engineering`: `@claude explain this error: …` — Claude answers in the channel.

AI can search notes, tasks and knowledge pages (not message text, which stays encrypted). Each
person has 50 AI requests a day on the Free plan.

---

## Thursday — Scheduled meeting and split view

### 21. Schedule a meeting

Home panel → **Upcoming Schedules → Schedule Meeting** (or the **+** menu in a channel → **Meeting**,
or **Huddles → Schedule**). Title "Demo rehearsal", time, duration, invitees, channel `#pulse`.
**Find a time** suggests free slots. Everyone is reminded before it starts; the meeting page
(`/workspace/…/meetings/:id`) has the agenda before, the call during, and notes, recording,
transcript and recap after.

### 22. Split view

Ben presses **Ctrl+\\** (**Split view**) → **Open beside** → task `PUL-12` next to `#engineering`, or
a thread next to its channel, or the "Rate limiting" note next to a DM with Chen. On a tablet the
same works in landscape.

---

## Friday — Release and retro

### 23. Release

- Last PRs merge → linked tasks go **Done** → milestone "Pulse v0.3" shows 100%.
- Asha completes "Write release notes" (a **Full channel** task) → `#pulse` gets the "Completed"
  notice.
- Ben tags the release on GitHub; the push card appears in `#engineering`.

### 24. Retro huddle

A 25-minute voice huddle in `#pulse` (Free plan calls stop at 30 minutes; a banner warns before).
Use the **Brainstorm** tab for "went well / to improve"; convert the improvements to tasks for next
week. The AI **Summary** captures decisions.

### 25. Check the week

- **Tasks → Time report** and **Workload**.
- **Workspace admin → Analytics**.
- **Settings → Plan & usage**: AI today, calls, members, tasks against the Free limits.
- **Home**: Unread, Mentions, Upcoming meetings, **Jump back in**.

---

## Everyday habits that make it work

| Habit | Why |
|---|---|
| Put the task key (`PUL-12`) in branch names and PR titles | PRs link and move tasks by themselves |
| Discuss in threads, then **Convert to task** | The decision and the work stay connected |
| Use the huddle note's **Action items** | Meetings end with owners, not just notes |
| Share design notes with the workspace | AI can find them; new people can read them |
| Route each tool to one channel | `#engineering` for code, `#bugs` for issues — no noise in `#general` |
| Mute busy channels, keep mentions on | Notifications stay meaningful |

---

## What you'll notice is missing (and is planned)

From this walkthrough, in the order you hit them:

1. Integrations need a first message in a channel before they can post there.
2. No GitHub repo picker / automatic webhook; AI reviews don't go back to GitHub.
3. Jira is one-way.
4. Screen sharing from an Android phone (you can watch others' screens).
5. The message ↔ task link is one-way; split copies aren't grouped.
6. Files and Knowledge aren't on the rail; chat files aren't in Files.
7. No Google Calendar or Gmail; no group DMs.

Calls and notifications were reworked in 2.2. The rest are ranked in
[PRODUCT_MAP.md → Gaps](PRODUCT_MAP.md#5-gaps-ranked).
