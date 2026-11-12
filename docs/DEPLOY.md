# Deploying the hosted server

The live server is updated by GitHub Actions (`.github/workflows/deploy.yml`) every time
**CI passes on `main`** (server tests, client tests and build, and the whole Playwright suite).

```
push to main → CI (lint, unit, e2e) ──passes──▶ Deploy server
                                                 1. build the Docker image on the runner
                                                 2. check it has the web app and phone web app
                                                 3. open SSH to this runner only (security group)
                                                 4. copy the image, run scripts/deploy/update-from-image.sh:
                                                    back up Postgres + Mongo → keep the running image →
                                                    load the new one → restart → /api/health for 200 s →
                                                    roll back to the old image if it never gets healthy
                                                 5. close SSH again (always, even on failure)
                                                 6. check https://api…/api/health from outside
```

The server never builds anything (a 1 GB machine runs out of memory building the web app), and
GitHub holds no AWS keys: it signs in with a short-lived OIDC token to a role that can only push a
60-second SSH key to that one instance and open or close port 22 on its security group.

Desktop and Android apps are not affected: they still update through releases (`docs/UPDATES.md`).

## One-time setup

You need the AWS CLI signed in to the account that owns the server, and `gh` signed in to GitHub.

```bash
bash scripts/deploy/setup-ci-deploy.sh <instance-id> <security-group-id> <server-ip> [region]
gh variable set VITE_GOOGLE_CLIENT_ID --body <web Google client id>   # same as the server's .env
gh workflow run deploy.yml          # one deploy by hand; watch it in the Actions tab
gh variable set AUTO_DEPLOY --body true                                # then turn it on
```

Optional: in **Settings → Environments → production**, add yourself as a required reviewer to approve
each deploy with one click.

## Day to day

| I want to… | Do this |
|---|---|
| Ship a change | Push to `main`. It is live a few minutes after CI goes green. |
| Redeploy, or go back to an older commit | Actions → *Deploy server* → *Run workflow*, with the commit SHA (empty = latest main). |
| Stop automatic deploys | `gh variable set AUTO_DEPLOY --body false` |
| See what is live | `curl https://api.oruinwan.poelys.com/api/health` and the run summary in Actions |

A failed health check rolls the server back by itself and fails the run, so GitHub emails you.
Backups from each deploy are in `~/backups` on the server (14 days kept), next to the daily EBS snapshots.

## Manual fallback

`~/.oruinwan/deploy/deploy.sh` on the owner's Mac still works (it builds the image on the server).
