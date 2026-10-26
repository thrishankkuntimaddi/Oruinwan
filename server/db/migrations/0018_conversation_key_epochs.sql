-- Earlier keys of a conversation ("epochs"). A conversation gets a new key when a group adds
-- people who must not read what came before, or when someone is removed from a group or a private
-- channel; the previous key moves here with its own copies, so only people allowed to read that
-- period hold one. conversation_keys keeps the current key; messages record the version they were
-- encrypted with (MongoDB messages.payload.keyVersion; missing = 1).
-- Additive only: existing keys and their copies are not touched.
CREATE TABLE IF NOT EXISTS conversation_key_epochs (
    conversation_key_id      text NOT NULL REFERENCES conversation_keys(id) ON DELETE CASCADE,
    version                  integer NOT NULL,
    workspace_encrypted_key  jsonb,                 -- the server copy of that key, when there was one
    created_at               timestamptz,
    retired_at               timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (conversation_key_id, version)
);

CREATE TABLE IF NOT EXISTS conversation_key_epoch_members (
    conversation_key_id   text NOT NULL,
    version               integer NOT NULL,
    user_id               text NOT NULL,
    encrypted_key         text NOT NULL,
    ephemeral_public_key  text,
    algorithm             text NOT NULL,
    added_at              timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (conversation_key_id, version, user_id),
    FOREIGN KEY (conversation_key_id, version) REFERENCES conversation_key_epochs (conversation_key_id, version) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS conversation_key_epoch_members_user ON conversation_key_epoch_members (user_id);
