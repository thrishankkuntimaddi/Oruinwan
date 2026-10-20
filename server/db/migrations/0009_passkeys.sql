-- Passkeys (WebAuthn credentials) a person can sign in with instead of a password.
-- Only the public key is stored; the private key never leaves the person's device
-- or password manager. credential_id is the authenticator's id (base64url) and is
-- what a sign-in names, so it is unique across all users.
CREATE TABLE IF NOT EXISTS user_passkeys (
    id             text PRIMARY KEY,
    user_id        text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id  text NOT NULL UNIQUE,
    public_key     bytea NOT NULL,                       -- COSE public key
    counter        bigint NOT NULL DEFAULT 0,            -- signature counter (0 for most synced passkeys)
    transports     text[] NOT NULL DEFAULT '{}',         -- internal | hybrid | usb | nfc | ble ...
    name           text NOT NULL,
    backed_up      boolean NOT NULL DEFAULT false,       -- synced to a password manager / cloud keychain
    created_at     timestamptz NOT NULL DEFAULT now(),
    last_used_at   timestamptz
);
CREATE INDEX IF NOT EXISTS user_passkeys_user ON user_passkeys (user_id, created_at);
