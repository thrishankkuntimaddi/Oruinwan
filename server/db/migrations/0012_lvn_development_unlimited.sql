-- The owner's test workspace "LVN Development" (created by kuntimaddithrishank@gmail.com) has no
-- limits: plan 'enterprise' makes a workspace unlimited for every member (planService
-- isUnlimitedWorkspace). Matches the name case-insensitively; does nothing if it doesn't exist.
UPDATE workspaces w
   SET plan = 'enterprise'
  FROM users u
 WHERE u.id = w.created_by
   AND 'kuntimaddithrishank@gmail.com' IN (lower(u.email), lower(coalesce(u.personal_email, '')))
   AND lower(trim(w.name)) IN ('lvn development', 'lvn-development', 'lvndevelopment');
