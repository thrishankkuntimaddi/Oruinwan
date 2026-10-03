-- Transactional outbox for the event bus (src/shared/events). A producer
-- inserts here; the relay job copies rows to the Redis Stream and marks them
-- published. Rows older than OUTBOX_RETENTION_DAYS are pruned by the relay.
CREATE TABLE IF NOT EXISTS event_outbox (
    id            bigserial PRIMARY KEY,
    event_id      uuid NOT NULL DEFAULT gen_random_uuid(),
    name          text NOT NULL,                 -- catalogue name, e.g. message.sent
    company_id    text,
    workspace_id  text,
    actor_id      text,
    payload       jsonb NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    published_at  timestamptz
);
CREATE INDEX IF NOT EXISTS event_outbox_unpublished ON event_outbox (id) WHERE published_at IS NULL;
CREATE INDEX IF NOT EXISTS event_outbox_created ON event_outbox (created_at);
