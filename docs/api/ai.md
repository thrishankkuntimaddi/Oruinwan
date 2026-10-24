# AI API notes

Changes to the assistant's tools and AI endpoints (round 2).

## Assistant tool `schedule_meeting` (ai/tools/registry.js → server/utils/aiActions.js)

Arguments: `{ title (required), startsAt?, durationMinutes? (5–480, default 30), participantIds?, earliest?, latest? }`.

- With `startsAt`: books that time (as before).
- Without `startsAt`: asks the real availability finder (`meetings.service.suggestTime`, the same
  logic as `POST /api/v2/meetings/suggest-time`, see meetings.md) for the caller plus the
  participants who are active workspace members, within `earliest`..`latest` (default now .. +7 days,
  max 14), using the caller's timezone as the fallback for attendees without one.
  - The first slot where **everyone** is free and inside working hours is booked:
    `{ success: true, meetingId, title, startTime, duration, chosenBy: 'availability' }`
    (`chosenBy: 'user'` when `startsAt` was given).
  - No such slot: nothing is booked; the tool returns
    `{ success: false, error, candidates: [{ start, end, availableCount, attendeeCount }], window }`
    so the model can offer the best partial slots and ask the user.
- Participants who are not active members of the workspace are dropped.

The standalone AI process reaches this through the existing internal action proxy
(`POST /api/internal/ai-actions/scheduleMeeting`); nothing changed on the wire.

## Removed: `POST /api/ai/command` and `POST /api/ai/generate-tasks`

The natural-language command endpoint (`server/src/features/ai/automation/*`, an intent classifier
for "create task / schedule meeting / ask") had no callers in web, mobile, desktop or the SDK and
duplicated what the assistant already does through its tools (`create_task`, `schedule_meeting`,
`search_workspace`). `generate-tasks` duplicated `POST /api/ai/extract-tasks`. Both are removed;
use the assistant (`/api/ai/chat` or the assistant routes) or `/api/ai/extract-tasks` instead.
The gateway's `classifyIntent` capability remains available to server code.

## Assistant work tools: threads, replies, tasks, notes, reminders, mentions

`@ai` in a channel / DM / thread (and the AI chat screen) can act, as the person who asked, through
the same services as the app (live socket events, notifications, audit, plan limits):

| Tool | Arguments | Notes |
| --- | --- | --- |
| `create_thread` | `title`, `topic?`, `details?`, `channel?`, `person?`, `mention?[]` | Posts `[Thread] <topic>: <title>` as a new message, then `details` as its first reply. Defaults to the conversation the assistant was asked in. Returns `threadId`, `link`. |
| `reply_in_thread` | `message`, `threadId?`, `mention?[]` | Defaults to the thread the assistant was asked in. |
| `create_task` | `title`, `description?`, `dueDate?`, `priority?` (lowest…highest, "urgent" = highest), `assignees?[]` (id, @username or name), `linkToConversation?`, `linkedMessageId?` | Plan limits (`tasks.*`) are enforced. Returns `taskId`, `link`. |
| `create_note` | `title`, `content` (Markdown), `shareWith?[]` | Markdown becomes note blocks (headings, checklists, code). |
| `append_to_note` | `content`, `noteId?` or `title?` | Only notes the person may edit. |
| `set_reminder` | `remindAt`, `note?`, `messageId?` | A message reminder for the person; defaults to the thread / message they asked in. |
| `send_message_to_channel` | `channelId` (id or name), `message`, `mention?[]` | |

`mention` takes people or `here` / `channel` / `everyone`; they are added as @handles, and only the
handles (never the encrypted text) are sent as `mentionText`. Messages are encrypted with the
conversation key's server copy (`encryptForConversation`). Every action checks that the person is
a member of the workspace and the conversation (channel member; admins-only channels for top-level
posts; DM participant, not blocked) and that the workspace feature (threads, tasks, notes,
reminders) is on. The server passes the conversation (`ctx.conversation = { id, type, parentId,
triggerMessageId }`) to the tools; the model never chooses the user. `@everyone` is treated as
`@channel` by the mention parser.
