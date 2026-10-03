# Identity on PostgreSQL

Companies, users, workspaces, memberships, departments, teams, role permissions,
E2EE keys and sessions live in PostgreSQL (`db/migrations/0006_identity.sql`).
MongoDB keeps messages, notes, notifications and other document data; those
documents reference users and workspaces by the same 24-hex ids.

## Rules for code that touches identity

- Use the repositories in `src/identity` (`require('<rel>/identity')`):
  `users`, `companies`, `workspaces`, `departments`, `teams`, `rolePermissions`,
  `workspacePermissions`, `identityKeys`, `cryptoState`, `conversationKeys`,
  `deviceSessions`, `loginSessions`. Never `require` the old Mongo models
  (`models/User`, `models/Company`, `models/Workspace`, ...).
- Records come back as plain objects with the familiar camelCase fields and
  `_id` (string). There is no `.save()`: call `repo.update(id, patch)`.
  jsonb fields (`profile`, `preferences`, `settings`, ...) take
  `{ $merge: true, ...fields }` to merge instead of replace.
- Secrets (`passwordHash`, `twoFactorSecret`, `tokens`, `deviceTokens`) are only
  returned with `{ withSecrets: true }`.
- `populate()` of a user, workspace, company, department or team reference on a
  MongoDB document no longer works. Load lean and call
  `hydrate(docs, { sender: USER_MIN, 'members.user': USER_CARD })` from
  `src/identity/hydrate.js`.
- No transaction spans PostgreSQL and MongoDB. Do identity writes in one
  `withTransaction` when they must be atomic; Mongo writes go after and must
  tolerate a retry.
- Queries a feature needs that the repos lack go in `src/identity/queries/<area>.js`.
