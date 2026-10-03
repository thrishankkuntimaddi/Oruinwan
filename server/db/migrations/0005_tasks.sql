-- Tasks, projects, sprints and milestones (Phase B step 5, TASKS_STORE=pg).
-- Ids are text: the app generates Mongo-style 24-hex ids so references to users,
-- workspaces, channels and messages (still in MongoDB) keep working unchanged.
-- company_id / workspace_id lead every index (tenant-first).

CREATE TABLE IF NOT EXISTS projects (
    id            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    company_id    text NOT NULL,
    workspace_id  text NOT NULL,
    name          text NOT NULL,
    description   text NOT NULL DEFAULT '',
    status        text NOT NULL DEFAULT 'planning',
    owner_id      text NOT NULL,
    start_date    timestamptz,
    end_date      timestamptz,
    members       jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{ user, role, joinedAt }]
    is_archived   boolean NOT NULL DEFAULT false,
    archived_at   timestamptz,
    archived_by   text,
    deleted       boolean NOT NULL DEFAULT false,
    deleted_at    timestamptz,
    deleted_by    text,
    metadata      jsonb,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS projects_workspace_status ON projects (workspace_id, status);
CREATE INDEX IF NOT EXISTS projects_company_status   ON projects (company_id, status);
CREATE INDEX IF NOT EXISTS projects_workspace_arch   ON projects (workspace_id, is_archived);
CREATE INDEX IF NOT EXISTS projects_owner            ON projects (owner_id);

CREATE TABLE IF NOT EXISTS sprints (
    id             text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    company_id     text,
    workspace_id   text NOT NULL,
    name           text NOT NULL,
    goal           text NOT NULL DEFAULT '',
    start_date     timestamptz NOT NULL,
    end_date       timestamptz NOT NULL,
    status         text NOT NULL DEFAULT 'planning',
    board_columns  jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{ name, order, color }]
    created_by     text NOT NULL,
    deleted        boolean NOT NULL DEFAULT false,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sprints_workspace_status ON sprints (workspace_id, status);
CREATE INDEX IF NOT EXISTS sprints_workspace_start  ON sprints (workspace_id, start_date);

CREATE TABLE IF NOT EXISTS milestones (
    id            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    company_id    text,
    workspace_id  text NOT NULL,
    name          text NOT NULL,
    description   text NOT NULL DEFAULT '',
    due_date      timestamptz,
    start_date    timestamptz,
    end_date      timestamptz,
    status        text NOT NULL DEFAULT 'not_started',
    created_by    text NOT NULL,
    deleted       boolean NOT NULL DEFAULT false,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS milestones_workspace_status ON milestones (workspace_id, status);
CREATE INDEX IF NOT EXISTS milestones_workspace_due    ON milestones (workspace_id, due_date);

CREATE TABLE IF NOT EXISTS tasks (
    id                    text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    company_id            text,
    workspace_id          text,
    project_id            text,
    issue_key             text,
    type                  text NOT NULL DEFAULT 'task',       -- task | subtask | bug | epic
    task_type             text NOT NULL DEFAULT 'workspace',  -- personal | workspace | channel | project
    parent_task_id        text,
    epic_id               text,
    title                 text NOT NULL,
    description           text NOT NULL DEFAULT '',
    created_by            text NOT NULL,
    visibility            text NOT NULL DEFAULT 'private',    -- private | channel | workspace
    channel_id            text,
    status                text NOT NULL DEFAULT 'backlog',
    previous_status       text,
    blocked_reason        text,
    blocked_by            text,
    blocked_at            timestamptz,
    due_date              timestamptz,
    due_soon_notified_at  timestamptz,
    start_date            timestamptz,
    priority              text NOT NULL DEFAULT 'medium',
    story_points          numeric,
    estimated_hours       numeric,
    actual_hours          numeric,
    completed_at          timestamptz,
    completed_by          text,
    completion_note       text NOT NULL DEFAULT '',
    resolution            text NOT NULL DEFAULT '',
    source                text NOT NULL DEFAULT 'manual',
    ai_context            jsonb,
    linked_message_id     text,
    linked_dm_id          text,
    tags                  text[] NOT NULL DEFAULT '{}',
    labels                text[] NOT NULL DEFAULT '{}',
    external_links        jsonb NOT NULL DEFAULT '[]'::jsonb,
    attachments           jsonb NOT NULL DEFAULT '[]'::jsonb,
    transfer_request      jsonb,
    deleted               boolean NOT NULL DEFAULT false,
    deleted_for           text[] NOT NULL DEFAULT '{}',
    deleted_by            text,
    deleted_at            timestamptz,
    revoked_at            timestamptz,
    revoked_by            text,
    time_tracking         jsonb NOT NULL DEFAULT '{"totalTime":0,"sessions":[]}'::jsonb,
    recurring             jsonb NOT NULL DEFAULT '{"isRecurring":false,"pattern":null,"interval":1,"nextDue":null}'::jsonb,
    recurring_next_due    timestamptz,   -- copy of recurring.nextDue for the cron's index (null unless isRecurring)
    automation_rules      jsonb NOT NULL DEFAULT '[]'::jsonb,
    sprint_id             text,
    milestone_id          text,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tasks_workspace_status_deleted ON tasks (workspace_id, status, deleted);
CREATE INDEX IF NOT EXISTS tasks_workspace_vis_status     ON tasks (workspace_id, visibility, status);
CREATE INDEX IF NOT EXISTS tasks_workspace_created        ON tasks (workspace_id, created_at DESC, status);
CREATE INDEX IF NOT EXISTS tasks_company_workspace_status ON tasks (company_id, workspace_id, status);
CREATE INDEX IF NOT EXISTS tasks_channel_status           ON tasks (channel_id, status);
CREATE INDEX IF NOT EXISTS tasks_created_by               ON tasks (created_by);
CREATE INDEX IF NOT EXISTS tasks_parent                   ON tasks (parent_task_id);
CREATE INDEX IF NOT EXISTS tasks_epic                     ON tasks (epic_id);
CREATE INDEX IF NOT EXISTS tasks_project                  ON tasks (project_id);
CREATE INDEX IF NOT EXISTS tasks_due_status               ON tasks (due_date, status);
CREATE INDEX IF NOT EXISTS tasks_issue_key                ON tasks (workspace_id, issue_key);
CREATE INDEX IF NOT EXISTS tasks_tags_gin                 ON tasks USING gin (tags);
-- Recurring generator: only rows that are due.
CREATE INDEX IF NOT EXISTS tasks_recurring_next_due ON tasks (recurring_next_due) WHERE recurring_next_due IS NOT NULL AND deleted = false;

CREATE TABLE IF NOT EXISTS task_assignees (
    task_id   text NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    user_id   text NOT NULL,
    position  integer NOT NULL DEFAULT 0,   -- keeps the client's assignee order
    PRIMARY KEY (task_id, user_id)
);
CREATE INDEX IF NOT EXISTS task_assignees_user ON task_assignees (user_id, task_id);

CREATE TABLE IF NOT EXISTS task_watchers (
    task_id   text NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    user_id   text NOT NULL,
    PRIMARY KEY (task_id, user_id)
);
CREATE INDEX IF NOT EXISTS task_watchers_user ON task_watchers (user_id, task_id);

-- Mirrors Task.linkedIssues; id is exposed as the link's _id so removeLink works.
CREATE TABLE IF NOT EXISTS task_links (
    id              text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    task_id         text NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    linked_task_id  text NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    link_type       text NOT NULL,
    created_by      text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (task_id, linked_task_id, link_type)
);
CREATE INDEX IF NOT EXISTS task_links_linked ON task_links (linked_task_id);

CREATE TABLE IF NOT EXISTS task_dependencies (
    task_id        text NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    depends_on_id  text NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, depends_on_id)
);

CREATE TABLE IF NOT EXISTS task_activity (
    id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    task_id     text NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    user_id     text NOT NULL,
    action      text NOT NULL,
    field       text,
    from_value  jsonb,
    to_value    jsonb,
    metadata    jsonb,
    ip_address  text,
    user_agent  text,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS task_activity_task_created ON task_activity (task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS task_activity_user_created ON task_activity (user_id, created_at DESC);

-- Per-workspace issue keys (ACME-12): one row per workspace, bumped atomically.
CREATE TABLE IF NOT EXISTS task_issue_counters (
    workspace_id  text PRIMARY KEY,
    prefix        text NOT NULL,
    seq           integer NOT NULL DEFAULT 0
);
