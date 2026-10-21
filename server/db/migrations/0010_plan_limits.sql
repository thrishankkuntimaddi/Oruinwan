-- Plans (src/shared/plans/plans.js). Every individual account and its workspaces
-- start on 'free'; company accounts and company workspaces are never limited by
-- the free plan whatever this column says. 'pro' and 'enterprise' are coming soon.
ALTER TABLE users      ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';
-- Seats and pending invites per workspace are counted on every invite / join.
CREATE INDEX IF NOT EXISTS invites_workspace_status ON invites (workspace_id, status);
