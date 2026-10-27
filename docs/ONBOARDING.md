# Oruinwan — Onboarding and Knowledge Transfer Kit

Everything a new engineer needs to understand, run, change, test, release and deploy Oruinwan.
Read in this order: this page → [PRD](PRD.md) (what and why) → [HLD](HLD.md) (how it fits) →
[LLD](LLD.md) (where the code is) → [CONVERSATIONS.md](CONVERSATIONS.md) (the chat rules).

---

## 1. Day-one checklist

- [ ] GitHub access to `thrishankkuntimaddi/Oruinwan` (write access to push to `main`).
- [ ] A local machine with Node.js 22+, Yarn 1, npm, Docker (Docker Desktop or `colima`), Git.
- [ ] For phone work: Android Studio (JDK 21) and/or Xcode 16+ with CocoaPods.
- [ ] Run the stack locally (section 3) and sign up a test account.
- [ ] Read the docs above and walk through [TEAM_WALKTHROUGH.md](TEAM_WALKTHROUGH.md).
- [ ] Production access is **not** needed on day one. AWS (EC2, region ap-south-1), Google Play
      Console, Firebase and Apple developer access are granted by the owner when needed.

## 2. Accounts, services and secrets

| Service | Used for | Where the secret lives |
|---|---|---|
| AWS EC2 (ap-south-1) | Production server (Docker Compose + Caddy) | Owner's AWS account; `aws login` |
| GitHub Actions | CI, app builds, releases | Repository secrets (keystore, update-signing key, Apple keys, Firebase config) |
| Firebase | Android push (FCM), phone analytics (opt-out) | Server `.env` (service account), CI secret (`google-services.json`) |
| Apple Push (APNs) | iPhone push | Server `.env` |
| Brevo | Email (verification, reset, invites) | Server `.env` |
| Google Cloud | Google sign-in, Drive backup | Server `.env`; the web client id is public |
| AI providers | Oruinwan AI | Server `.env` |
| Google Play Console | Android store listing | Owner |

Rules:
- **Never commit secrets.** `.env` files are ignored; templates (`*.env.example`,
  `.env.production.template`) hold placeholders only.
- Never paste secret values into issues, docs, chats or logs.
- If a secret is ever committed, rotate it first, then clean up.

## 3. Running locally

Full guide: [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md). Short version:

```bash
yarn install                       # root workspaces (server, client, e2e)
(cd mobile && npm install)
docker compose up -d postgres mongo redis s3   # databases and storage
cp server/.env.example server/.env             # then fill in local values
yarn workspace server dev          # API + realtime on :3000 (see .env)
yarn workspace client dev          # web on :5173
(cd mobile && npm run dev)         # phone UI in the browser
```

On a Mac without Docker Desktop: `colima start` first.

## 4. Codebase tour (one hour)

1. `server/src/modules/conversations/conversationAccess.js` — who may read and write where.
2. `server/src/modules/messages/sendRules.js` and `messages.service.js` — one message's life.
3. `server/src/modules/notifications/notificationService.js` — alerts and push.
4. `client/src/components/layout/MainLayout.jsx` — the web app's frame.
5. `client/src/features/messaging/chatWindowComp/ChatWindowV2.jsx` — the chat window.
6. `client/src/services/` — API client and encryption.
7. `mobile/src/app/Shell.jsx`, `nav.js`, `routes.js` — the phone app's frame and navigation.
8. `mobile/src/data/live/` — how the phone app talks to the server.
9. `platform/` — rules shared by web and phone.
10. `e2e/tests/` — how features are tested end to end.

## 5. How we work

- **Branch:** work lands on `main`. Keep changes small and focused; the owner decides when to push,
  tag and release.
- **Commits:** `type(scope): summary` — e.g. `feat(phone): …`, `fix(web): …`, `chore(apps): release 3.3.4`.
  The body explains what changed for people.
- **One rule, one place:** reuse the shared helpers (access, send rules, people matching) instead of
  copying logic.
- **UI:** light theme by default; ivory / sand / gold palette (60:30:10); no off-theme pages; plain
  English labels; respect reduced motion.
- **Tests with every change:** unit tests next to the code; an end-to-end test for user-visible
  flows.
- **Comments:** short, explain why.

## 6. Testing

```bash
# unit
(cd server && npx jest)
(cd client && npx vitest run)
(cd mobile && npx vitest run)
# lint (must be clean)
(cd server && npm run lint); (cd client && npm run lint); (cd mobile && npm run lint)
# end to end (Docker running; uses separate *_e2e databases)
cd e2e
PW=$(docker inspect oruinwan-postgres --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^POSTGRES_PASSWORD=//p')
E2E_DATABASE_URL="postgres://oruinwan:${PW}@127.0.0.1:15432/oruinwan_e2e" npx playwright test tests/
```

Tips:
- Don't edit `client/` or `mobile/` files while the e2e suite runs (hot reload breaks tests).
- Don't run two suites at once on one machine.
- On macOS use `ControlOrMeta+A` in Playwright, not `Control+A`.
- A narrow browser switches to the phone layout; desktop-layout tests set the `oru_web=1` cookie.

## 7. Shipping a release

The version lives in `mobile/package.json` and is mirrored in desktop and iOS.

1. Make sure `main` is green locally (unit, lint, e2e).
2. Bump the version:
   - `mobile/package.json` and `mobile/package-lock.json` (the top-level `version` fields);
   - `desktop/package.json` and `desktop/package-lock.json`;
   - `mobile/ios/App/App.xcodeproj/project.pbxproj`: `MARKETING_VERSION` (e.g. `3.3.4`) and
     `CURRENT_PROJECT_VERSION` (e.g. `30304`).
3. Add `mobile/release-notes/<version>.md` (plain English, what changed for people).
4. Commit `chore(apps): release <version>` and push to `main`.
5. Wait for **CI** and **Build apps** to pass (about 35 minutes with e2e).
6. Tag and push: `git tag v<version> && git push origin v<version>`. The tag build signs the apps,
   publishes the GitHub Release with `latest.json` and quick-update bundles, and builds the Play
   bundle (`.aab`) as an artifact.
7. Check `https://github.com/thrishankkuntimaddi/Oruinwan/releases/latest/download/latest.json`
   shows the new version.
8. Upload the `.aab` from the tag's Build apps run to Google Play Console (internal → production).

## 8. Deploying the server and website

Production runs on one AWS EC2 instance with Docker Compose. The owner's local deploy kit lives in
`~/.oruinwan/deploy/` (not in the repository).

1. Build the web client from the released commit:
   ```bash
   git archive v<version> | tar -x -C /tmp/oru-build && cd /tmp/oru-build
   yarn install --frozen-lockfile
   VITE_BACKEND_URL=https://api.oruinwan.poelys.com \
   VITE_API_URL=https://api.oruinwan.poelys.com/api \
   VITE_GOOGLE_CLIENT_ID=<public web client id> yarn workspace client build   # → dist/
   (cd mobile && npm ci && VITE_SERVER_URL=https://api.oruinwan.poelys.com VITE_SAME_ORIGIN=1 \
     npx vite build --outDir ../phone-dist) && cp -R phone-dist dist/m
   COPYFILE_DISABLE=1 tar --no-xattrs -czf ~/.oruinwan/deploy/web-dist.tgz dist
   ```
2. `aws login`, then `~/.oruinwan/deploy/deploy.sh`. It backs up the databases, copies the bundle,
   pulls `main`, rebuilds the app image, runs migrations on start, health-checks
   `https://api.oruinwan.poelys.com/api/health`, and rolls back automatically on failure.
3. Verify: open https://oruinwan.poelys.com, sign in, send a message, check the phone site `/m/`.

## 9. Troubleshooting

| Symptom | Look at |
|---|---|
| Messages show "can't decrypt" | Conversation key wrapping for that member (`conversationKeys.service.js`), key epochs; the person may need to unlock with their password. |
| Someone sees a chat they shouldn't, or can't see one they should | `conversationAccess.js` and active membership (`workspace_members.status`). |
| Repeated or missing notifications | `notificationService.js` (viewing, debounce), push credentials in `.env`, device tokens. |
| Calls don't connect | TURN (coturn) reachability and credentials; `huddle:*` socket events. |
| Phone app didn't update | `latest.json` on the release, update signature, `mobile/src/update/`. |
| Deploy failed | `deploy.sh` output; it rolled back. Check the app container logs on the server. |
| e2e flaky locally | Close other suites, don't edit files during the run, restart Docker. |

## 10. Glossary

| Term | Meaning |
|---|---|
| Workspace | A team's space; members have roles owner / admin / member. |
| DM / group DM | 1:1 conversation / up to 10 people without a channel. |
| Notes to self | A DM with yourself (`isSelf`). |
| UMEK | The key that protects a person's private identity key on their devices. |
| Conversation key / epoch | The per-conversation encryption key and its version after membership changes. |
| Quick update | A signed UI bundle the installed apps download without reinstalling. |
| `github` / `play` flavor | Android builds for GitHub Releases (self-updating) and Google Play. |
| To: bar | The New message recipient bar (one person → DM, several → group). |
| Huddle | A live voice/video call in a conversation. |

## 11. Document index

| Doc | What it covers |
|---|---|
| [PRD.md](PRD.md) | Product requirements |
| [HLD.md](HLD.md) | High-level design |
| [LLD.md](LLD.md) | Low-level design: code layout, modules, data, events, tests |
| [CONVERSATIONS.md](CONVERSATIONS.md) | Chat, group and thread rules |
| [PRODUCT_MAP.md](PRODUCT_MAP.md) | How features link together |
| [ARCHITECTURE.md](ARCHITECTURE.md), [SCALING.md](SCALING.md) | Architecture detail and scaling path |
| [UPDATES.md](UPDATES.md) | App updates and signing |
| [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md) | Running locally |
| [FIREBASE_SETUP.md](FIREBASE_SETUP.md) | Push setup |
| [integrations.md](integrations.md), [api/](api/) | Integrations and API reference |
| [TEAM_WALKTHROUGH.md](TEAM_WALKTHROUGH.md) | A week of a team using everything |
