-- Oruinwan AI knowledge index: one row per chunk of a note, task or knowledge
-- page. Vector dimension matches the embedding model (nomic-embed-text = 768);
-- changing models means a new column size, handled by a later migration.
CREATE TABLE IF NOT EXISTS ai_embeddings (
    id                 bigserial PRIMARY KEY,
    workspace_id       text NOT NULL,
    kind               text NOT NULL,          -- note | task | knowledge
    ref_id             text NOT NULL,          -- source document id
    chunk              integer NOT NULL DEFAULT 0,
    title              text NOT NULL DEFAULT '',
    text               text NOT NULL,
    embedding          vector(768) NOT NULL,
    model              text NOT NULL,
    source_updated_at  timestamptz NOT NULL,
    created_at         timestamptz NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, kind, ref_id, chunk)
);
CREATE INDEX IF NOT EXISTS ai_embeddings_workspace_ref ON ai_embeddings (workspace_id, kind, ref_id);
-- HNSW on cosine distance; the query filters by workspace first, so the index stays small per tenant.
CREATE INDEX IF NOT EXISTS ai_embeddings_hnsw ON ai_embeddings USING hnsw (embedding vector_cosine_ops);
