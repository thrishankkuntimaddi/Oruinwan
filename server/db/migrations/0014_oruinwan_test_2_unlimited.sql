-- The owner's second test workspace "Oruinwan-test-2" has no limits, like "LVN Development"
-- (0012): plan 'enterprise' makes a workspace unlimited for everyone in it (members, channels,
-- DMs, tasks, notes, AI, calls up to the higher call cap). Matches the name loosely; does
-- nothing if it doesn't exist. LVN Development is matched the same loose way too, in case its
-- name or creator didn't match 0012 exactly.
UPDATE workspaces
   SET plan = 'enterprise'
 WHERE regexp_replace(lower(trim(name)), '[^a-z0-9]', '', 'g') IN ('oruinwantest2', 'lvndevelopment');
