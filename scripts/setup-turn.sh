#!/usr/bin/env bash
# Sets up the call relay (coturn, docker-compose service "turn") on the server and points the
# app at it. Run on the server from the checkout: bash scripts/setup-turn.sh [turn-host]
#   turn-host: the name people's apps reach the relay at (default: oruinwan.poelys.com)
# Safe to run again: it keeps an existing secret.
#
# The cloud firewall must also allow 3478 UDP+TCP and UDP 49160-49200 to this machine
# (AWS: the instance's security group).
set -euo pipefail
cd "$(dirname "$0")/.."
HOST="${1:-oruinwan.poelys.com}"

# key=value in a .env file: replace the line, or add it.
set_env() {
  local file="$1" key="$2" value="$3"
  touch "$file"
  if grep -q "^${key}=" "$file"; then
    sed -i.bak "s#^${key}=.*#${key}=${value}#" "$file" && rm -f "$file.bak"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

echo "== Addresses"
TOKEN=$(curl -fsS -m 3 -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' || true)
meta() { curl -fsS -m 3 ${TOKEN:+-H "X-aws-ec2-metadata-token: $TOKEN"} "http://169.254.169.254/latest/meta-data/$1" || true; }
PUBLIC_IP=$(meta public-ipv4)
PRIVATE_IP=$(meta local-ipv4)
[ -n "$PUBLIC_IP" ] || PUBLIC_IP=$(curl -fsS -m 5 https://checkip.amazonaws.com | tr -d '[:space:]')
[ -n "$PRIVATE_IP" ] || PRIVATE_IP=$(hostname -I | awk '{print $1}')
EXTERNAL="$PUBLIC_IP"
[ -n "$PRIVATE_IP" ] && [ "$PRIVATE_IP" != "$PUBLIC_IP" ] && EXTERNAL="$PUBLIC_IP/$PRIVATE_IP"
echo "public $PUBLIC_IP, private ${PRIVATE_IP:-none}"

echo "== Settings"
SECRET=$(grep -h '^TURN_SECRET=' .env server/.env 2>/dev/null | head -1 | cut -d= -f2- || true)
[ -n "$SECRET" ] || SECRET=$(openssl rand -hex 32)
set_env .env TURN_SECRET "$SECRET"
set_env .env TURN_EXTERNAL_IP "$EXTERNAL"
set_env server/.env TURN_SECRET "$SECRET"
set_env server/.env TURN_URLS "turn:${HOST}:3478?transport=udp,turn:${HOST}:3478?transport=tcp"
echo "TURN_URLS=turn:${HOST}:3478 (udp, tcp)"

echo "== Starting the relay"
docker compose --profile turn up -d turn
sleep 3
docker logs --tail 15 oruinwan-turn 2>&1 | sed 's/^/   /'

echo "== Restarting the app with the relay settings"
docker compose --profile mongo --profile app up -d --no-build app
for i in $(seq 1 40); do
  if curl -fsS http://localhost:8080/api/health >/dev/null 2>&1; then echo "Healthy: calls now use the relay when needed"; exit 0; fi
  sleep 5
done
echo "!! The app did not report healthy in time: check docker logs oruinwan-app"
exit 1
