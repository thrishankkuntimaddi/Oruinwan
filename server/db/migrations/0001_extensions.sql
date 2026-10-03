-- Extensions used across the schema. pgvector ships in the pgvector/pgvector image.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
