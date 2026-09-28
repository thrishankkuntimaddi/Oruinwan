#!/usr/bin/env bash
# One-screen health check of the local Oruinwan stack.
# Usage: bash scripts/dev-status.sh        (or: npm run dev:status)

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="$(grep -E '^PORT=' "$ROOT/server/.env" 2>/dev/null | tail -1 | cut -d= -f2)"; PORT="${PORT:-8080}"
row() { printf '  %-22s %s\n' "$1" "$2"; }
up()  { lsof -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

echo "Oruinwan local stack"
up 27017 && row "MongoDB :27017" "running" || row "MongoDB :27017" "not running locally (fine if MONGO_URI is remote)"
if up 11434; then
  loaded="$(curl -s http://localhost:11434/api/ps | grep -o '"name":"[^"]*"' | cut -d'"' -f4 | tr '\n' ' ')"
  row "Ollama :11434" "running — loaded: ${loaded:-none (loads on first use)}"
else row "Ollama :11434" "NOT running → npm run dev:services"; fi
health="$(curl -s -m 3 "http://localhost:$PORT/api/health")"
if [ -n "$health" ]; then row "Backend :$PORT" "$(echo "$health" | grep -o '"status":"[^"]*"\|"mongodb":"[^"]*"' | tr '\n' ' ')"
else row "Backend :$PORT" "NOT running → npm run server"; fi
code="$(curl -s -o /dev/null -w '%{http_code}' -m 3 http://localhost:3000)"
[ "$code" = "200" ] && row "Web :3000" "running (http://localhost:3000)" || row "Web :3000" "NOT running → npm run client"
