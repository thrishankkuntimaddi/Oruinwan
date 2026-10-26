-- A task made from a note or a library file keeps its source ("Make a task";
-- server/src/features/tasks/tasks.linked.js). Both are MongoDB ids.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS linked_note_id text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS linked_file_id text;
CREATE INDEX IF NOT EXISTS tasks_linked_note_idx ON tasks (linked_note_id) WHERE linked_note_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tasks_linked_file_idx ON tasks (linked_file_id) WHERE linked_file_id IS NOT NULL;
