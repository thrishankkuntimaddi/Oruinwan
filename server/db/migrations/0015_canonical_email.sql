-- One Gmail mailbox has many spellings: dots and "+tags" are ignored and googlemail.com is
-- gmail.com. Sign-up and Google sign-in compare addresses in this form so the same person
-- never ends up with two accounts. Other addresses are only lower-cased.
CREATE OR REPLACE FUNCTION canonical_email(addr text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
    SELECT CASE
        WHEN lower(trim(addr)) ~ '@(gmail|googlemail)\.com$'
            THEN replace(split_part(split_part(lower(trim(addr)), '@', 1), '+', 1), '.', '') || '@gmail.com'
        ELSE lower(trim(addr))
    END
$$;

CREATE INDEX IF NOT EXISTS users_canonical_email ON users (canonical_email(email));
