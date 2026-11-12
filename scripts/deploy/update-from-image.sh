#!/usr/bin/env bash
# Runs ON the live server. Installs an Oruinwan image built by CI (.github/workflows/deploy.yml):
#
#   bash ~/update-from-image.sh <commit sha> ~/oruinwan-image.tar.gz
#
# 1. backs up Postgres and Mongo        4. points ~/oruniwan at the same commit (compose file, docs)
# 2. keeps the running image to roll back 5. restarts the app and waits for /api/health
# 3. loads the new image                 6. on a failed health check, puts the old image back
#
# The server never builds anything, so the 1 GB machine can't run out of memory mid-deploy.
set -uo pipefail

SHA="${1:?commit sha}"
IMAGE_TGZ="${2:?path to the image archive}"
REPO_DIR="${REPO_DIR:-$HOME/oruniwan}"
PROFILES="--profile mongo --profile app"
STAMP=$(date +%Y%m%d-%H%M%S)
KEEP_ROLLBACK_IMAGES=3
KEEP_BACKUPS_DAYS=14

cd "$REPO_DIR" || { echo "!! $REPO_DIR not found"; exit 1; }

echo "== Backing up databases"
mkdir -p ~/backups
PGU=$(docker exec oruinwan-postgres printenv POSTGRES_USER 2>/dev/null || echo oruinwan)
docker exec oruinwan-postgres pg_dumpall -U "$PGU" | gzip > ~/backups/pg-$STAMP.sql.gz \
  || echo "(postgres dump failed; the daily EBS snapshot still covers you)"
docker exec oruinwan-mongo mongodump --archive --gzip > ~/backups/mongo-$STAMP.archive.gz 2>/dev/null \
  || echo "(mongo dump skipped)"
find ~/backups -name '*.gz' -mtime +"$KEEP_BACKUPS_DAYS" -delete 2>/dev/null || true

echo "== Saving the running version for rollback"
HAD_OLD=0
if docker image inspect oruinwan:local >/dev/null 2>&1; then
  docker tag oruinwan:local "oruinwan:before-$STAMP" && HAD_OLD=1
fi

echo "== Loading the new image"
if ! gunzip -c "$IMAGE_TGZ" | docker load; then
  echo "!! Could not load the image; the old version is still running"; exit 1
fi
docker tag "oruinwan:$SHA" oruinwan:local || { echo "!! Image oruinwan:$SHA missing from the archive"; exit 1; }

echo "== Checking out $SHA"
PREV_SHA=$(git rev-parse HEAD)
git fetch --quiet origin && git reset --quiet --hard "$SHA" || echo "(git checkout failed; keeping $PREV_SHA — the image is what runs)"
git log --oneline -1

rollback() {
  echo "!! $1 — rolling back"
  docker compose $PROFILES logs --tail=80 app || true
  if [ "$HAD_OLD" = 1 ]; then
    docker tag "oruinwan:before-$STAMP" oruinwan:local
    git reset --quiet --hard "$PREV_SHA" || true
    docker compose $PROFILES up -d --no-build app
    echo "Rolled back to the previous image."
  fi
  exit 1
}

echo "== Restarting the app"
docker compose $PROFILES up -d --no-build app || rollback "compose up failed"

echo "== Health check"
for _ in $(seq 1 40); do
  if curl -fsS http://localhost:8080/api/health >/dev/null 2>&1; then
    echo "Healthy: $SHA is live"
    rm -f "$IMAGE_TGZ"
    # Keep a few rollback images; old ones fill the small disk.
    docker images --format '{{.Repository}}:{{.Tag}}' 'oruinwan' \
      | grep -E '^oruinwan:before-' | sort -r | tail -n +$((KEEP_ROLLBACK_IMAGES + 1)) \
      | xargs -r docker rmi >/dev/null 2>&1 || true
    docker images --format '{{.Repository}}:{{.Tag}}' 'oruinwan' \
      | grep -E '^oruinwan:[0-9a-f]{40}$' | xargs -r docker rmi >/dev/null 2>&1 || true
    docker image prune -f >/dev/null 2>&1 || true
    exit 0
  fi
  sleep 5
done
rollback "health check failed"
