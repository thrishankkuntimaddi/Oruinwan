#!/usr/bin/env bash
# Start the background services Oruinwan needs for local development:
#   • MongoDB   (only when server/.env points at a local database)
#   • Ollama    (Oruinwan AI engine) + the chat and embedding models
# Safe to run repeatedly: anything already running is left alone.
# Usage: bash scripts/dev-services.sh        (or: npm run dev:services)

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${HOME}/.oruinwan/logs"
mkdir -p "$LOG_DIR"

ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$*"; }
listening() { lsof -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

# Read one key from server/.env without printing secrets.
env_value() { grep -E "^$1=" "$ROOT/server/.env" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"'"'"; }

echo "Oruinwan local services"

# ── Node ──────────────────────────────────────────────────────────────────
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$NODE_MAJOR" -ge 20 ]; then ok "Node $(node -v)"; else fail "Node 20+ is required (found $(node -v 2>/dev/null || echo none))"; fi

# ── MongoDB ───────────────────────────────────────────────────────────────
if [ ! -f "$ROOT/server/.env" ]; then
  fail "server/.env is missing — copy server/.env.example to server/.env and fill it in"
else
  MONGO_URI="$(env_value MONGO_URI)"
  case "$MONGO_URI" in
    *localhost*|*127.0.0.1*)
      if listening 27017; then ok "MongoDB is running on :27017"
      elif command -v brew >/dev/null 2>&1; then
        brew services start mongodb-community@7.0 >/dev/null 2>&1 || brew services start mongodb-community >/dev/null 2>&1
        for _ in $(seq 1 20); do listening 27017 && break; sleep 1; done
        if listening 27017; then ok "MongoDB started (brew services)"; else fail "MongoDB did not start — try: brew services start mongodb-community@7.0"; fi
      else fail "MongoDB is not running on :27017 and Homebrew was not found"; fi ;;
    "") warn "MONGO_URI is empty in server/.env" ;;
    *) ok "MongoDB: remote database from server/.env (nothing to start locally)" ;;
  esac
fi

# ── Ollama (Oruinwan AI engine) ─────────────────────────────────────────
CHAT_MODEL="$(env_value LOCAL_LLM_MODEL)"; CHAT_MODEL="${CHAT_MODEL:-qwen2.5:3b}"
EMBED_MODEL="$(env_value LOCAL_EMBED_MODEL)"; EMBED_MODEL="${EMBED_MODEL:-nomic-embed-text}"
if ! command -v ollama >/dev/null 2>&1; then
  fail "Ollama is not installed — brew install ollama (AI features stay off until it runs)"
else
  if listening 11434; then ok "Ollama is running on :11434"
  else
    OLLAMA_FLASH_ATTENTION=1 OLLAMA_KV_CACHE_TYPE=q8_0 OLLAMA_KEEP_ALIVE=30m OLLAMA_CONTEXT_LENGTH=8192 \
      nohup ollama serve >"$LOG_DIR/ollama.log" 2>&1 &
    echo $! > "$LOG_DIR/ollama.pid"
    for _ in $(seq 1 20); do listening 11434 && break; sleep 1; done
    if listening 11434; then ok "Ollama started (pid $(cat "$LOG_DIR/ollama.pid"), log $LOG_DIR/ollama.log)"; else fail "Ollama did not start — see $LOG_DIR/ollama.log"; fi
  fi
  if listening 11434; then
    for m in "$CHAT_MODEL" "$EMBED_MODEL"; do
      if ollama list 2>/dev/null | awk 'NR>1{print $1}' | grep -qx "$m\(:latest\)\?"; then ok "Model $m is installed"
      else warn "Pulling model $m (first time only)…"; ollama pull "$m" && ok "Model $m installed"; fi
    done
    # Warm both models so the first answer in the app is fast (runs in the background).
    ( curl -s http://localhost:11434/api/generate -d "{\"model\":\"$CHAT_MODEL\",\"prompt\":\"hi\",\"stream\":false,\"options\":{\"num_predict\":1}}" >/dev/null 2>&1
      curl -s http://localhost:11434/api/embeddings -d "{\"model\":\"$EMBED_MODEL\",\"prompt\":\"hi\"}" >/dev/null 2>&1 ) &
    ok "Warming $CHAT_MODEL and $EMBED_MODEL in the background"
  fi
fi

echo
echo "Next: npm run dev   (backend :$(env_value PORT | grep . || echo 8080), web :3000)"
