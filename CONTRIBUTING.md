# Contributing to Oruinwan

Thanks for helping. Oruinwan is one workspace for a team's conversations, calls, tasks, notes and
AI, MIT-licensed and self-hostable. Bug reports, fixes, docs and features are all welcome.

## Where to start

- **Read [docs/ONBOARDING.md](docs/ONBOARDING.md) first.** It is the knowledge-transfer kit: how the
  server, web, phone and desktop apps fit together and where each feature lives.
- Issues labelled **good first issue** are small and self-contained. **help wanted** marks larger
  pieces nobody is working on.
- For anything bigger than a bug fix, open an issue (or comment on one) before you start, so we can
  agree on the approach and you don't build something that conflicts with work in progress.

## Set up

Follow [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md). In short: Node.js 22+, Yarn 1, Docker.

```bash
yarn install
cp server/.env.example server/.env && cp client/.env.example client/.env
docker compose up -d
yarn build && yarn dev:all
```

## Make a change

1. Fork the repository and branch from `main`, for example `fix/thread-unread-count`.
2. Keep the change focused: one fix or feature per pull request.
3. Add or update tests next to the code (`__tests__/` folders). Run what you touched:

   | Area | Command |
   |---|---|
   | Server | `cd server && npx jest` |
   | Web | `cd client && npx vitest run` |
   | Phone / tablet | `cd mobile && npm test` |
   | Desktop | `cd desktop && npm test` |
   | Everything, end to end | `yarn test:e2e` (needs PostgreSQL and MongoDB running) |
   | Lint | `yarn lint` |

4. Commit in the [Conventional Commits](https://www.conventionalcommits.org) style:
   `feat(tasks): add recurring tasks`, `fix(phone): keep the composer above the keyboard`.
5. Open a pull request. The template asks what changed, why, and how you tested it. CI runs lint,
   unit tests, builds and the end-to-end suite.

## Rules that keep the product coherent

- **Every platform.** A feature people use daily must work on web, desktop and phone (see the
  platform rules in [docs/PRD.md](docs/PRD.md)). If you only build one side, say so in the PR.
- **Encryption wording.** Message text is encrypted on the device, and the server keeps an escrowed
  copy of each conversation key. Copy must say "encrypted on the device", never "end-to-end" or
  "zero-knowledge". `client/src/__tests__/encryptionWording.test.js` enforces this.
- **No tracking of people.** No per-person activity metrics, no message counts for admins, no
  "who talks to whom" analytics. Features that need them will not be merged.
- **Limits live in one place.** Plan limits come from `server/src/shared/plans/plans.js`; never
  hard-code a number elsewhere.
- **Server layout.** Code goes in a feature module under `server/src/features/<area>` or
  `server/src/modules/<area>`. PostgreSQL changes go in a new numbered migration; never edit an
  old one.
- **UI.** Keep the existing theme (`client/src/styles/gloss.css`) and make sure screens work in both
  light and dark.
- **Plain language.** Copy people read is short and concrete: say what happens, not what the
  system is.

## Integrations

Connectors live in `server/src/features/integrations/connectors`. Unit tests mock HTTP. Before
opening a PR that changes a connector, run the live probe. It needs no accounts and proves the
endpoint and auth format against the real API:

```bash
cd server && yarn integrations:check --probe
```

## Reporting bugs and security issues

- Bugs: open an issue with the **Bug report** template (version, platform, steps).
- Security vulnerabilities: **do not open a public issue.** See [SECURITY.md](SECURITY.md).

## Licence

By contributing you agree that your contribution is licensed under the [MIT licence](LICENSE).
