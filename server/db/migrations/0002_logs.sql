-- Append-only logs. company_id leads every index (tenant-first), ids from the
-- MongoDB side are stored as text so the two stores can be joined by id until
-- identity moves to PostgreSQL.

CREATE TABLE IF NOT EXISTS audit_log (
    id             bigserial PRIMARY KEY,
    company_id     text,
    user_id        text NOT NULL,
    action         text NOT NULL,
    resource       text,
    resource_id    text,
    details        jsonb,
    description    text,
    ip_address     text,
    user_agent     text,
    endpoint       text,
    method         text,
    status         text NOT NULL DEFAULT 'success',
    error_message  text,
    severity       text NOT NULL DEFAULT 'info',
    category       text NOT NULL DEFAULT 'system',
    created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_company_created ON audit_log (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_user_created    ON audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_action          ON audit_log (company_id, action, created_at DESC);

CREATE TABLE IF NOT EXISTS compliance_log (
    id             bigserial PRIMARY KEY,
    company_id     text NOT NULL,
    actor_id       text NOT NULL,
    actor_email    text,
    actor_role     text,
    action         text NOT NULL,
    category       text NOT NULL,
    severity       text NOT NULL DEFAULT 'info',
    resource_type  text,
    resource_id    text,
    resource_name  text,
    details        jsonb,
    ip_address     text,
    user_agent     text,
    hash           text,
    created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS compliance_log_company_created ON compliance_log (company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS security_event (
    id          bigserial PRIMARY KEY,
    company_id  text NOT NULL,
    actor_id    text,
    event_type  text NOT NULL,
    severity    text NOT NULL DEFAULT 'info',
    outcome     text NOT NULL DEFAULT 'success',
    ip_address  text,
    user_agent  text,
    metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS security_event_company_created ON security_event (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS security_event_company_type    ON security_event (company_id, event_type, created_at DESC);
