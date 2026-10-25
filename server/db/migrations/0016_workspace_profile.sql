-- A workspace's public profile beyond its icon and colour: logo and cover images, a tagline,
-- website and location (server/src/features/workspaces/workspaceProfile.js).
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS profile jsonb NOT NULL DEFAULT '{}'::jsonb;
