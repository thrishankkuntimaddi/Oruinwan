# Running Oruinwan locally

Everything you need to run the whole stack on your Mac without help: the web app, the API, the AI engine and the database.

| Piece | What it is | Port |
|---|---|---|
| Web app | React + Vite (`client/`) | **3000** |
| API | Express + Socket.IO (`server/`) | **8080** (from `PORT` in `server/.env`) |
| AI engine | Ollama, running Oruinwan's own models (`qwen2.5:3b` for chat, `nomic-embed-text` for search) | **11434** |
| Database | MongoDB (remote, from `MONGO_URI` in `server/.env`, or local) | 27017 if local |
| PostgreSQL + pgvector | Identity, tasks, logs, AI embeddings, event outbox (Docker) | **5432** |
| Redis | Presence, live huddles, job locks, socket fan-out, event stream (Docker) | **6379** |
| Object storage (RustFS, S3 API) | Uploaded files (Docker); console on 9001 | **9000** |

The web app proxies `/api` and `/uploads` to the API, so you only ever open **http://localhost:3000**.

---

## 1. One-time setup

```bash
# Tools (Homebrew)
brew install node@22 ollama            # Node 22+ is required (24 also works)
brew tap mongodb/brew && brew install mongodb-community@7.0   # only if you want a local database
brew install colima docker docker-compose && colima start       # container runtime for postgres, redis, s3

# Project dependencies (from the repo root)
npm run install-all                    # root + client + server

# Environment files
cp server/.env.example server/.env     # then fill in the values (see "Environment" below)
cp client/.env.example client/.env     # defaults already point at :8080

# AI models (about 2.2 GB, once)
ollama serve &                          # or let `npm run dev:services` start it
ollama pull qwen2.5:3b
ollama pull nomic-embed-text
```

---

## 2. Every day: start everything

### The one-command way

```bash
npm run dev:all
```

This runs `scripts/dev-services.sh` (starts MongoDB if your `MONGO_URI` is local, starts Ollama, pulls any missing model and warms both models), then `npm run dev`, which starts the API and the web app together in one terminal (blue = server, magenta = client). Stop everything with **Ctrl+C**. Ollama keeps running in the background; see "Stopping".

### The three-terminal way (clearer logs)

```bash
# Terminal 1 — AI engine + database
npm run dev:services

# Terminal 2 — API on :8080 (auto-restarts on file changes via nodemon)
npm run server              # = cd server && npm run dev

# Terminal 3 — web app on :3000 (hot reload)
npm run client              # = cd client && npm start
```

Then open http://localhost:3000.

### Check what is running

```bash
npm run dev:status
```

Example output:

```
Oruinwan local stack
  MongoDB :27017         running
  Ollama :11434          running — loaded: qwen2.5:3b nomic-embed-text:latest
  Backend :8080          "status":"healthy" "mongodb":"connected"
  Web :3000              running (http://localhost:3000)
```

The API health endpoint is `GET http://localhost:8080/api/health`.

---

## 3. Stopping

| What | How |
|---|---|
| API + web (`npm run dev` / `dev:all`) | Ctrl+C in that terminal |
| API or web alone | Ctrl+C in its terminal |
| Ollama started by the script | `kill $(cat ~/.oruinwan/logs/ollama.pid)` |
| Unload AI models to free memory, keep Ollama running | `ollama stop qwen2.5:3b; ollama stop nomic-embed-text` |
| Local MongoDB | `brew services stop mongodb-community@7.0` |

Do not use `pkill -f server.js`. It also matches other Node processes, such as a second test server.

---

## 4. Environment (`server/.env`)

These keys matter locally. `server/.env.example` documents all of them.

| Key | Local value / note |
|---|---|
| `PORT` | `8080` |
| `MONGO_URI` | Your Atlas URI, or `mongodb://127.0.0.1:27017/oruinwan` for a local database |
| `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET` | Any long random strings (`openssl rand -hex 32`) |
| `FRONTEND_URL` / `BACKEND_URL` | `http://localhost:3000` / `http://localhost:8080` |
| `SERVER_KEK` | 64 hex chars (`openssl rand -hex 32`); protects stored secrets and 2FA keys |
| `CRYPTO_KEK_V1` | **Exactly 64 hex characters (32 bytes)**. A longer value makes encryption unlock fail with "Failed to unwrap UMEK" / "Invalid KEK V1 length" |
| `AI_PROVIDER` | `local_llm` (Oruinwan's own engine) |
| `LOCAL_LLM_BASE_URL` | `http://localhost:11434/v1` |
| `LOCAL_LLM_MODEL` / `LOCAL_EMBED_MODEL` | `qwen2.5:3b` / `nomic-embed-text` |
| `FEATURES_ENABLED` | Comma-separated release flags, e.g. `integrations` to show GitHub/Jira/Zoom (see `docs/integrations.md`) |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | Object storage for uploads; defaults match the `s3` service in `docker-compose.yml`. Without them uploads go to local disk (`LOCAL_UPLOAD_DIR`). `STORAGE_DRIVER=s3|local` forces a driver |
| Email (`BREVO_API_KEY` / `SMTP_*`) | Needed for sign-up verification, password reset and reactivation codes. Without it, sending fails with "Email not configured" in the API log |

After changing `server/.env`, restart the API (in its terminal, type `rs` + Enter, or Ctrl+C and start it again). After changing `client/.env`, restart the web app.

---

## 5. The AI engine in practice

- The first answer after starting takes a few seconds while the model loads; `dev:services` warms it for you. On an 8 GB M1, expect about 10 tokens/s.
- Models stay in memory for 30 minutes after last use (`OLLAMA_KEEP_ALIVE=30m`).
- To check it directly:
  `curl http://localhost:11434/api/ps`
  `curl http://localhost:11434/v1/models`
- If AI answers fail with "engine unavailable", Ollama isn't running. Run `npm run dev:services`.
- **Later, cloud GPU:** run Ollama or vLLM on a GPU server and point `LOCAL_LLM_BASE_URL` at it. Nothing else changes.

---

## 6. Tests

```bash
npm test                      # server (jest) + client (vitest)
cd server && npx jest         # server only
cd client && npx vitest run   # client only
npm run lint                  # eslint everywhere
npm run test:e2e              # Playwright browser tests (see below)
```

**End-to-end tests** use their own servers and a throwaway local database, so they never touch your data.

- They start the API on **8095** and the web app on **3095**, using database `chttrix_e2e` on your local MongoDB. That database is dropped on every run.
- They need MongoDB running locally on 27017: `brew services start mongodb-community@7.0`.
- On an 8 GB Mac, unload the AI models first (`ollama stop qwen2.5:3b`). Otherwise memory pressure makes timing-sensitive tests flaky.
- Report: `cd e2e && npm run report`.

---

## 7. Useful extras

| Task | Command |
|---|---|
| Production build of the web app | `npm run build` (output in `dist/`) |
| Preview the production build | `cd client && npx vite preview` |
| Desktop app (Electron, loads :3000) | `cd desktop && npm install && npm start` |
| Phone app (Capacitor) | `cd mobile && npm install && npm run dev` serves the phone UI in a browser; `npm run android:debug` builds the Android app (see `mobile/README.md`) |
| GitHub/Jira webhooks reaching your laptop | `ngrok http 8080` or `cloudflared tunnel --url http://localhost:8080`, then use the https URL as the webhook host (details in `docs/integrations.md`) |

---

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| `EADDRINUSE :8080` / `:3000` | Something is already on that port: `lsof -iTCP:8080 -sTCP:LISTEN`, then stop that process (by its PID) or change `PORT` |
| Blank page or old UI after pulling | Hard-refresh (Cmd+Shift+R). In development the service worker is disabled, so old caches clear on reload |
| "Unlock encryption" prompt after login | Expected on a new browser or device: enter your account password to unlock your message keys |
| "Failed to unwrap UMEK" in the console | `CRYPTO_KEK_V1` in `server/.env` is not exactly 64 hex characters |
| API can't connect to MongoDB | Atlas: check that your IP is on the Atlas allow-list and the URI is correct. Local: `brew services start mongodb-community@7.0` |
| AI replies never come / "engine unavailable" | `npm run dev:status`, then `npm run dev:services` |
| AI is slow the first time | The model is loading. It's fast once warm, and stays loaded for 30 minutes |
| Emails (verification, OTP) don't arrive | Configure `BREVO_API_KEY` or `SMTP_*` in `server/.env`. The API log shows why sending failed, e.g. Brevo's "Authorised IPs" block |
| Integrations don't show in Settings | Add `integrations` to `FEATURES_ENABLED` and restart the API |

---

## Infrastructure (Docker)

```bash
docker compose up -d          # from the repo root: postgres+pgvector :5432, redis :6379, s3 :9000 (console :9001)
docker compose ps
node server/scripts/migrate.js --status
```

The server applies PostgreSQL migrations and creates the upload bucket on boot.

## Running two API instances (multi-instance check)

With Redis running and `REDIS_URL` set, the same server can run several times on different ports and behave as one:

```bash
cd server
PORT=8080 node server.js &    # instance 1
PORT=8081 node server.js &    # instance 2
curl -s localhost:8080/api/health | jq '{redis, instance, jobs}'
curl -s localhost:8081/api/health | jq '{redis, instance, jobs}'
redis-cli keys 'job:*'        # each lock names the one instance that ran that job this interval
```

A user connected to 8080 is online for people on 8081, a huddle started on one instance can be joined from the other, and reminders fire once, not twice. Details and the production stages are in `SCALING.md`.
