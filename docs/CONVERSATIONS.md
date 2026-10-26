# Conversations: the rules

How channels, direct messages, groups, threads and task discussions behave, and where each rule is
enforced. Every app (web, desktop, phone) and every server path (REST, Socket.IO, AI, background
jobs) follows the same rules; the server enforces them, the apps only explain them.

## Who can see what

One function decides access: `checkConversationAccess` / `checkMessageAccess` in
`server/src/modules/conversations/conversationAccess.js`.

| Conversation | Read | Post at the top level | Reply in threads |
|---|---|---|---|
| Public channel | Members. Workspace members can also open its threads and pins before joining. | Members (announcement channels: channel admins and workspace owners/admins) | Members and workspace members |
| Private channel | Members | Members (announcement rule as above) | Members |
| 1:1 DM | The two people | Both, unless either blocked the other | Same |
| Group | Its members, **from their join date** (set when they were added: see Groups) | Members | Members |

Everyone must also be an **active member of the conversation's workspace**. Someone who leaves, is
removed or suspended loses access to that workspace's channels, DMs and groups straight away, on
every path, and their devices leave the live rooms at once.

## Direct messages

- **One DM per pair of people in a workspace.** Opening a DM with someone always returns the same
  conversation (`DMSession.pairKey` is unique: `<workspace>:<id>:<id>`). A DM can only be started
  with an active member of the same workspace.
- **A DM never changes its people.** Mentioning someone who isn't in it offers to start a **new
  group** with everyone; the DM stays as it was, with its history, and nothing is copied.

## Groups

- A group has 3 to 10 people when it starts, its own id, an optional name and an admin (the person
  who started it).
- **Same people, same group.** Starting a group from New Message with exactly the people of an
  existing unnamed group reopens that group. Naming the new group always makes a separate one. So
  Nani + Mani + Teja and Nani + Mani + Nikil are two groups, each with its own history.
- **Two ways to bring someone in** (Group info → Add people, or mentioning / `/invite`-ing someone
  in the group):
  - **Add to this group** keeps the same group. The person adding chooses what the new people see
    (`POST /api/v2/dm/:id/members { userIds, history }`):
    - `from_now` (default): messages from when they joined. The group gets a new key; the new
      people hold only that one, so earlier messages stay unreadable to them even as ciphertext.
    - `earlier`: also the earlier messages the person adding them can see: the same join date and
      copies of the earlier keys from then on. A period whose key the server holds no copy of
      can't be shared; their join date then moves after it and the answer says so
      (`history[userId].limited`), which the apps show.
  - **Start a new group** (`POST /api/v2/dm/group { …, newGroup: true }`) always makes a separate
    group with the people picked, even if the same people already have one; the original keeps its
    people and history, and nothing is copied.
- The server filters history, threads, pins, search, files, bookmarks, reminders, missed-message
  catch-up, notifications and live events by each member's join date (`memberSince.at`); the keys
  they hold follow `memberSince.fromKeyVersion` (also when they set up encryption later).
- **Leaving and removing.** Anyone can leave; the group's admin can remove others. When the admin
  leaves, the person who has been in the group longest takes over. People who leave or are removed
  lose access, their copies of the conversation keys and their live connection at once, and the
  group gets a new key for the people still in it; the others keep the whole history.
- A group stays a group even if people leave (it can shrink to one person).

## Channels

- Any active member of the workspace can join a public channel; private channels are by invitation.
  People outside the workspace can't join, read or find its channels.
- **New channel members read the whole history** (unlike groups).
- Removing someone (or them leaving) takes them out of the live room and removes their copies of
  the channel's keys. A **private** channel then gets a new key for the members still in it (a
  public one doesn't: anyone in the workspace may join and read it).

## Conversation keys

Messages are encrypted with the conversation's key (AES-256-GCM). The key has versions
(`server/src/modules/conversations/keyEpochs.js`, PostgreSQL `conversation_key_epochs`, migration
0018): a group that adds people "from now on", and a group or private channel that loses someone,
gets a new key; the previous one is kept only by the people allowed to read that period. Messages
record the version they were encrypted with (`payload.keyVersion`; missing = 1); the apps read
older messages with the earlier keys they hold and always send with the current one. A send with
an older key is refused with `409 KEY_ROTATED`; the apps then fetch the new key and send again, and
a `conversation:key_rotated` event tells open apps to do it straight away. Scheduled messages that
outlive a key change fail with a plain reason to schedule them again.

Limits: a new key protects what is said **after** someone leaves; a key they already downloaded
still opens the period they could read (the server no longer gives them its messages). Apps from
before key versions can't send in a conversation whose key changed until they are updated.

## Threads

- Threads are one level deep: a reply can't start its own thread. Replies live in the same
  conversation as their parent and never show in the main feed.
- Thread access is the parent message's access (including a group member's join date).
- Followers and people mentioned in a thread are notified only while they can still see it.

## Task discussions

- A task's discussion is separate from chat: comments and automatic entries (status, assignees,
  due dates…) stored with the task (`TaskDiscussion`, `TaskComment`), in plain text like the task
  itself, with no threads inside it.
- Who sees it follows the task: the workspace's members for workspace tasks, the channel's members
  for channel tasks, the creator, assignees, watchers and people added to the discussion.
- A task made from a message links to that message's chat thread: the chat thread gets a
  "📋 Task created" reply, and the discussion shows a preview of the thread's latest replies, only
  to people who can read that thread in chat.
- **From then on comments and replies are shared both ways**
  (`server/src/features/tasks/tasks.threadSync.js`), each side keeping its own rules:
  - A **task comment** is posted in the thread as a reply from its author (encrypted with the
    conversation key, like other server-written replies) when its author may post there, the
    thread isn't locked, and everyone who can read the thread may also see the task. Otherwise it
    stays in the task and says why ("Only here: …").
  - A **thread reply** shows in each linked task's discussion as a comment from its author when
    its author may see and comment on the task. Its text stays end-to-end encrypted (the apps
    decrypt it), and it is shown only to people who can read the thread in chat: on every read,
    live event and notification.
  - The original owns its copy: deleting a comment deletes its reply; deleting a reply for
    everyone, or editing it, updates its copies. Deleting a copy only removes it on that side; a
    reply copied from a task can't be edited in chat. Copies are never copied back, and the
    "📋 Task created" reply and automatic entries are never copied.
  - Every copy points to its original (`Message.taskComment`, `TaskComment.mirror.messageId`,
    unique), so retries never duplicate. A failed copy is marked pending and retried every five
    minutes, up to five times (`task-thread-sync` job).
  - Replies written before the task was made are not copied (the preview shows the latest ones).

## One send path

REST (`POST /api/v2/messages/channel`, `/direct`, `/poll`, `/forward`) and Socket.IO
(`send-message`) run the same checks (`server/src/modules/messages/sendRules.js`) and the same
`createMessage`, so both produce the same events:

| Event | When | Payload |
|---|---|---|
| `new-message` | A top-level message | The message (with `clientTempId` when the sender gave one), to the conversation and, for DMs, each participant |
| `thread-reply` | A thread reply | `{ parentId, reply, clientTempId }` |
| `message-updated` | A thread's counters changed | `{ messageId, channelId, dmId, updates: { replyCount, lastReplyAt } }` |
| `message:reaction_added` / `message:reaction_removed` | Reactions (several per person) | `{ messageId, userId, emoji, reactions, channelId, dmSessionId, parentId }` |
| `message:deleted` | Delete for everyone | `{ messageId, dm, channel, parentId, deletedBy, deletedByName, deletedAt }` |
| `message-pinned` / `message-unpinned` | Pins | `{ messageId, isPinned, pinnedBy, pinnedByName, … }` |

The socket also confirms to the sender with `message-sent` (or `send-error` with the same `code` the
REST API would answer with). Socket reactions, deletes and pins call the same services as REST.

## Recipient search

"New message" (Home sidebar and Messages page) and "Add people" use the workspace's active members
and one matcher shared by the web and phone apps (`platform/people/peopleMatch.js`): word starts of
the name, username or email start, and three or more letters anywhere; case, accents and spaces
don't matter.
